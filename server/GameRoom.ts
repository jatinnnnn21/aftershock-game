import {
  CharacterClass,
  CHARACTER_DEFS,
  ClientInputPacket,
  ClientUseAbilityPacket,
  EnergyNode,
  FluxZone,
  GameEvent,
  GameSnapshot,
  GameStatus,
  GridCell,
  GRID_SIZE,
  HazardPattern,
  PlacedTrap,
  PlayerState,
  RoomSettings,
  SeismicHazard,
  TICK_MS,
  TICK_RATE
} from '../shared/types.js';
import { Server } from 'socket.io';

const BASE_SPEED = 0.28; // grid units per tick (~5.6 units/sec)
const BOOSTED_SPEED = 0.46; // with Surge (~9.2 units/sec)
const SLOWED_SPEED = 0.14; // in vortex

export class GameRoom {
  public roomCode: string;
  public settings: RoomSettings;
  public hostId: string;
  public status: GameStatus = 'LOBBY';
  public players: Map<string, PlayerState> = new Map();
  public sockets: Map<string, string> = new Map(); // socketId -> playerId
  public reconnectTokens: Map<string, string> = new Map(); // reconnectToken -> playerId
  
  // Game simulation state
  private tickCount: number = 0;
  private timeRemaining: number = 90;
  private totalMatchTime: number = 90;
  private suddenDeath: boolean = false;
  private winnerId: string | null = null;
  private energyNodes: Map<string, EnergyNode> = new Map();
  private fluxZones: Map<string, FluxZone> = new Map();
  private hazards: Map<string, SeismicHazard> = new Map();
  private traps: Map<string, PlacedTrap> = new Map();
  private recentEvents: GameEvent[] = [];
  private loopInterval: NodeJS.Timeout | null = null;
  private io: Server;

  // Bot controllers
  private bots: Set<string> = new Set();

  constructor(roomCode: string, hostId: string, settings: Partial<RoomSettings>, io: Server) {
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.io = io;
    this.settings = {
      roomCode,
      roomName: settings.roomName || `Arena-${roomCode}`,
      hasPassword: !!settings.hasPassword,
      maxPlayers: Math.min(6, Math.max(2, settings.maxPlayers || 6)),
      matchDuration: settings.matchDuration || 90,
      fillBots: !!settings.fillBots
    };
    this.totalMatchTime = this.settings.matchDuration;
    this.timeRemaining = this.settings.matchDuration;
  }

  public addPlayer(
    socketId: string,
    name: string,
    reconnectToken?: string
  ): { player: PlayerState; token: string } {
    // Check reconnection
    if (reconnectToken && this.reconnectTokens.has(reconnectToken)) {
      const existingPlayerId = this.reconnectTokens.get(reconnectToken)!;
      const existingPlayer = this.players.get(existingPlayerId);
      if (existingPlayer) {
        // Clean up old socket reference for this player
        for (const [sId, pId] of this.sockets.entries()) {
          if (pId === existingPlayerId && sId !== socketId) {
            this.sockets.delete(sId);
          }
        }
        this.sockets.set(socketId, existingPlayerId);
        return { player: existingPlayer, token: reconnectToken };
      }
    }

    const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;
    const token = `tok_${Math.random().toString(36).substring(2, 15)}`;
    this.reconnectTokens.set(token, playerId);
    this.sockets.set(socketId, playerId);

    const colors = ['#00f2fe', '#a855f7', '#ff0055', '#10b981', '#f59e0b', '#3b82f6'];
    const chosenColor = colors[this.players.size % colors.length];

    const characters: CharacterClass[] = ['BLINK', 'SHOCKWAVE', 'SHIELD', 'VORTEX', 'SURGE', 'MINE'];
    const chosenChar = characters[this.players.size % characters.length];

    // Spawn point inside quadrant
    const spawnAngle = (this.players.size / 6) * Math.PI * 2;
    const spawnRadius = 6;
    const centerX = GRID_SIZE / 2;
    const centerY = GRID_SIZE / 2;

    const newPlayer: PlayerState = {
      id: playerId,
      name: name.trim().substring(0, 16) || `Racer-${this.players.size + 1}`,
      color: chosenColor,
      character: chosenChar,
      x: Math.max(1, Math.min(GRID_SIZE - 1, centerX + Math.cos(spawnAngle) * spawnRadius)),
      y: Math.max(1, Math.min(GRID_SIZE - 1, centerY + Math.sin(spawnAngle) * spawnRadius)),
      vx: 0,
      vy: 0,
      score: 0,
      energyBanked: 0,
      energyCarrying: 0,
      isAlive: true,
      isReady: this.players.size === 0, // host ready by default
      isHost: playerId === this.hostId,
      stunnedUntil: 0,
      shieldUntil: 0,
      speedBoostUntil: 0,
      abilityCooldownUntil: 0,
      abilityMaxCooldown: CHARACTER_DEFS[chosenChar].cooldownMs,
      stats: {
        energyCollected: 0,
        hazardsDodged: 0,
        abilitiesUsed: 0,
        pylonsCaptured: 0,
        timesStunned: 0
      },
      ping: 0
    };

    this.players.set(playerId, newPlayer);
    this.broadcastRoomState();
    return { player: newPlayer, token };
  }

  public removePlayer(socketId: string) {
    const playerId = this.sockets.get(socketId);
    if (!playerId) return;

    this.sockets.delete(socketId);

    // If game is in lobby, remove player entirely
    if (this.status === 'LOBBY') {
      this.players.delete(playerId);
      // Transfer host if host left
      if (this.hostId === playerId && this.players.size > 0) {
        const nextHost = this.players.values().next().value;
        if (nextHost) {
          this.hostId = nextHost.id;
          nextHost.isHost = true;
          this.addEvent({
            id: `evt_${Date.now()}`,
            timestamp: Date.now(),
            type: 'ABILITY',
            message: `${nextHost.name} is now the Room Host.`
          });
        }
      }
      this.broadcastRoomState();
    }
  }

  public setReady(socketId: string, ready: boolean) {
    const playerId = this.sockets.get(socketId);
    if (!playerId) return;
    const player = this.players.get(playerId);
    if (player) {
      player.isReady = ready;
      this.broadcastRoomState();
    }
  }

  public selectCharacter(socketId: string, char: CharacterClass) {
    const playerId = this.sockets.get(socketId);
    if (!playerId) return;
    const player = this.players.get(playerId);
    if (player && CHARACTER_DEFS[char]) {
      player.character = char;
      player.abilityMaxCooldown = CHARACTER_DEFS[char].cooldownMs;
      this.broadcastRoomState();
    }
  }

  public setPlayerColor(socketId: string, color: string) {
    const playerId = this.sockets.get(socketId);
    if (!playerId) return;
    const player = this.players.get(playerId);
    if (player) {
      player.color = color;
      this.broadcastRoomState();
    }
  }

  public updateSettings(socketId: string, newSettings: Partial<RoomSettings>) {
    const playerId = this.sockets.get(socketId);
    if (playerId !== this.hostId) return;

    if (newSettings.roomName) this.settings.roomName = newSettings.roomName;
    if (newSettings.matchDuration) {
      this.settings.matchDuration = newSettings.matchDuration;
      this.totalMatchTime = newSettings.matchDuration;
      this.timeRemaining = newSettings.matchDuration;
    }
    if (newSettings.fillBots !== undefined) {
      this.settings.fillBots = newSettings.fillBots;
    }
    this.broadcastRoomState();
  }

  public handleInput(socketId: string, input: ClientInputPacket) {
    const playerId = this.sockets.get(socketId);
    if (!playerId || this.status !== 'IN_PROGRESS') return;
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    // Sanitize input to prevent NaN or Infinity injection
    let dx = typeof input?.dx === 'number' && Number.isFinite(input.dx) ? input.dx : 0;
    let dy = typeof input?.dy === 'number' && Number.isFinite(input.dy) ? input.dy : 0;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      dx = dx / len;
      dy = dy / len;
    } else {
      dx = 0;
      dy = 0;
    }

    player.vx = dx;
    player.vy = dy;
  }

  public handleAbility(socketId: string, payload: ClientUseAbilityPacket) {
    const playerId = this.sockets.get(socketId);
    if (!playerId || this.status !== 'IN_PROGRESS') return;
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    const now = Date.now();
    if (now < player.abilityCooldownUntil || now < player.stunnedUntil) return;

    // Set cooldown
    player.abilityCooldownUntil = now + player.abilityMaxCooldown;
    player.stats.abilitiesUsed++;

    switch (player.character) {
      case 'BLINK': {
        // Warp 3.5 tiles in current facing/moving direction
        let dirX = player.vx;
        let dirY = player.vy;
        const len = Math.hypot(dirX, dirY);
        if (len > 0.01) {
          dirX /= len;
          dirY /= len;
        } else {
          dirX = 1;
          dirY = 0;
        }
        const dist = 3.5;
        player.x = Math.max(0.8, Math.min(GRID_SIZE - 0.8, player.x + dirX * dist));
        player.y = Math.max(0.8, Math.min(GRID_SIZE - 0.8, player.y + dirY * dist));
        this.addEvent({
          id: `evt_${now}`,
          timestamp: now,
          type: 'ABILITY',
          message: `${player.name} blinked across the arena!`,
          color: player.color
        });
        break;
      }
      case 'SHOCKWAVE': {
        // Knock back nearby rivals
        for (const [otherId, other] of this.players.entries()) {
          if (otherId === playerId || !other.isAlive) continue;
          const dist = Math.hypot(other.x - player.x, other.y - player.y);
          if (dist < 3.8) {
            // Check if other player is shielded
            if (now < other.shieldUntil) {
              other.stats.hazardsDodged++;
              continue; // Aegis shield absorbs rival shockwaves!
            }
            // Apply knockback
            const angle = Math.atan2(other.y - player.y, other.x - player.x);
            other.x = Math.max(0.8, Math.min(GRID_SIZE - 0.8, other.x + Math.cos(angle) * 3));
            other.y = Math.max(0.8, Math.min(GRID_SIZE - 0.8, other.y + Math.sin(angle) * 3));
            other.stunnedUntil = Math.max(other.stunnedUntil, now + 400);
          }
        }
        this.addEvent({
          id: `evt_${now}`,
          timestamp: now,
          type: 'ABILITY',
          message: `${player.name} triggered a Kinetic Shockwave!`,
          color: player.color
        });
        break;
      }
      case 'SHIELD': {
        // Invulnerable for 2.5s
        player.shieldUntil = now + 2500;
        this.addEvent({
          id: `evt_${now}`,
          timestamp: now,
          type: 'ABILITY',
          message: `${player.name} activated Aegis Force Barrier!`,
          color: player.color
        });
        break;
      }
      case 'VORTEX': {
        // Drop graviton trap at current location
        const trapId = `trap_${now}_${Math.random().toString(36).substr(2, 5)}`;
        this.traps.set(trapId, {
          id: trapId,
          ownerId: playerId,
          type: 'vortex',
          x: player.x,
          y: player.y,
          radius: 3.5,
          expiresAt: now + 4000
        });
        this.addEvent({
          id: `evt_${now}`,
          timestamp: now,
          type: 'ABILITY',
          message: `${player.name} deployed a Graviton Singularity!`,
          color: player.color
        });
        break;
      }
      case 'SURGE': {
        // Boost speed and score intake for 3.5s
        player.speedBoostUntil = now + 3500;
        this.addEvent({
          id: `evt_${now}`,
          timestamp: now,
          type: 'ABILITY',
          message: `${player.name} engaged Overcharge Surge!`,
          color: player.color
        });
        break;
      }
      case 'MINE': {
        // Plant seismic mine
        const mineId = `mine_${now}_${Math.random().toString(36).substr(2, 5)}`;
        this.traps.set(mineId, {
          id: mineId,
          ownerId: playerId,
          type: 'mine',
          x: player.x,
          y: player.y,
          radius: 1.2,
          expiresAt: now + 20000
        });
        this.addEvent({
          id: `evt_${now}`,
          timestamp: now,
          type: 'ABILITY',
          message: `${player.name} primed a Seismic Rift Mine!`,
          color: player.color
        });
        break;
      }
    }
  }

  public kickPlayer(hostSocketId: string, targetPlayerId: string) {
    const hostPlayerId = this.sockets.get(hostSocketId);
    if (hostPlayerId !== this.hostId || hostPlayerId === targetPlayerId) return;

    let targetSocketId: string | null = null;
    for (const [sId, pId] of this.sockets.entries()) {
      if (pId === targetPlayerId) {
        targetSocketId = sId;
        break;
      }
    }

    this.players.delete(targetPlayerId);
    if (targetSocketId) {
      this.sockets.delete(targetSocketId);
      const targetSocket = this.io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(this.roomCode);
        targetSocket.emit('errorNotification', 'You were removed from the room by the host.');
      }
    }
    this.broadcastRoomState();
  }

  public requestRematch(socketId: string) {
    const playerId = this.sockets.get(socketId);
    if (!playerId) return;

    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    this.status = 'LOBBY';
    this.suddenDeath = false;
    this.winnerId = null;
    this.timeRemaining = this.settings.matchDuration;
    this.hazards.clear();
    this.traps.clear();
    this.energyNodes.clear();
    this.fluxZones.clear();
    this.recentEvents = [];

    // Reset player scores and ready states
    for (const player of this.players.values()) {
      player.score = 0;
      player.energyCarrying = 0;
      player.energyBanked = 0;
      player.stunnedUntil = 0;
      player.shieldUntil = 0;
      player.speedBoostUntil = 0;
      player.abilityCooldownUntil = 0;
      player.isAlive = true;
      player.isReady = player.isHost; // host remains ready
    }

    this.addEvent({
      id: `evt_rematch_${Date.now()}`,
      timestamp: Date.now(),
      type: 'ABILITY',
      message: 'Returned to Lobby for rematch! Prepare your loadout.'
    });

    this.broadcastRoomState();
  }

  public startMatch(socketId?: string) {
    if (this.status === 'IN_PROGRESS') return;

    if (socketId) {
      const playerId = this.sockets.get(socketId);
      if (playerId !== this.hostId) return;
    }

    // Require all players to be ready
    const allReady = Array.from(this.players.values()).every((p) => p.isReady);
    if (!allReady) return;

    // Minimum 2 players unless fillBots is enabled
    if (this.players.size < 2 && !this.settings.fillBots) return;

    // Populate bots if requested or solo player
    if (this.settings.fillBots && this.players.size < 4) {
      const botNames = ['Cyber-Drone', 'Vanguard-AI', 'Nexus-Unit', 'Apex-Core'];
      const botClasses: CharacterClass[] = ['BLINK', 'SHOCKWAVE', 'SHIELD', 'SURGE'];
      while (this.players.size < 4) {
        const botId = `bot_${Math.random().toString(36).substr(2, 7)}`;
        const botName = botNames[this.players.size % botNames.length];
        const botClass = botClasses[this.players.size % botClasses.length];
        const botColor = '#94a3b8';
        this.players.set(botId, {
          id: botId,
          name: botName,
          color: botColor,
          character: botClass,
          x: Math.random() * (GRID_SIZE - 4) + 2,
          y: Math.random() * (GRID_SIZE - 4) + 2,
          vx: 0,
          vy: 0,
          score: 0,
          energyBanked: 0,
          energyCarrying: 0,
          isAlive: true,
          isReady: true,
          isHost: false,
          stunnedUntil: 0,
          shieldUntil: 0,
          speedBoostUntil: 0,
          abilityCooldownUntil: 0,
          abilityMaxCooldown: CHARACTER_DEFS[botClass].cooldownMs,
          stats: { energyCollected: 0, hazardsDodged: 0, abilitiesUsed: 0, pylonsCaptured: 0, timesStunned: 0 },
          ping: 10
        });
        this.bots.add(botId);
      }
    }

    this.status = 'IN_PROGRESS';
    this.totalMatchTime = this.settings.matchDuration;
    this.timeRemaining = this.settings.matchDuration;
    this.winnerId = null;
    this.suddenDeath = false;
    this.recentEvents = [];

    // Reset player scores and positions
    let i = 0;
    const totalP = this.players.size;
    for (const player of this.players.values()) {
      const angle = (i / totalP) * Math.PI * 2;
      player.x = GRID_SIZE / 2 + Math.cos(angle) * 7;
      player.y = GRID_SIZE / 2 + Math.sin(angle) * 7;
      player.score = 0;
      player.energyCarrying = 0;
      player.energyBanked = 0;
      player.stunnedUntil = 0;
      player.shieldUntil = 0;
      player.speedBoostUntil = 0;
      player.abilityCooldownUntil = 0;
      player.isAlive = true;
      i++;
    }

    // Spawn initial energy nodes
    this.energyNodes.clear();
    for (let k = 0; k < 16; k++) {
      this.spawnEnergyNode();
    }

    // Spawn initial flux zone
    this.spawnFluxZone();

    this.addEvent({
      id: `evt_start_${Date.now()}`,
      timestamp: Date.now(),
      type: 'AFTERSHOCK_WAVE',
      message: 'MATCH INITIATED! Secure Flux Conduits and survive the Aftershocks!'
    });

    // Start 20Hz authoritative simulation loop
    if (this.loopInterval) clearInterval(this.loopInterval);
    this.loopInterval = setInterval(() => this.simulationTick(), TICK_MS);

    this.io.to(this.roomCode).emit('matchStarted', this.createSnapshot());
  }

  private simulationTick() {
    this.tickCount++;
    const now = Date.now();

    // 1. Update Match Timer (every 20 ticks = 1 second)
    if (this.tickCount % TICK_RATE === 0) {
      this.timeRemaining--;

      // Spawn periodic hazards & energy nodes (double frequency in Sudden Death)
      const hazardInterval = this.suddenDeath ? 2 : 4;
      if (this.timeRemaining % hazardInterval === 0) {
        this.scheduleSeismicHazard();
      }
      if (this.energyNodes.size < 18) {
        this.spawnEnergyNode();
      }

      // Check match end
      if (this.timeRemaining <= 0) {
        // Check for 1st place tie -> Sudden Death Overtime
        if (!this.suddenDeath && this.players.size > 1) {
          const scores = Array.from(this.players.values()).map((p) => p.score);
          const maxScore = Math.max(...scores);
          const topPlayers = Array.from(this.players.values()).filter((p) => p.score === maxScore);
          if (topPlayers.length > 1) {
            this.suddenDeath = true;
            this.timeRemaining = 30; // 30s Overtime
            this.addEvent({
              id: `evt_sd_${now}`,
              timestamp: now,
              type: 'AFTERSHOCK_WAVE',
              message: 'TIE SCORE DETECTED! 30-SECOND SUDDEN DEATH OVERTIME!'
            });
            return;
          }
        }
        this.endMatch();
        return;
      }
    }

    // 2. Run Bot AI (if any)
    this.updateBots(now);

    // 3. Update Players (Movement, Collision, Clamping)
    for (const player of this.players.values()) {
      if (!player.isAlive) continue;

      if (now < player.stunnedUntil) {
        // Stunned: cannot move
        player.vx = 0;
        player.vy = 0;
        continue;
      }

      // Calculate effective speed
      let speed = BASE_SPEED;
      if (now < player.speedBoostUntil) speed = BOOSTED_SPEED;

      // Check if slowed or pulled by vortex
      for (const trap of this.traps.values()) {
        if (trap.type === 'vortex' && trap.ownerId !== player.id) {
          const d = Math.hypot(player.x - trap.x, player.y - trap.y);
          if (d <= trap.radius) {
            speed = SLOWED_SPEED;
            if (d > 0.2) {
              player.x += ((trap.x - player.x) / d) * 0.04;
              player.y += ((trap.y - player.y) / d) * 0.04;
            }
            break;
          }
        }
      }

      // Integrate position
      player.x += player.vx * speed;
      player.y += player.vy * speed;

      // Boundary clamp
      player.x = Math.max(0.6, Math.min(GRID_SIZE - 0.6, player.x));
      player.y = Math.max(0.6, Math.min(GRID_SIZE - 0.6, player.y));
    }

    // 4. Update Traps (Mines & Vortices)
    for (const [trapId, trap] of this.traps.entries()) {
      if (now > trap.expiresAt) {
        this.traps.delete(trapId);
        continue;
      }

      if (trap.type === 'mine') {
        // Check if enemy stepped near mine
        for (const player of this.players.values()) {
          if (player.id !== trap.ownerId && player.isAlive) {
            const dist = Math.hypot(player.x - trap.x, player.y - trap.y);
            if (dist < trap.radius) {
              // Mine explodes!
              this.traps.delete(trapId);
              this.triggerInstantAftershock(trap.x, trap.y, 2.5);
              this.addEvent({
                id: `evt_mine_${now}`,
                timestamp: now,
                type: 'STUN',
                message: `${player.name} detonated a hidden Seismic Mine!`
              });
              break;
            }
          }
        }
      } else if (trap.type === 'vortex') {
        // Pull nearby energy nodes towards vortex
        for (const node of this.energyNodes.values()) {
          const dist = Math.hypot(node.x - trap.x, node.y - trap.y);
          if (dist < trap.radius + 1 && dist > 0.2) {
            node.x += ((trap.x - node.x) / dist) * 0.12;
            node.y += ((trap.y - node.y) / dist) * 0.12;
          }
        }
      }
    }

    // 5. Update Hazards & Check Hazard Damage
    for (const [hazardId, hazard] of this.hazards.entries()) {
      if (now < hazard.warnUntil) {
        hazard.stage = 'warning';
      } else if (now < hazard.eruptUntil) {
        hazard.stage = 'erupting';
        if (!hazard.hasDealtDamage) {
          hazard.hasDealtDamage = true;
          // Check player impacts
          for (const player of this.players.values()) {
            if (!player.isAlive) continue;
            // Invulnerable if shield is active
            if (now < player.shieldUntil) {
              player.stats.hazardsDodged++;
              continue;
            }

            // Check if player position intersects any affected cell
            const pGridX = Math.floor(player.x);
            const pGridY = Math.floor(player.y);

            const hit = hazard.affectedCells.some(cell => cell.x === pGridX && cell.y === pGridY);
            if (hit) {
              // Knockback & stun
              player.stunnedUntil = now + 1200;
              player.stats.timesStunned++;

              // Scatter carrying energy
              if (player.score > 10) {
                const dropped = Math.floor(player.score * 0.2);
                player.score -= dropped;
                // Spawn scattered nodes
                for (let s = 0; s < 3; s++) {
                  this.spawnEnergyNode(
                    Math.max(1, Math.min(GRID_SIZE - 1, player.x + (Math.random() - 0.5) * 3)),
                    Math.max(1, Math.min(GRID_SIZE - 1, player.y + (Math.random() - 0.5) * 3))
                  );
                }
              }

              // Knock player away from hazard epicenter
              const angle = Math.atan2(player.y - hazard.originY, player.x - hazard.originX);
              player.x = Math.max(0.6, Math.min(GRID_SIZE - 0.6, player.x + Math.cos(angle) * 2.2));
              player.y = Math.max(0.6, Math.min(GRID_SIZE - 0.6, player.y + Math.sin(angle) * 2.2));

              this.addEvent({
                id: `evt_stun_${now}_${player.id}`,
                timestamp: now,
                type: 'STUN',
                message: `${player.name} struck by Seismic Shockwave!`
              });
            }
          }
        }
      } else {
        // Expired
        this.hazards.delete(hazardId);
      }
    }

    // 6. Check Energy Node Collection
    for (const [nodeId, node] of this.energyNodes.entries()) {
      for (const player of this.players.values()) {
        if (!player.isAlive) continue;
        const dist = Math.hypot(player.x - node.x, player.y - node.y);
        if (dist < 0.85) {
          const multiplier = now < player.speedBoostUntil ? 2 : 1;
          const pointsEarned = node.value * multiplier;
          player.score += pointsEarned;
          player.stats.energyCollected += pointsEarned;
          this.energyNodes.delete(nodeId);
          break;
        }
      }
    }

    // 7. Update Flux Conduits
    for (const [zoneId, zone] of this.fluxZones.entries()) {
      if (now > zone.expiresAt) {
        this.fluxZones.delete(zoneId);
        this.spawnFluxZone();
        continue;
      }

      // Check which players are inside
      const occupiers: PlayerState[] = [];
      for (const player of this.players.values()) {
        if (!player.isAlive) continue;
        const dist = Math.hypot(player.x - zone.x, player.y - zone.y);
        if (dist <= zone.radius) {
          occupiers.push(player);
        }
      }

      if (occupiers.length === 1) {
        const occupier = occupiers[0];
        zone.isContested = false;
        zone.controllingPlayerId = occupier.id;
        zone.chargeProgress = Math.min(100, zone.chargeProgress + 1.2);
        // Award tick points
        occupier.score += 1;

        if (zone.chargeProgress >= 100) {
          // Complete capture bonus
          occupier.score += 50;
          occupier.stats.pylonsCaptured++;
          occupier.speedBoostUntil = now + 4000; // Overcharge reward
          this.addEvent({
            id: `evt_conduit_${now}`,
            timestamp: now,
            type: 'CONDUIT_CAPTURE',
            message: `${occupier.name} fully CHARGED the Flux Conduit! (+50 pts & Surge)`,
            color: occupier.color
          });
          this.fluxZones.delete(zoneId);
          this.spawnFluxZone();
        }
      } else if (occupiers.length > 1) {
        // Contested by multiple rival pilots!
        zone.isContested = true;
        zone.controllingPlayerId = null;
      } else {
        zone.isContested = false;
        zone.chargeProgress = Math.max(0, zone.chargeProgress - 0.4);
      }
    }

    // 8. Broadcast Authoritative Snapshot to Room Clients
    const snapshot = this.createSnapshot();
    this.io.to(this.roomCode).emit('gameSnapshot', snapshot);
  }

  private updateBots(now: number) {
    for (const botId of this.bots) {
      const bot = this.players.get(botId);
      if (!bot || !bot.isAlive || now < bot.stunnedUntil) continue;

      // Find target: nearest flux zone or nearest energy node
      let targetX = GRID_SIZE / 2;
      let targetY = GRID_SIZE / 2;
      let closestDist = Infinity;

      // Prioritize active flux conduit
      const activeZone = this.fluxZones.values().next().value;
      if (activeZone) {
        targetX = activeZone.x;
        targetY = activeZone.y;
      } else {
        for (const node of this.energyNodes.values()) {
          const d = Math.hypot(node.x - bot.x, node.y - bot.y);
          if (d < closestDist) {
            closestDist = d;
            targetX = node.x;
            targetY = node.y;
          }
        }
      }

      // Check if bot is on a hazard cell to dodge
      const botGridX = Math.floor(bot.x);
      const botGridY = Math.floor(bot.y);
      let inDanger = false;
      for (const hazard of this.hazards.values()) {
        if (hazard.affectedCells.some(c => c.x === botGridX && c.y === botGridY)) {
          inDanger = true;
          // Trigger ability if ready to escape
          if (now >= bot.abilityCooldownUntil) {
            bot.abilityCooldownUntil = now + bot.abilityMaxCooldown;
            if (bot.character === 'BLINK') {
              bot.x = Math.max(1, Math.min(GRID_SIZE - 1, bot.x + (Math.random() - 0.5) * 4));
              bot.y = Math.max(1, Math.min(GRID_SIZE - 1, bot.y + (Math.random() - 0.5) * 4));
            } else if (bot.character === 'SHIELD') {
              bot.shieldUntil = now + 2500;
            } else if (bot.character === 'SURGE') {
              bot.speedBoostUntil = now + 3500;
            }
          }
          // Move away from epicenter
          targetX = bot.x + (bot.x - hazard.originX) * 2;
          targetY = bot.y + (bot.y - hazard.originY) * 2;
          break;
        }
      }

      const dx = targetX - bot.x;
      const dy = targetY - bot.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.1) {
        bot.vx = dx / dist;
        bot.vy = dy / dist;
      }
    }
  }

  private scheduleSeismicHazard() {
    const now = Date.now();
    const hazardId = `hazard_${now}_${Math.random().toString(36).substr(2, 5)}`;
    const originX = Math.floor(Math.random() * (GRID_SIZE - 4)) + 2;
    const originY = Math.floor(Math.random() * (GRID_SIZE - 4)) + 2;

    const patterns: HazardPattern[] = ['cross', 'ring', 'beam_horizontal', 'beam_vertical', 'radial_burst'];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const affectedCells: GridCell[] = [];

    switch (pattern) {
      case 'cross':
        for (let i = 0; i < GRID_SIZE; i++) {
          affectedCells.push({ x: originX, y: i });
          affectedCells.push({ x: i, y: originY });
        }
        break;
      case 'beam_horizontal':
        for (let x = 0; x < GRID_SIZE; x++) {
          affectedCells.push({ x, y: originY });
          affectedCells.push({ x, y: Math.min(GRID_SIZE - 1, originY + 1) });
        }
        break;
      case 'beam_vertical':
        for (let y = 0; y < GRID_SIZE; y++) {
          affectedCells.push({ x: originX, y });
          affectedCells.push({ x: Math.min(GRID_SIZE - 1, originX + 1), y });
        }
        break;
      case 'ring':
      case 'radial_burst':
        for (let dx = -3; dx <= 3; dx++) {
          for (let dy = -3; dy <= 3; dy++) {
            const d = Math.hypot(dx, dy);
            if (d >= 1.5 && d <= 3.5) {
              const cx = originX + dx;
              const cy = originY + dy;
              if (cx >= 0 && cx < GRID_SIZE && cy >= 0 && cy < GRID_SIZE) {
                affectedCells.push({ x: cx, y: cy });
              }
            }
          }
        }
        break;
    }

    const hazard: SeismicHazard = {
      id: hazardId,
      originX,
      originY,
      pattern,
      stage: 'warning',
      warnUntil: now + 1500, // 1.5s telegraph
      eruptUntil: now + 2400, // 0.9s eruption
      affectedCells,
      intensity: 1.0,
      hasDealtDamage: false
    };

    this.hazards.set(hazardId, hazard);
  }

  private triggerInstantAftershock(x: number, y: number, radius: number) {
    const now = Date.now();
    const hazardId = `hazard_inst_${now}`;
    const affectedCells: GridCell[] = [];
    const gx = Math.floor(x);
    const gy = Math.floor(y);

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.hypot(dx, dy) <= radius) {
          const cx = gx + dx;
          const cy = gy + dy;
          if (cx >= 0 && cx < GRID_SIZE && cy >= 0 && cy < GRID_SIZE) {
            affectedCells.push({ x: cx, y: cy });
          }
        }
      }
    }

    this.hazards.set(hazardId, {
      id: hazardId,
      originX: gx,
      originY: gy,
      pattern: 'radial_burst',
      stage: 'erupting',
      warnUntil: now,
      eruptUntil: now + 800,
      affectedCells,
      intensity: 1.5,
      hasDealtDamage: false
    });
  }

  private spawnEnergyNode(presetX?: number, presetY?: number) {
    const id = `node_${Math.random().toString(36).substr(2, 7)}`;
    const x = presetX !== undefined ? presetX : Math.random() * (GRID_SIZE - 2) + 1;
    const y = presetY !== undefined ? presetY : Math.random() * (GRID_SIZE - 2) + 1;

    const rand = Math.random();
    let type: 'standard' | 'super' | 'golden' = 'standard';
    let value = 10;
    if (rand > 0.85) {
      type = 'golden';
      value = 40;
    } else if (rand > 0.6) {
      type = 'super';
      value = 20;
    }

    this.energyNodes.set(id, {
      id,
      x,
      y,
      type,
      value,
      pulseOffset: Math.random() * Math.PI * 2
    });
  }

  private spawnFluxZone() {
    const id = `flux_${Date.now()}`;
    const x = Math.floor(Math.random() * (GRID_SIZE - 6)) + 3;
    const y = Math.floor(Math.random() * (GRID_SIZE - 6)) + 3;

    this.fluxZones.set(id, {
      id,
      x,
      y,
      radius: 2.5,
      chargeProgress: 0,
      controllingPlayerId: null,
      expiresAt: Date.now() + 25000 // 25s lifetime
    });

    this.addEvent({
      id: `evt_conduit_spawn_${Date.now()}`,
      timestamp: Date.now(),
      type: 'CONDUIT_CAPTURE',
      message: 'New Flux Conduit energized! Secure the beacon!'
    });
  }

  private endMatch() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    this.status = 'FINISHED';

    // Find highest scoring player
    let maxScore = -1;
    let winner: PlayerState | null = null;
    for (const player of this.players.values()) {
      if (player.score > maxScore) {
        maxScore = player.score;
        winner = player;
      }
    }

    this.winnerId = winner ? winner.id : null;

    const snapshot = this.createSnapshot();
    this.io.to(this.roomCode).emit('matchEnded', snapshot);
  }

  public addEvent(event: GameEvent) {
    this.recentEvents.push(event);
    if (this.recentEvents.length > 8) {
      this.recentEvents.shift();
    }
    this.io.to(this.roomCode).emit('gameEvent', event);
  }

  public broadcastRoomState() {
    const playerRecord: Record<string, PlayerState> = {};
    for (const [id, player] of this.players.entries()) {
      playerRecord[id] = player;
    }

    this.io.to(this.roomCode).emit('roomStateUpdate', {
      roomSettings: this.settings,
      players: playerRecord,
      status: this.status,
      hostId: this.hostId
    });
  }

  public createSnapshot(): GameSnapshot {
    const playerRecord: Record<string, PlayerState> = {};
    for (const [id, player] of this.players.entries()) {
      playerRecord[id] = player;
    }

    return {
      tick: this.tickCount,
      serverTime: Date.now(),
      status: this.status,
      timeRemaining: this.timeRemaining,
      totalMatchTime: this.totalMatchTime,
      suddenDeath: this.suddenDeath,
      winnerId: this.winnerId,
      players: playerRecord,
      energyNodes: Array.from(this.energyNodes.values()),
      fluxZones: Array.from(this.fluxZones.values()),
      hazards: Array.from(this.hazards.values()),
      traps: Array.from(this.traps.values()),
      recentEvents: this.recentEvents
    };
  }

  public destroy() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }
}

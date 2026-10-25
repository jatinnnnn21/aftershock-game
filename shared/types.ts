export type CharacterClass = 'BLINK' | 'SHOCKWAVE' | 'SHIELD' | 'VORTEX' | 'SURGE' | 'MINE';

export interface CharacterDef {
  id: CharacterClass;
  name: string;
  role: string;
  icon: string;
  color: string;
  cooldownMs: number;
  description: string;
  tacticalTip: string;
}

export const CHARACTER_DEFS: Record<CharacterClass, CharacterDef> = {
  BLINK: {
    id: 'BLINK',
    name: 'Phase Dasher',
    role: 'Mobility & Evasion',
    icon: 'Zap',
    color: '#00f2fe',
    cooldownMs: 5000,
    description: 'Instant phase-dash 3 grid units forward. Bypasses hazards and rifts completely.',
    tacticalTip: 'Use when seismic rings are about to detonate to escape undamaged.'
  },
  SHOCKWAVE: {
    id: 'SHOCKWAVE',
    name: 'Kinetic Brawler',
    role: 'Disruption & Zone Control',
    icon: 'Radio',
    color: '#ec4899',
    cooldownMs: 6500,
    description: 'Releases a radial kinetic blast that repels all nearby rivals and scatters hazards.',
    tacticalTip: 'Blast opponents off the Flux Conduit right before it deposits score.'
  },
  SHIELD: {
    id: 'SHIELD',
    name: 'Aegis Defender',
    role: 'Defense & Tanking',
    icon: 'Shield',
    color: '#3b82f6',
    cooldownMs: 8000,
    description: 'Activates a 2.5-second impenetrable barrier absorbing all shockwaves and knockbacks.',
    tacticalTip: 'Dive directly into seismic hazards to claim high-value golden cores safely.'
  },
  VORTEX: {
    id: 'VORTEX',
    name: 'Graviton Weaver',
    role: 'Area Pull & Crowd Control',
    icon: 'Disc',
    color: '#a855f7',
    cooldownMs: 7500,
    description: 'Deploys a localized gravity well that vacuums up energy cores and slows enemy thrusters.',
    tacticalTip: 'Place in dense energy clusters or choke-points to pull points to you.'
  },
  SURGE: {
    id: 'SURGE',
    name: 'Overcharger',
    role: 'Speed & Harvesting',
    icon: 'Flame',
    color: '#f59e0b',
    cooldownMs: 8500,
    description: 'Supercharges movement speed by +70% and multiplies all collected points by 2x for 3.5s.',
    tacticalTip: 'Activate just before entering an active Flux Conduit for exponential points.'
  },
  MINE: {
    id: 'MINE',
    name: 'Rift Engineer',
    role: 'Traps & Ambush',
    icon: 'Crosshair',
    color: '#10b981',
    cooldownMs: 7000,
    description: 'Plants a primed seismic rift mine that triggers an instant localized Aftershock when stepped on.',
    tacticalTip: 'Trap the edges of Flux zones or high-density core clusters.'
  }
};

export const GRID_SIZE = 20; // 20x20 arena matrix
export const TICK_RATE = 20; // 20 updates per sec
export const TICK_MS = 1000 / TICK_RATE;

export interface PlayerStats {
  energyCollected: number;
  hazardsDodged: number;
  abilitiesUsed: number;
  pylonsCaptured: number;
  timesStunned: number;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  character: CharacterClass;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  energyBanked: number;
  energyCarrying: number;
  isAlive: boolean;
  isReady: boolean;
  isHost: boolean;
  stunnedUntil: number;
  shieldUntil: number;
  speedBoostUntil: number;
  abilityCooldownUntil: number;
  abilityMaxCooldown: number;
  stats: PlayerStats;
  ping: number;
}

export interface EnergyNode {
  id: string;
  x: number;
  y: number;
  type: 'standard' | 'super' | 'golden';
  value: number;
  pulseOffset: number;
}

export interface FluxZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  chargeProgress: number; // 0 to 100%
  controllingPlayerId: string | null;
  isContested?: boolean;
  expiresAt: number;
}

export type HazardPattern = 'cross' | 'ring' | 'beam_horizontal' | 'beam_vertical' | 'radial_burst';

export interface GridCell {
  x: number;
  y: number;
}

export interface SeismicHazard {
  id: string;
  originX: number;
  originY: number;
  pattern: HazardPattern;
  stage: 'warning' | 'erupting' | 'dissipating';
  warnUntil: number;
  eruptUntil: number;
  affectedCells: GridCell[];
  intensity: number;
  hasDealtDamage?: boolean;
}

export interface PlacedTrap {
  id: string;
  ownerId: string;
  type: 'mine' | 'vortex';
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
}

export interface GameEvent {
  id: string;
  timestamp: number;
  type: 'STUN' | 'ABILITY' | 'CONDUIT_CAPTURE' | 'AFTERSHOCK_WAVE' | 'KILL' | 'CORE_BANK';
  message: string;
  color?: string;
}

export type GameStatus = 'LOBBY' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED';

export interface RoomSettings {
  roomCode: string;
  roomName: string;
  hasPassword: boolean;
  maxPlayers: number;
  matchDuration: number; // 60, 90, 120
  fillBots: boolean;
}

export interface RoomSummary {
  roomCode: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  hasPassword: boolean;
  status: GameStatus;
}

export interface GameSnapshot {
  tick: number;
  serverTime: number;
  status: GameStatus;
  timeRemaining: number;
  totalMatchTime: number;
  suddenDeath: boolean;
  winnerId: string | null;
  players: Record<string, PlayerState>;
  energyNodes: EnergyNode[];
  fluxZones: FluxZone[];
  hazards: SeismicHazard[];
  traps: PlacedTrap[];
  recentEvents: GameEvent[];
}

// Client to Server Packets
export interface ClientInputPacket {
  dx: number; // -1 to 1
  dy: number; // -1 to 1
}

export interface ClientUseAbilityPacket {
  targetX?: number;
  targetY?: number;
}

// Socket Events Definition
export interface ServerToClientEvents {
  roomStateUpdate: (snapshot: {
    roomSettings: RoomSettings;
    players: Record<string, PlayerState>;
    status: GameStatus;
    hostId: string;
  }) => void;
  gameSnapshot: (snapshot: GameSnapshot) => void;
  matchStarted: (initialSnapshot: GameSnapshot) => void;
  matchEnded: (finalSnapshot: GameSnapshot) => void;
  gameEvent: (event: GameEvent) => void;
  playerJoined: (player: PlayerState) => void;
  playerLeft: (playerId: string) => void;
  errorNotification: (message: string) => void;
  pong: (clientTimestamp: number) => void;
}

export interface ClientToServerEvents {
  joinRoom: (payload: {
    roomCode: string;
    playerName: string;
    password?: string;
    reconnectToken?: string;
  }, callback: (response: { success: boolean; message?: string; player?: PlayerState; token?: string }) => void) => void;
  
  createRoom: (payload: {
    playerName: string;
    roomName?: string;
    password?: string;
    matchDuration?: number;
    maxPlayers?: number;
  }, callback: (response: { success: boolean; roomCode?: string; message?: string; token?: string; player?: PlayerState }) => void) => void;

  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  selectCharacter: (character: CharacterClass) => void;
  setPlayerColor: (color: string) => void;
  startMatch: () => void;
  requestRematch: () => void;
  kickPlayer: (targetPlayerId: string) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  playerInput: (input: ClientInputPacket) => void;
  useAbility: (payload: ClientUseAbilityPacket) => void;
  ping: (clientTimestamp: number) => void;
}

import React, { useEffect, useRef } from 'react';
import {
  CharacterClass,
  GameSnapshot,
  GRID_SIZE,
  PlayerState
} from '@shared/types';
import { sound } from '../services/sound';

interface GameCanvasProps {
  snapshot: GameSnapshot | null;
  localPlayerId: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ snapshot, localPlayerId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const interpolatedPlayers = useRef<Map<string, { x: number; y: number; angle: number }>>(new Map());
  const particles = useRef<Particle[]>([]);
  const screenShake = useRef<number>(0);
  const prevHazardIds = useRef<Set<string>>(new Set());
  const prevEnergyIds = useRef<Set<string>>(new Set());

  // Detect sound triggers on state transitions
  useEffect(() => {
    if (!snapshot) return;

    // Check new hazards
    const currentHazardIds = new Set(snapshot.hazards.map((h) => h.id));
    for (const hazard of snapshot.hazards) {
      if (!prevHazardIds.current.has(hazard.id)) {
        sound.playWarningSiren();
      }
      if (hazard.stage === 'erupting') {
        screenShake.current = Math.min(12, screenShake.current + 8);
      }
    }
    prevHazardIds.current = currentHazardIds;

    // Check collected energy
    const currentEnergyIds = new Set(snapshot.energyNodes.map((n) => n.id));
    if (prevEnergyIds.current.size > 0 && currentEnergyIds.size < prevEnergyIds.current.size) {
      sound.playEnergyPickup();
    }
    prevEnergyIds.current = currentEnergyIds;
  }, [snapshot]);

  // Main 60 FPS Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      // Handle screen resize & high-DPI scaling
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const targetCanvasWidth = Math.floor(width * dpr);
      const targetCanvasHeight = Math.floor(height * dpr);

      if (canvas.width !== targetCanvasWidth || canvas.height !== targetCanvasHeight) {
        canvas.width = targetCanvasWidth;
        canvas.height = targetCanvasHeight;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const size = Math.min(width, height) * 0.94;
      const offsetX = (width - size) / 2;
      const offsetY = (height - size) / 2;
      const cellSize = size / GRID_SIZE;

      // Apply screen shake
      ctx.save();
      if (screenShake.current > 0.1) {
        const sx = (Math.random() - 0.5) * screenShake.current;
        const sy = (Math.random() - 0.5) * screenShake.current;
        ctx.translate(sx, sy);
        screenShake.current *= 0.88;
      } else {
        screenShake.current = 0;
      }

      // 1. Draw Obsidian Arena Background
      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, width, height);

      // Arena Board Backdrop
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(offsetX, offsetY, size, size);

      // Arena Outer Border with glowing cyan rim
      ctx.strokeStyle = '#00f2fe33';
      ctx.lineWidth = 3;
      ctx.strokeRect(offsetX, offsetY, size, size);

      // 2. Draw Futuristic Grid Matrix
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i++) {
        const pos = offsetX + i * cellSize;
        const isMajor = i % 5 === 0;
        ctx.strokeStyle = isMajor ? 'rgba(0, 242, 254, 0.22)' : 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.moveTo(pos, offsetY);
        ctx.lineTo(pos, offsetY + size);
        ctx.stroke();

        const posY = offsetY + i * cellSize;
        ctx.beginPath();
        ctx.moveTo(offsetX, posY);
        ctx.lineTo(offsetX + size, posY);
        ctx.stroke();
      }

      // Draw Sub-sector Center Crosshairs
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.beginPath();
      ctx.arc(offsetX + size / 2, offsetY + size / 2, cellSize * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      if (!snapshot) {
        ctx.restore(); // screen shake
        ctx.restore(); // dpr
        animId = requestAnimationFrame(render);
        return;
      }

      const now = Date.now();

      // 3. Draw Seismic Hazards ("AFTERSHOCKS")
      for (const hazard of snapshot.hazards) {
        const isErupting = hazard.stage === 'erupting';
        const warnProgress = Math.min(1, (now - (hazard.warnUntil - 1500)) / 1500);

        for (const cell of hazard.affectedCells) {
          const cx = offsetX + cell.x * cellSize;
          const cy = offsetY + cell.y * cellSize;

          if (isErupting) {
            // Erupting: blazing neon hazard flare + electrical discharge
            ctx.fillStyle = 'rgba(255, 0, 85, 0.45)';
            ctx.fillRect(cx, cy, cellSize, cellSize);

            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);

            // Lightning zig-zag
            ctx.strokeStyle = '#00f2fe';
            ctx.beginPath();
            ctx.moveTo(cx + Math.random() * cellSize, cy);
            ctx.lineTo(cx + Math.random() * cellSize, cy + cellSize);
            ctx.stroke();
          } else {
            // Warning stage: pulsating striped danger box
            const alpha = 0.15 + Math.sin(time * 0.015) * 0.12;
            ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
            ctx.fillRect(cx, cy, cellSize, cellSize);

            ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);

            // Warning diagonal stripes
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + cellSize, cy + cellSize);
            ctx.stroke();
          }
        }

        // Draw Epicenter Pulse
        const ex = offsetX + (hazard.originX + 0.5) * cellSize;
        const ey = offsetY + (hazard.originY + 0.5) * cellSize;
        const ringRadius = (time * 0.08) % (cellSize * 3.5);

        ctx.strokeStyle = isErupting ? '#ff0055' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ey, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Draw Flux Conduits (Pylons)
      for (const zone of snapshot.fluxZones) {
        const zx = offsetX + zone.x * cellSize;
        const zy = offsetY + zone.y * cellSize;
        const zRadius = zone.radius * cellSize;

        // Glowing outer boundary
        ctx.fillStyle = 'rgba(0, 242, 254, 0.07)';
        ctx.beginPath();
        ctx.arc(zx, zy, zRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(zx, zy, zRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rotating Conduit Core
        ctx.save();
        ctx.translate(zx, zy);
        ctx.rotate(time * 0.002);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.strokeRect(-cellSize * 0.7, -cellSize * 0.7, cellSize * 1.4, cellSize * 1.4);
        ctx.restore();

        // Charge Progress Ring
        if (zone.chargeProgress > 0) {
          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(
            zx,
            zy,
            zRadius * 0.85,
            -Math.PI / 2,
            -Math.PI / 2 + (zone.chargeProgress / 100) * Math.PI * 2
          );
          ctx.stroke();
        }

        // Label (Contested or Charge %)
        if (zone.isContested) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = `bold ${Math.max(10, cellSize * 0.42)}px Orbitron`;
          ctx.textAlign = 'center';
          ctx.fillText(`⚡ CONTESTED ⚡`, zx, zy + zRadius + 14);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(10, cellSize * 0.4)}px Orbitron`;
          ctx.textAlign = 'center';
          ctx.fillText(`FLUX ${Math.round(zone.chargeProgress)}%`, zx, zy + zRadius + 14);
        }
      }

      // 5. Draw Placed Traps (Mines & Vortices)
      for (const trap of snapshot.traps) {
        const tx = offsetX + trap.x * cellSize;
        const ty = offsetY + trap.y * cellSize;
        const isOwner = trap.ownerId === localPlayerId;

        if (trap.type === 'mine') {
          // Mine indicator (visible to owner, faint to enemies)
          ctx.fillStyle = isOwner ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.15)';
          ctx.beginPath();
          ctx.arc(tx, ty, cellSize * 0.35, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tx, ty, cellSize * 0.35 + Math.sin(time * 0.01) * 3, 0, Math.PI * 2);
          ctx.stroke();
        } else if (trap.type === 'vortex') {
          // Singularity swirl
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(-time * 0.006);
          const vRadius = trap.radius * cellSize;
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, vRadius, 0, Math.PI * 1.5);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 6. Draw Energy Nodes (Sparks)
      for (const node of snapshot.energyNodes) {
        const nx = offsetX + node.x * cellSize;
        const ny = offsetY + node.y * cellSize;
        const bounce = Math.sin(time * 0.005 + node.pulseOffset) * 2;
        const nSize = cellSize * 0.32;

        ctx.save();
        ctx.translate(nx, ny + bounce);

        if (node.type === 'golden') {
          // Blazing gold core
          ctx.fillStyle = '#f59e0b';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 12;
          ctx.rotate(time * 0.004);
          ctx.fillRect(-nSize / 2, -nSize / 2, nSize, nSize);
        } else if (node.type === 'super') {
          // Violet super node
          ctx.fillStyle = '#c084fc';
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(0, 0, nSize * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard cyan spark
          ctx.fillStyle = '#00f2fe';
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, nSize * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 7. Update & Draw Particles (capped at 200 to prevent runaway memory usage)
      if (particles.current.length > 200) {
        particles.current.splice(0, particles.current.length - 200);
      }
      for (let pIdx = particles.current.length - 1; pIdx >= 0; pIdx--) {
        const p = particles.current[pIdx];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.life -= dt;
        if (p.life <= 0) {
          particles.current.splice(pIdx, 1);
          continue;
        }

        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1.0;

      // 8. Draw Players (with smooth interpolation)
      for (const player of Object.values(snapshot.players)) {
        if (!player.isAlive) continue;

        let interp = interpolatedPlayers.current.get(player.id);
        if (!interp) {
          interp = { x: player.x, y: player.y, angle: 0 };
          interpolatedPlayers.current.set(player.id, interp);
        }

        // Smooth position interpolation (lerp)
        interp.x += (player.x - interp.x) * Math.min(1, dt * 18);
        interp.y += (player.y - interp.y) * Math.min(1, dt * 18);

        // Rotation towards movement vector
        if (Math.hypot(player.vx, player.vy) > 0.05) {
          const targetAngle = Math.atan2(player.vy, player.vx);
          interp.angle = targetAngle;

          // Spawn thruster particles
          if (Math.random() < 0.35) {
            particles.current.push({
              x: offsetX + interp.x * cellSize - Math.cos(targetAngle) * cellSize * 0.4,
              y: offsetY + interp.y * cellSize - Math.sin(targetAngle) * cellSize * 0.4,
              vx: -Math.cos(targetAngle) * (Math.random() * 0.8 + 0.3),
              vy: -Math.sin(targetAngle) * (Math.random() * 0.8 + 0.3),
              life: 0.25,
              maxLife: 0.25,
              color: player.color,
              size: Math.random() * 3 + 2
            });
          }
        }

        const px = offsetX + interp.x * cellSize;
        const py = offsetY + interp.y * cellSize;
        const pRadius = cellSize * 0.46;
        const isLocal = player.id === localPlayerId;

        ctx.save();
        ctx.translate(px, py);

        // Draw Force Shield Bubble (if active)
        if (now < player.shieldUntil) {
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 0, pRadius * 1.45, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw Overcharge Surge Sparks (if active)
        if (now < player.speedBoostUntil) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(0, 0, pRadius * 1.25, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw Player Hull (Oriented triangle / hovercraft)
        ctx.rotate(interp.angle);
        ctx.fillStyle = player.color;
        ctx.shadowColor = player.color;
        ctx.shadowBlur = isLocal ? 16 : 8;

        ctx.beginPath();
        ctx.moveTo(pRadius * 1.1, 0);
        ctx.lineTo(-pRadius * 0.8, -pRadius * 0.7);
        ctx.lineTo(-pRadius * 0.4, 0);
        ctx.lineTo(-pRadius * 0.8, pRadius * 0.7);
        ctx.closePath();
        ctx.fill();

        // Inner Cockpit Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, pRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Stunned Visual Indicator
        if (now < player.stunnedUntil) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ STUNNED ⚡', px, py - pRadius - 8);
        }

        // Player Name Tag & Score
        ctx.fillStyle = isLocal ? '#00f2fe' : '#ffffff';
        ctx.font = `${isLocal ? 'bold' : 'normal'} 11px Rajdhani, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(player.name, px, py + pRadius + 14);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(`${player.score} pts`, px, py + pRadius + 26);

        // Highlight ring around local player
        if (isLocal) {
          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(px, py, pRadius * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      ctx.restore(); // screen shake
      ctx.restore(); // dpr
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [snapshot, localPlayerId]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-obsidian-950">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair touch-none select-none"
      />
    </div>
  );
};

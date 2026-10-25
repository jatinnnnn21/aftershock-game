import React, { useState, useEffect, useRef } from 'react';
import {
  CharacterClass,
  CHARACTER_DEFS,
  GRID_SIZE
} from '@shared/types';
import { sound } from '../services/sound';
import { CheckCircle2, ChevronRight, RotateCcw, Trophy, Zap } from 'lucide-react';

interface InteractiveTutorialProps {
  onComplete: () => void;
  onExit: () => void;
}

type TutorialStep = 'NAV' | 'ENERGY' | 'HAZARD' | 'ABILITY' | 'SPAR' | 'DONE';

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  onComplete,
  onExit
}) => {
  const [step, setStep] = useState<TutorialStep>('NAV');
  const [playerX, setPlayerX] = useState<number>(10);
  const [playerY, setPlayerY] = useState<number>(10);
  const [charClass, setCharClass] = useState<CharacterClass>('BLINK');
  const [energyCollected, setEnergyCollected] = useState<number>(0);
  const [checkpointsReached, setCheckpointsReached] = useState<number>(0);
  const [hazardDodged, setHazardDodged] = useState<boolean>(false);
  const [abilityUsed, setAbilityUsed] = useState<boolean>(false);
  const [sparScore, setSparScore] = useState<number>(0);
  const [sparTimer, setSparTimer] = useState<number>(20);
  const [botPos, setBotPos] = useState<{ x: number; y: number }>({ x: 4, y: 4 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysDown = useRef<Set<string>>(new Set());

  // Input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDown.current.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyE') {
        triggerAbility();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [step, playerX, playerY]);

  const triggerAbility = () => {
    sound.playAbility(charClass);
    if (charClass === 'BLINK') {
      setPlayerX((prev) => Math.max(1, Math.min(GRID_SIZE - 2, prev + 3)));
    }
    setAbilityUsed(true);
    if (step === 'ABILITY') {
      sound.playEnergyPickup(true);
      setTimeout(() => setStep('SPAR'), 1000);
    }
  };

  // Main Tutorial Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let localX = playerX;
    let localY = playerY;

    // Spar timer interval
    let timerInterval: any = null;
    if (step === 'SPAR') {
      timerInterval = setInterval(() => {
        setSparTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            setStep('DONE');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    const render = (time: number) => {
      // Read keys
      let dx = 0;
      let dy = 0;
      if (keysDown.current.has('KeyW') || keysDown.current.has('ArrowUp')) dy -= 1;
      if (keysDown.current.has('KeyS') || keysDown.current.has('ArrowDown')) dy += 1;
      if (keysDown.current.has('KeyA') || keysDown.current.has('ArrowLeft')) dx -= 1;
      if (keysDown.current.has('KeyD') || keysDown.current.has('ArrowRight')) dx += 1;

      const len = Math.hypot(dx, dy);
      if (len > 0) {
        localX += (dx / len) * 0.18;
        localY += (dy / len) * 0.18;
        localX = Math.max(1, Math.min(GRID_SIZE - 1, localX));
        localY = Math.max(1, Math.min(GRID_SIZE - 1, localY));
        setPlayerX(localX);
        setPlayerY(localY);
      }

      // Render on Canvas
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const size = Math.min(width, height) * 0.92;
      const offsetX = (width - size) / 2;
      const offsetY = (height - size) / 2;
      const cellSize = size / GRID_SIZE;

      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, width, height);

      // Arena Grid
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + size, offsetY + i * cellSize);
        ctx.stroke();
      }

      // Step 1: Nav Checkpoints
      if (step === 'NAV') {
        const checkpoints = [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 10, y: 15 }
        ];
        const activeCp = checkpoints[checkpointsReached];
        if (activeCp) {
          const cx = offsetX + activeCp.x * cellSize;
          const cy = offsetY + activeCp.y * cellSize;

          ctx.fillStyle = 'rgba(0, 242, 254, 0.25)';
          ctx.beginPath();
          ctx.arc(cx, cy, cellSize * 0.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, cellSize * 0.8 + Math.sin(time * 0.01) * 4, 0, Math.PI * 2);
          ctx.stroke();

          // Check hit
          if (Math.hypot(localX - activeCp.x, localY - activeCp.y) < 1.0) {
            sound.playEnergyPickup();
            const nextCount = checkpointsReached + 1;
            setCheckpointsReached(nextCount);
            if (nextCount >= 3) {
              setStep('ENERGY');
            }
          }
        }
      }

      // Step 2: Energy Sparks
      if (step === 'ENERGY' || step === 'SPAR') {
        const energySparks = [
          { x: 6, y: 8 },
          { x: 14, y: 8 },
          { x: 8, y: 14 },
          { x: 12, y: 14 }
        ];
        for (const sp of energySparks) {
          const sx = offsetX + sp.x * cellSize;
          const sy = offsetY + sp.y * cellSize;
          ctx.fillStyle = '#00f2fe';
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(sx, sy, cellSize * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          if (Math.hypot(localX - sp.x, localY - sp.y) < 0.85) {
            sound.playEnergyPickup();
            setEnergyCollected((prev) => {
              const next = prev + 1;
              if (step === 'ENERGY' && next >= 3) {
                setStep('HAZARD');
              }
              return next;
            });
            if (step === 'SPAR') {
              setSparScore((prev) => prev + 10);
            }
          }
        }
      }

      // Step 3: Hazard Wave Simulation
      if (step === 'HAZARD') {
        const hazardCol = 10;
        const hx = offsetX + hazardCol * cellSize;
        const isErupting = Math.sin(time * 0.003) > 0;

        ctx.fillStyle = isErupting ? 'rgba(255, 0, 85, 0.4)' : 'rgba(245, 158, 11, 0.2)';
        ctx.fillRect(hx, offsetY, cellSize, size);
        ctx.strokeStyle = isErupting ? '#ff0055' : '#f59e0b';
        ctx.strokeRect(hx, offsetY, cellSize, size);

        if (Math.abs(localX - hazardCol) < 0.6) {
          if (isErupting) {
            sound.playSeismicEruption();
            // Knockback
            localX = localX > hazardCol ? 12 : 8;
            setPlayerX(localX);
          }
        } else if (localX > 13) {
          setHazardDodged(true);
          sound.playEnergyPickup(true);
          setStep('ABILITY');
        }
      }

      // Step 5: Sparring AI Bot
      if (step === 'SPAR') {
        // Move bot gently towards center
        const bx = offsetX + botPos.x * cellSize;
        const by = offsetY + botPos.y * cellSize;
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(bx, by, cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('TRAINER BOT', bx, by + cellSize * 0.7);
      }

      // Draw Player Ship
      const px = offsetX + localX * cellSize;
      const py = offsetY + localY * cellSize;
      const pRad = cellSize * 0.45;

      ctx.fillStyle = '#00f2fe';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(px, py - pRad);
      ctx.lineTo(px + pRad, py + pRad);
      ctx.lineTo(px, py + pRad * 0.5);
      ctx.lineTo(px - pRad, py + pRad);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [step, checkpointsReached]);

  return (
    <div className="relative w-full h-screen bg-obsidian-950 flex flex-col font-sans select-none">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 bg-obsidian-900/90 px-6 py-4 backdrop-blur-md">
        <div>
          <span className="font-display text-xs text-cyan-400 uppercase tracking-widest">
            SIMULATED TRAINING PROTOCOL
          </span>
          <h2 className="font-display text-lg font-black text-slate-100">
            AFTERSHOCK FLIGHT ACADEMY
          </h2>
        </div>

        <button
          onClick={onExit}
          className="rounded-lg border border-slate-700 bg-obsidian-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition"
        >
          Exit to Lobby
        </button>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4">
        {/* Instruction Card Floating on Top */}
        <div className="absolute top-6 z-20 max-w-lg rounded-2xl border border-cyan-500/40 bg-obsidian-900/95 p-5 shadow-2xl backdrop-blur-lg text-center">
          {step === 'NAV' && (
            <div>
              <span className="text-xs font-mono text-cyan-400">STAGE 1 / 4 — NAVIGATION</span>
              <h3 className="font-display text-base font-bold text-slate-100 mt-1">
                Fly Through the 3 Cyan Checkpoint Beacons
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Use <strong className="text-cyan-300">WASD</strong> or{' '}
                <strong className="text-cyan-300">Arrow Keys</strong> to maneuver your ship.
              </p>
              <div className="mt-2 font-mono text-xs font-bold text-cyan-400">
                Checkpoints Hit: {checkpointsReached} / 3
              </div>
            </div>
          )}

          {step === 'ENERGY' && (
            <div>
              <span className="text-xs font-mono text-cyan-400">STAGE 2 / 4 — ENERGY HARVESTING</span>
              <h3 className="font-display text-base font-bold text-slate-100 mt-1">
                Collect 3 Glowing Energy Sparks
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Energy sparks award points to win matches. Touch the glowing nodes to gather them.
              </p>
              <div className="mt-2 font-mono text-xs font-bold text-cyan-400">
                Harvested: {energyCollected} / 3
              </div>
            </div>
          )}

          {step === 'HAZARD' && (
            <div>
              <span className="text-xs font-mono text-hazard-warning">STAGE 3 / 4 — SEISMIC HAZARDS</span>
              <h3 className="font-display text-base font-bold text-hazard-warning mt-1">
                Survive & Cross the Expanding AFTERSHOCK Wave
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Flashing orange sectors are seismic warning lines. When they flash red, they stun you and drop your energy. Reach the right side safely!
              </p>
            </div>
          )}

          {step === 'ABILITY' && (
            <div>
              <span className="text-xs font-mono text-cyan-400">STAGE 4 / 4 — ABILITY DEPLOYMENT</span>
              <h3 className="font-display text-base font-bold text-slate-100 mt-1">
                Trigger Your Pilot Ability
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Press <strong className="text-cyan-300">[SPACE]</strong> or{' '}
                <strong className="text-cyan-300">[E]</strong> to activate{' '}
                <strong className="text-cyan-300">{CHARACTER_DEFS[charClass].name}</strong>.
              </p>
              <button
                onClick={triggerAbility}
                className="mt-3 rounded-xl border border-cyan-400 bg-cyan-500/20 px-6 py-2 font-display text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition shadow-lg shadow-cyan-500/20"
              >
                <Zap className="inline-block w-4 h-4 mr-1" /> FIRE ABILITY
              </button>
            </div>
          )}

          {step === 'SPAR' && (
            <div>
              <span className="text-xs font-mono text-violet-400">PRACTICE ARENA SPAR</span>
              <h3 className="font-display text-base font-bold text-slate-100 mt-1">
                Live Drone Sparring Match
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Harvest sparks and practice maneuvers before the clock runs out!
              </p>
              <div className="mt-2 flex justify-center gap-4 font-mono text-xs font-bold">
                <span className="text-cyan-400">Score: {sparScore} pts</span>
                <span className="text-hazard-warning">Time: {sparTimer}s</span>
              </div>
            </div>
          )}

          {step === 'DONE' && (
            <div className="py-2">
              <Trophy className="mx-auto h-12 w-12 text-yellow-400 animate-bounce" />
              <h3 className="font-display text-lg font-black text-slate-100 mt-2">
                TRAINING COMPLETE!
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                You are fully certified for live multiplayer combat in the Obsidian Core.
              </p>
              <button
                onClick={onComplete}
                className="mt-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-8 py-3 font-display text-xs font-bold text-white shadow-xl shadow-cyan-500/30 hover:opacity-90 transition"
              >
                Enter Multiplayer Lobby
              </button>
            </div>
          )}
        </div>

        {/* Canvas Display with Touch Navigation */}
        <canvas
          ref={canvasRef}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((touch.clientX - rect.left) / rect.width) * GRID_SIZE;
            const relY = ((touch.clientY - rect.top) / rect.height) * GRID_SIZE;
            setPlayerX(Math.max(1, Math.min(GRID_SIZE - 1, relX)));
            setPlayerY(Math.max(1, Math.min(GRID_SIZE - 1, relY)));
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((touch.clientX - rect.left) / rect.width) * GRID_SIZE;
            const relY = ((touch.clientY - rect.top) / rect.height) * GRID_SIZE;
            setPlayerX(Math.max(1, Math.min(GRID_SIZE - 1, relX)));
            setPlayerY(Math.max(1, Math.min(GRID_SIZE - 1, relY)));
          }}
          className="w-full h-full max-w-2xl max-h-2xl rounded-2xl border border-cyan-500/30 shadow-2xl block touch-none"
        />
      </div>
    </div>
  );
};

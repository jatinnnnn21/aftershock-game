import React, { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import { CharacterDef } from '@shared/types';

interface VirtualJoystickProps {
  onMove: (dx: number, dy: number) => void;
  onAbility: () => void;
  characterDef?: CharacterDef;
  cooldownRemainingMs: number;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onMove,
  onAbility,
  characterDef,
  cooldownRemainingMs
}) => {
  const [touchActive, setTouchActive] = useState<boolean>(false);
  const [stickPos, setStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchIdRef = useRef<number | null>(null);

  const isAbilityReady = cooldownRemainingMs <= 0;
  const cooldownFraction = characterDef
    ? Math.max(0, Math.min(1, cooldownRemainingMs / characterDef.cooldownMs))
    : 0;

  // Handle Joystick Touch
  const handleTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touchStartRef.current === null) {
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        touchIdRef.current = touch.identifier;
        setTouchActive(true);
        break;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const maxRadius = 45;
        const dist = Math.hypot(deltaX, deltaY);

        let clampedX = deltaX;
        let clampedY = deltaY;
        if (dist > maxRadius) {
          clampedX = (deltaX / dist) * maxRadius;
          clampedY = (deltaY / dist) * maxRadius;
        }

        setStickPos({ x: clampedX, y: clampedY });
        onMove(clampedX / maxRadius, clampedY / maxRadius);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        touchStartRef.current = null;
        touchIdRef.current = null;
        setTouchActive(false);
        setStickPos({ x: 0, y: 0 });
        onMove(0, 0);
        break;
      }
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex justify-between items-end p-6 select-none md:hidden">
      {/* Virtual D-Pad / Thumbstick */}
      <div
        className="pointer-events-auto relative w-28 h-28 rounded-full border-2 border-cyan-500/30 bg-obsidian-900/60 backdrop-blur-md flex items-center justify-center touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Thumb Nub */}
        <div
          className={`w-12 h-12 rounded-full border border-cyan-400 bg-cyan-500/50 shadow-lg shadow-cyan-500/30 transition-transform ${
            touchActive ? 'scale-110' : ''
          }`}
          style={{
            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`
          }}
        />
        <span className="absolute text-[9px] font-mono text-cyan-300/40 uppercase tracking-widest pointer-events-none">
          MOVE
        </span>
      </div>

      {/* Ability Fire Button */}
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <button
          onClick={onAbility}
          disabled={!isAbilityReady}
          className={`relative w-20 h-20 rounded-full border-2 flex items-center justify-center font-display font-bold text-xs uppercase shadow-xl transition-all active:scale-95 touch-none ${
            isAbilityReady
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-cyan-500/30'
              : 'border-slate-700 bg-obsidian-900/80 text-slate-500'
          }`}
        >
          {/* Radial Cooldown Overlay */}
          {!isAbilityReady && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="38"
                cy="38"
                r="34"
                fill="none"
                stroke="rgba(255, 0, 85, 0.4)"
                strokeWidth="6"
                strokeDasharray="213"
                strokeDashoffset={213 * (1 - cooldownFraction)}
              />
            </svg>
          )}

          <div className="flex flex-col items-center">
            <Zap className={`w-6 h-6 mb-0.5 ${isAbilityReady ? 'text-cyan-400' : 'text-slate-600'}`} />
            <span>
              {isAbilityReady ? 'ACTIVATE' : `${(cooldownRemainingMs / 1000).toFixed(1)}s`}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

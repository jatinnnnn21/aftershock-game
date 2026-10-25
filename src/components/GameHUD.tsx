import React from 'react';
import {
  CharacterDef,
  CHARACTER_DEFS,
  GameSnapshot,
  PlayerState
} from '@shared/types';
import {
  AlertTriangle,
  Clock,
  Flame,
  Radio,
  Shield,
  Volume2,
  VolumeX,
  Wifi,
  Zap
} from 'lucide-react';
import { sound } from '../services/sound';

interface GameHUDProps {
  snapshot: GameSnapshot;
  localPlayer: PlayerState | null;
  onUseAbility: () => void;
  pingMs: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  snapshot,
  localPlayer,
  onUseAbility,
  pingMs
}) => {
  const [muted, setMuted] = React.useState<boolean>(sound.isMuted);

  const toggleSound = () => {
    const next = !muted;
    sound.setMuted(next);
    setMuted(next);
  };

  const charDef: CharacterDef | undefined = localPlayer
    ? CHARACTER_DEFS[localPlayer.character]
    : undefined;

  const now = Date.now();
  const cooldownRemaining = localPlayer
    ? Math.max(0, localPlayer.abilityCooldownUntil - now)
    : 0;
  const isAbilityReady = cooldownRemaining <= 0;
  const isStunned = localPlayer ? now < localPlayer.stunnedUntil : false;

  // Active Seismic Warning
  const activeWarningHazard = snapshot.hazards.find((h) => h.stage === 'warning');

  // Sorted Leaderboard
  const sortedPlayers = Object.values(snapshot.players).sort(
    (a, b) => b.score - a.score
  );
  const myRank = localPlayer
    ? sortedPlayers.findIndex((p) => p.id === localPlayer.id) + 1
    : 1;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 md:p-6 select-none font-sans">
      {/* Top Header Bar */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: Player Profile & Rank */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-obsidian-900/80 p-2.5 backdrop-blur-md shadow-lg shadow-black/50">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg font-display text-sm font-black shadow-inner"
            style={{ backgroundColor: localPlayer?.color || '#00f2fe' }}
          >
            #{myRank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-bold text-slate-100 tracking-wider">
                {localPlayer?.name || 'PILOT'}
              </span>
              <span className="rounded bg-cyan-950 px-1.5 py-0.5 font-mono text-[10px] text-cyan-400 border border-cyan-800">
                {charDef?.name}
              </span>
            </div>
            <div className="font-mono text-sm font-black text-cyan-300">
              {localPlayer?.score || 0}{' '}
              <span className="text-[10px] text-slate-400 font-normal">PTS</span>
            </div>
          </div>
        </div>

        {/* Center: Match Countdown Timer */}
        <div className="flex flex-col items-center">
          <div
            className={`flex items-center gap-2 rounded-2xl border px-5 py-2 backdrop-blur-lg shadow-xl transition-all ${
              snapshot.timeRemaining <= 15
                ? 'border-hazard-danger/80 bg-hazard-danger/20 text-hazard-danger animate-pulse-fast'
                : 'border-cyan-500/30 bg-obsidian-900/80 text-cyan-300'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span className="font-mono text-2xl font-black tracking-widest">
              {formatTimer(snapshot.timeRemaining)}
            </span>
          </div>
          {snapshot.suddenDeath && (
            <span className="mt-1 font-display text-[10px] font-bold text-hazard-danger uppercase tracking-widest animate-pulse">
              ⚡ SUDDEN DEATH OVERTIME ⚡
            </span>
          )}
        </div>

        {/* Right: Leaderboard & Network/Sound Utilities */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Sound & Ping Utility Pill */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-obsidian-900/80 px-2.5 py-1 text-xs text-slate-400">
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <Wifi className="h-3 w-3 text-cyan-400" />
              <span>{pingMs}ms</span>
            </div>
            <button
              onClick={toggleSound}
              className="hover:text-cyan-300 transition-colors"
              title="Toggle Audio"
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5 text-slate-500" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
              )}
            </button>
          </div>

          {/* Mini Top 3 Leaderboard */}
          <div className="hidden sm:flex flex-col gap-1 rounded-xl border border-slate-800/80 bg-obsidian-900/70 p-2 text-xs backdrop-blur-md min-w-[140px]">
            <span className="font-display text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
              Top Standings
            </span>
            {sortedPlayers.slice(0, 3).map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between font-mono text-[11px]"
              >
                <span className="flex items-center gap-1.5 truncate max-w-[90px]">
                  <span
                    className="h-2 w-2 rounded-full inline-block"
                    style={{ backgroundColor: p.color }}
                  />
                  <span
                    className={
                      p.id === localPlayer?.id ? 'text-cyan-300 font-bold' : 'text-slate-300'
                    }
                  >
                    {p.name}
                  </span>
                </span>
                <span className="font-bold text-slate-200">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle Banner: Seismic Hazard Warning Siren */}
      {activeWarningHazard && (
        <div className="mx-auto flex items-center gap-3 rounded-full border border-hazard-warning bg-obsidian-950/90 px-6 py-2.5 shadow-2xl shadow-hazard-warning/30 backdrop-blur-md animate-pulse">
          <AlertTriangle className="h-5 w-5 text-hazard-warning animate-bounce" />
          <div className="flex flex-col text-center">
            <span className="font-display text-xs font-black uppercase tracking-wider text-hazard-warning">
              SEISMIC AFTERSHOCK DETECTED
            </span>
            <span className="font-mono text-[10px] text-slate-300">
              Clear highlighted hazard zones immediately!
            </span>
          </div>
        </div>
      )}

      {/* Event Feed (Kill / Action Ticker) */}
      <div className="hidden sm:flex flex-col gap-1 max-w-sm pointer-events-none self-start mb-2">
        {snapshot.recentEvents.slice(-3).map((evt) => (
          <div
            key={evt.id}
            className="rounded-lg border border-slate-800/70 bg-obsidian-950/70 px-3 py-1 font-mono text-[11px] text-slate-300 backdrop-blur-sm animate-fade-in shadow-md"
          >
            {evt.message}
          </div>
        ))}
      </div>

      {/* Bottom Center: Ability Bar (Desktop) */}
      <div className="hidden md:flex flex-col items-center gap-1 self-center pointer-events-auto">
        {isStunned && (
          <div className="rounded-full bg-hazard-warning/20 border border-hazard-warning px-4 py-1 font-display text-xs font-bold text-hazard-warning uppercase tracking-widest animate-pulse mb-1">
            SYSTEM DISRUPTED — THRUSTERS LOCKED
          </div>
        )}
        <div className="flex items-center gap-4 rounded-2xl border border-cyan-500/30 bg-obsidian-900/90 p-3 backdrop-blur-lg shadow-2xl shadow-black/80">
          {/* Ability Icon & Trigger */}
          <button
            onClick={onUseAbility}
            disabled={!isAbilityReady || isStunned}
            className={`group relative flex h-14 w-14 items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${
              isAbilityReady && !isStunned
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/30 hover:bg-cyan-500/30'
                : 'border-slate-800 bg-obsidian-950/60 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Zap className="h-7 w-7" />
            {!isAbilityReady && (
              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-black text-slate-300 bg-obsidian-950/70 rounded-xl">
                {(cooldownRemaining / 1000).toFixed(1)}s
              </span>
            )}
          </button>

          {/* Ability Info & Tip */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-slate-100">
                {charDef?.name}
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300 font-bold">
                [SPACE] or [E]
              </span>
            </div>
            <span className="font-sans text-xs text-slate-400 max-w-xs">
              {charDef?.description}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

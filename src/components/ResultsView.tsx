import React from 'react';
import {
  CharacterDef,
  CHARACTER_DEFS,
  GameSnapshot,
  PlayerState
} from '@shared/types';
import { Award, Flame, Medal, RotateCcw, Shield, Trophy, Users, Zap } from 'lucide-react';
import { sound } from '../services/sound';

interface ResultsViewProps {
  snapshot: GameSnapshot;
  localPlayerId: string;
  onRematch: () => void;
  onLeave: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  snapshot,
  localPlayerId,
  onRematch,
  onLeave
}) => {
  const sortedPlayers = Object.values(snapshot.players).sort(
    (a, b) => b.score - a.score
  );
  const winner = sortedPlayers[0];
  const isWinner = winner && winner.id === localPlayerId;

  return (
    <div className="relative min-h-screen w-full bg-obsidian-950 p-4 md:p-8 flex flex-col items-center justify-center font-sans select-none overflow-y-auto">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,254,0.08)_0,transparent_70%)] pointer-events-none" />

      {/* Main Results Card */}
      <div className="relative z-10 w-full max-w-3xl rounded-3xl border border-cyan-500/30 bg-obsidian-900/95 p-6 md:p-10 shadow-2xl backdrop-blur-xl">
        {/* Header Banner */}
        <div className="text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">
            MATCH TERMINATION SEQUENCE COMPLETE
          </span>
          <h1 className="mt-1 font-display text-3xl md:text-4xl font-black tracking-wider text-slate-100">
            {isWinner ? (
              <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                🏆 CHAMPION OF THE CORE 🏆
              </span>
            ) : (
              <span>MATCH RESULTS</span>
            )}
          </h1>
          <p className="mt-1 font-mono text-sm text-slate-400">
            Winner: <strong className="text-cyan-300">{winner?.name}</strong> with{' '}
            <strong className="text-yellow-400">{winner?.score}</strong> Energy Points
          </p>
        </div>

        {/* Podium Display (Top 3) */}
        <div className="mt-8 flex items-end justify-center gap-3 sm:gap-6">
          {/* 2nd Place */}
          {sortedPlayers[1] && (
            <div className="flex flex-col items-center">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center font-display font-black text-sm text-obsidian-950 shadow-lg mb-2"
                style={{ backgroundColor: sortedPlayers[1].color }}
              >
                2
              </div>
              <span className="font-display text-xs font-bold text-slate-200 truncate max-w-[90px]">
                {sortedPlayers[1].name}
              </span>
              <span className="font-mono text-xs text-slate-400">
                {sortedPlayers[1].score} pts
              </span>
              <div className="mt-2 h-20 w-20 sm:w-24 rounded-t-xl bg-slate-800/80 border-t-2 border-slate-400 flex items-center justify-center font-display font-bold text-slate-400 text-sm">
                SILVER
              </div>
            </div>
          )}

          {/* 1st Place */}
          {winner && (
            <div className="flex flex-col items-center">
              <Trophy className="h-7 w-7 text-yellow-400 animate-bounce mb-1" />
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center font-display font-black text-lg text-obsidian-950 shadow-xl mb-2 ring-4 ring-yellow-400/50"
                style={{ backgroundColor: winner.color }}
              >
                1
              </div>
              <span className="font-display text-sm font-bold text-yellow-300 truncate max-w-[110px]">
                {winner.name}
              </span>
              <span className="font-mono text-sm font-black text-yellow-400">
                {winner.score} pts
              </span>
              <div className="mt-2 h-28 w-24 sm:w-32 rounded-t-xl bg-gradient-to-t from-yellow-500/20 to-yellow-500/40 border-t-4 border-yellow-400 flex items-center justify-center font-display font-black text-yellow-400 text-base shadow-lg shadow-yellow-500/20">
                GOLD
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {sortedPlayers[2] && (
            <div className="flex flex-col items-center">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center font-display font-black text-sm text-obsidian-950 shadow-lg mb-2"
                style={{ backgroundColor: sortedPlayers[2].color }}
              >
                3
              </div>
              <span className="font-display text-xs font-bold text-slate-200 truncate max-w-[90px]">
                {sortedPlayers[2].name}
              </span>
              <span className="font-mono text-xs text-slate-400">
                {sortedPlayers[2].score} pts
              </span>
              <div className="mt-2 h-14 w-20 sm:w-24 rounded-t-xl bg-amber-950/60 border-t-2 border-amber-600 flex items-center justify-center font-display font-bold text-amber-500 text-sm">
                BRONZE
              </div>
            </div>
          )}
        </div>

        {/* Detailed Statistics Table */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-obsidian-950/70">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-obsidian-850 text-slate-400">
                <th className="p-3">Pilot</th>
                <th className="p-3 text-right">Class</th>
                <th className="p-3 text-right">Points</th>
                <th className="p-3 text-right">Harvested</th>
                <th className="p-3 text-right">Conduits</th>
                <th className="p-3 text-right">Hazards Dodged</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`border-b border-slate-800/50 transition-colors ${
                    p.id === localPlayerId ? 'bg-cyan-950/20' : 'hover:bg-obsidian-850/40'
                  }`}
                >
                  <td className="p-3 flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full inline-block"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="font-bold text-slate-200">{p.name}</span>
                    {p.id === localPlayerId && (
                      <span className="text-[10px] text-cyan-400">(YOU)</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-slate-400">{CHARACTER_DEFS[p.character].name}</td>
                  <td className="p-3 text-right font-black text-cyan-300">{p.score}</td>
                  <td className="p-3 text-right text-slate-300">{p.stats.energyCollected}</td>
                  <td className="p-3 text-right text-slate-300">{p.stats.pylonsCaptured}</td>
                  <td className="p-3 text-right text-slate-300">{p.stats.hazardsDodged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => {
              sound.playClick();
              onRematch();
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-8 py-3.5 font-display text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-cyan-500/25 hover:opacity-90 active:scale-95 transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Rematch / Return to Lobby</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onLeave();
            }}
            className="rounded-xl border border-slate-700 bg-obsidian-850 px-6 py-3.5 font-display text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition"
          >
            Exit to Title
          </button>
        </div>
      </div>
    </div>
  );
};

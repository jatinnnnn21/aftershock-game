import React, { useState } from 'react';
import {
  CharacterClass,
  CHARACTER_DEFS,
  PlayerState,
  RoomSettings
} from '@shared/types';
import {
  Check,
  CheckCircle,
  Copy,
  Crown,
  Lock,
  Play,
  RotateCcw,
  Settings2,
  Share2,
  Shield,
  User,
  Users,
  Zap
} from 'lucide-react';
import { sound } from '../services/sound';

interface LobbyViewProps {
  roomSettings: RoomSettings;
  players: Record<string, PlayerState>;
  localPlayerId: string;
  hostId: string;
  onSetReady: (ready: boolean) => void;
  onSelectCharacter: (char: CharacterClass) => void;
  onSetColor: (color: string) => void;
  onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  onStartMatch: () => void;
  onKickPlayer?: (playerId: string) => void;
  onLeaveRoom: () => void;
}

const COLOR_OPTIONS = [
  '#00f2fe', // Electric Cyan
  '#a855f7', // Neon Violet
  '#ff0055', // Hazard Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6'  // Cobalt Blue
];

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomSettings,
  players,
  localPlayerId,
  hostId,
  onSetReady,
  onSelectCharacter,
  onSetColor,
  onUpdateSettings,
  onStartMatch,
  onKickPlayer,
  onLeaveRoom
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const localPlayer = players[localPlayerId];
  const isHost = localPlayerId === hostId;
  const playerList = Object.values(players);
  const allReady = playerList.every((p) => p.isReady);
  const canStart = isHost && (playerList.length >= 2 || roomSettings.fillBots) && allReady;

  const copyRoomCode = () => {
    sound.playClick();
    navigator.clipboard.writeText(roomSettings.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyShareLink = () => {
    sound.playClick();
    const url = `${window.location.origin}?room=${roomSettings.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen w-full bg-obsidian-950 p-4 md:p-8 flex flex-col font-sans select-none">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Zap className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-display text-lg font-black tracking-wider text-slate-100">
              AFTERSHOCK
            </h1>
            <span className="font-mono text-xs text-slate-400">
              {roomSettings.roomName}
            </span>
          </div>
        </div>

        {/* Room Code Badge & Copy */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-obsidian-900 px-4 py-2 shadow-lg shadow-cyan-500/10">
            <span className="text-xs font-mono text-slate-400 uppercase">Room:</span>
            <span className="font-mono text-base font-black tracking-widest text-cyan-300">
              {roomSettings.roomCode}
            </span>
            {roomSettings.hasPassword && (
              <Lock className="h-3.5 w-3.5 text-amber-400" title="Password Protected" />
            )}
            <button
              onClick={copyRoomCode}
              className="ml-2 rounded p-1 text-slate-400 hover:text-cyan-300 transition"
              title="Copy Room Code"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={copyShareLink}
              className="rounded p-1 text-slate-400 hover:text-cyan-300 transition"
              title="Copy Invite Link"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onLeaveRoom();
            }}
            className="rounded-xl border border-slate-700 bg-obsidian-850 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Main Grid: Slots (Left) & Loadout Selection (Right) */}
      <div className="mt-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Player Slots (5 cols) */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-200 uppercase tracking-wider">
              <Users className="h-4 w-4 text-cyan-400" />
              <span>
                Pilots ({playerList.length} / {roomSettings.maxPlayers})
              </span>
            </div>
            {isHost && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-obsidian-850 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-500/50 transition"
              >
                <Settings2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>Host Settings</span>
              </button>
            )}
          </div>

          {/* Slot Cards */}
          <div className="flex flex-col gap-3">
            {playerList.map((player) => {
              const charDef = CHARACTER_DEFS[player.character];
              const isMe = player.id === localPlayerId;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between rounded-2xl border p-4 backdrop-blur-md transition-all ${
                    isMe
                      ? 'border-cyan-400/50 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
                      : 'border-slate-800/80 bg-obsidian-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center font-display font-black text-sm text-obsidian-950 shadow-md"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-slate-100">
                          {player.name}
                        </span>
                        {player.id === hostId && (
                          <span className="flex items-center gap-1 rounded bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800/50">
                            <Crown className="h-3 w-3" /> HOST
                          </span>
                        )}
                        {isMe && (
                          <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-800">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-400 mt-0.5">
                        {charDef.name} ({charDef.role})
                      </div>
                    </div>
                  </div>

                  {/* Ready Indicator & Host Kick Control */}
                  <div className="flex items-center gap-2">
                    {player.isReady ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-400">
                        <CheckCircle className="h-3.5 w-3.5" /> READY
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-700 bg-obsidian-800 px-3 py-1 text-xs text-slate-500">
                        PREPARING
                      </span>
                    )}

                    {isHost && !isMe && onKickPlayer && (
                      <button
                        onClick={() => onKickPlayer(player.id)}
                        className="rounded-lg border border-red-500/30 bg-red-950/30 px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition"
                        title="Kick Pilot"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty Slots Placeholder */}
            {Array.from({ length: Math.max(0, roomSettings.maxPlayers - playerList.length) }).map(
              (_, idx) => (
                <div
                  key={`empty_${idx}`}
                  className="flex items-center justify-center rounded-2xl border border-dashed border-slate-800/60 bg-obsidian-900/20 py-4 text-xs font-mono text-slate-600"
                >
                  [EMPTY PILOT POD] — Waiting for connection...
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Column: Character Class & Color Customization (7 cols) */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-bold text-slate-200 uppercase tracking-wider">
              Choose Pilot Class & Loadout
            </span>

            {/* Color Swatches */}
            <div className="flex items-center gap-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    sound.playClick();
                    onSetColor(c);
                  }}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    localPlayer?.color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-obsidian-950' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Character Class Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(CHARACTER_DEFS) as CharacterClass[]).map((cls) => {
              const def = CHARACTER_DEFS[cls];
              const isSelected = localPlayer?.character === cls;
              return (
                <div
                  key={cls}
                  onClick={() => {
                    sound.playClick();
                    onSelectCharacter(cls);
                  }}
                  className={`cursor-pointer rounded-2xl border p-4 backdrop-blur-md transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/30 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400'
                      : 'border-slate-800/80 bg-obsidian-900/60 hover:border-slate-700 hover:bg-obsidian-850'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display text-sm font-black text-slate-100">
                        {def.name}
                      </div>
                      <span className="font-mono text-[11px] text-cyan-400">
                        {def.role}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-slate-400">
                      {(def.cooldownMs / 1000).toFixed(1)}s CD
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    {def.description}
                  </p>

                  <div className="mt-3 rounded-lg bg-obsidian-950/70 p-2 border border-slate-800/80">
                    <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider block">
                      Tactical Advice:
                    </span>
                    <span className="font-sans text-[11px] text-slate-400">
                      {def.tacticalTip}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar (Ready & Launch Controls) */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-obsidian-900/90 p-4 backdrop-blur-lg">
            <div>
              <span className="font-mono text-xs text-slate-400 block">
                Match Length: <strong className="text-cyan-300">{roomSettings.matchDuration}s</strong>
              </span>
              <span className="font-mono text-xs text-slate-400">
                AI Sparring Bots: <strong className={roomSettings.fillBots ? 'text-emerald-400' : 'text-slate-500'}>{roomSettings.fillBots ? 'ENABLED' : 'DISABLED'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Ready Toggle */}
              <button
                onClick={() => {
                  sound.playClick();
                  onSetReady(!localPlayer?.isReady);
                }}
                className={`rounded-xl px-6 py-3 font-display text-xs font-bold uppercase tracking-wider transition shadow-lg ${
                  localPlayer?.isReady
                    ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-emerald-500/20'
                    : 'border border-slate-700 bg-obsidian-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {localPlayer?.isReady ? '✓ READY' : 'CLICK TO READY'}
              </button>

              {/* Host Launch Match Button */}
              {isHost && (
                <button
                  onClick={() => {
                    sound.playClick();
                    onStartMatch();
                  }}
                  disabled={!canStart}
                  className={`flex items-center gap-2 rounded-xl px-8 py-3 font-display text-xs font-black uppercase tracking-wider transition shadow-xl ${
                    canStart
                      ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-cyan-500/30 hover:opacity-90 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>LAUNCH MATCH</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Host Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-obsidian-900 p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-100">
              Room Settings (Host Controls)
            </h3>

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">
                  Match Duration:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[60, 90, 120].map((dur) => (
                    <button
                      key={dur}
                      onClick={() => onUpdateSettings({ matchDuration: dur })}
                      className={`rounded-lg border py-2 text-xs font-mono font-bold transition ${
                        roomSettings.matchDuration === dur
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                          : 'border-slate-800 bg-obsidian-950 text-slate-400'
                      }`}
                    >
                      {dur} Seconds
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">
                  Solo Testing / AI Drone Fillers:
                </label>
                <button
                  onClick={() => onUpdateSettings({ fillBots: !roomSettings.fillBots })}
                  className={`w-full rounded-lg border py-2 text-xs font-mono font-bold transition ${
                    roomSettings.fillBots
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-800 bg-obsidian-950 text-slate-400'
                  }`}
                >
                  {roomSettings.fillBots ? '✓ AI Bots Enabled (Fills empty slots)' : '✕ Human Players Only'}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl bg-cyan-500 px-6 py-2 font-display text-xs font-bold text-obsidian-950 hover:bg-cyan-400 transition"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';
import { RoomSummary } from '@shared/types';
import { sound } from '../services/sound';

interface HomeViewProps {
  playerName: string;
  onSetPlayerName: (name: string) => void;
  onCreateRoom: (payload: {
    playerName: string;
    roomName: string;
    password?: string;
    matchDuration: number;
    maxPlayers: number;
  }) => void;
  onJoinRoom: (payload: { roomCode: string; playerName: string; password?: string }) => void;
  onLaunchTutorial: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  playerName,
  onSetPlayerName,
  onCreateRoom,
  onJoinRoom,
  onLaunchTutorial
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);

  // Create form state
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomPassword, setNewRoomPassword] = useState<string>('');
  const [matchDuration, setMatchDuration] = useState<number>(90);
  const [maxPlayers, setMaxPlayers] = useState<number>(6);

  // Fetch active rooms
  const fetchPublicRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch {}
    setIsLoadingRooms(false);
  };

  useEffect(() => {
    fetchPublicRooms();
    const interval = setInterval(fetchPublicRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    sound.playClick();
    onCreateRoom({
      playerName: playerName.trim(),
      roomName: newRoomName.trim() || `${playerName}'s Arena`,
      password: newRoomPassword.trim() || undefined,
      matchDuration,
      maxPlayers
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomCodeInput.trim()) return;
    sound.playClick();
    onJoinRoom({
      roomCode: roomCodeInput.trim().toUpperCase(),
      playerName: playerName.trim(),
      password: passwordInput.trim() || undefined
    });
  };

  return (
    <div className="relative min-h-screen w-full bg-obsidian-950 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Sci-Fi Grid Background Animation */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,242,254,0.12)_0,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.1)_0,transparent_60%)] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-cyan-500/15 bg-obsidian-900/60 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 shadow-lg shadow-cyan-500/20">
            <Zap className="h-6 w-6 text-cyan-400" />
          </div>
          <span className="font-display text-lg font-black tracking-widest text-slate-100">
            AFTERSHOCK
          </span>
        </div>

        <button
          onClick={onLaunchTutorial}
          className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2 font-display text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition shadow-lg shadow-cyan-500/10"
        >
          <Gamepad2 className="h-4 w-4" />
          <span>Interactive Academy</span>
        </button>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto flex flex-1 w-full max-w-5xl flex-col items-center justify-center p-6 text-center">
        {/* Animated Pill Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/40 px-4 py-1.5 font-mono text-xs text-cyan-300 backdrop-blur-md mb-4 shadow-lg shadow-cyan-500/10">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span>SERVER AUTHORITATIVE • 20HZ REAL-TIME ARENA</span>
        </div>

        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-black tracking-wider text-slate-100 leading-none">
          AFTER<span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">SHOCK</span>
        </h1>

        <p className="mt-4 max-w-xl font-sans text-sm md:text-base text-slate-400 leading-relaxed">
          Pilot cybernetic crafts across a shifting energy matrix. Harness character abilities, harvest flux cores, and survive propagating seismic rifts in simultaneous real-time multiplayer combat.
        </p>

        {/* Player Name Input Card */}
        <div className="mt-8 w-full max-w-md rounded-2xl border border-cyan-500/30 bg-obsidian-900/90 p-6 shadow-2xl backdrop-blur-lg">
          <label className="block text-left font-mono text-xs text-slate-400 uppercase tracking-wider mb-2">
            Pilot Call-Sign:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={playerName}
              onChange={(e) => onSetPlayerName(e.target.value)}
              maxLength={16}
              placeholder="Enter your pilot name..."
              className="w-full rounded-xl border border-slate-700 bg-obsidian-950 px-4 py-3 font-display text-sm font-bold text-slate-100 placeholder-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          {/* Primary Action Buttons */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                sound.playClick();
                setShowCreateModal(true);
              }}
              disabled={!playerName.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-3.5 font-display text-xs font-black uppercase tracking-wider text-obsidian-950 shadow-xl shadow-cyan-500/20 hover:opacity-90 active:scale-95 transition disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              <span>Host Room</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setShowJoinModal(true);
              }}
              disabled={!playerName.trim()}
              className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-obsidian-850 px-4 py-3.5 font-display text-xs font-black uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/10 active:scale-95 transition disabled:opacity-40"
            >
              <Users className="h-4 w-4" />
              <span>Join Code</span>
            </button>
          </div>
        </div>

        {/* Public Active Rooms Drawer */}
        <div className="mt-10 w-full max-w-2xl text-left">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-display text-xs font-bold text-slate-300 uppercase tracking-wider">
              Active Arena Chambers ({publicRooms.length})
            </span>
            <button
              onClick={fetchPublicRooms}
              className="text-slate-400 hover:text-cyan-300 transition"
              title="Refresh Rooms"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingRooms ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {publicRooms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-obsidian-900/30 p-6 text-center font-mono text-xs text-slate-500">
                No active arenas at this moment. Host the first chamber above!
              </div>
            ) : (
              publicRooms.map((room) => (
                <div
                  key={room.roomCode}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-obsidian-900/60 p-3 backdrop-blur-sm hover:border-cyan-500/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950/60 font-mono text-xs font-bold text-cyan-400 border border-cyan-800/50">
                      {room.playerCount}/{room.maxPlayers}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-slate-200">
                          {room.roomName}
                        </span>
                        {room.hasPassword && <Lock className="h-3 w-3 text-amber-400" />}
                      </div>
                      <span className="font-mono text-xs text-slate-400">
                        Code: {room.roomCode} • Status: {room.status}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      sound.playClick();
                      onJoinRoom({
                        roomCode: room.roomCode,
                        playerName: playerName.trim() || 'Pilot'
                      });
                    }}
                    disabled={room.status === 'IN_PROGRESS' || room.playerCount >= room.maxPlayers}
                    className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 font-display text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-30"
                  >
                    Enter
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-obsidian-900 p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-100">
              Host New Arena Chamber
            </h3>
            <form onSubmit={handleCreateSubmit} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Chamber Name:</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Apex Obsidian"
                  maxLength={24}
                  className="w-full rounded-lg border border-slate-700 bg-obsidian-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">
                  Optional Password (leave empty for public):
                </label>
                <input
                  type="password"
                  value={newRoomPassword}
                  onChange={(e) => setNewRoomPassword(e.target.value)}
                  placeholder="Access key..."
                  className="w-full rounded-lg border border-slate-700 bg-obsidian-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">
                  Match Duration:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[60, 90, 120].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setMatchDuration(dur)}
                      className={`rounded-lg border py-2 text-xs font-mono font-bold transition ${
                        matchDuration === dur
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                          : 'border-slate-800 bg-obsidian-950 text-slate-400'
                      }`}
                    >
                      {dur}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-6 py-2 font-display text-xs font-bold text-white shadow-lg shadow-cyan-500/20"
                >
                  Launch Chamber
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-obsidian-900 p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-100">
              Join Arena Chamber
            </h3>
            <form onSubmit={handleJoinSubmit} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">
                  6-Digit Room Code:
                </label>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. ASW-J6X"
                  maxLength={7}
                  className="w-full rounded-lg border border-slate-700 bg-obsidian-950 px-3 py-2 font-mono text-center text-sm font-bold tracking-widest text-cyan-300 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">
                  Password (if room is locked):
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Leave blank if public"
                  className="w-full rounded-lg border border-slate-700 bg-obsidian-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!roomCodeInput.trim()}
                  className="rounded-xl bg-cyan-500 px-6 py-2 font-display text-xs font-bold text-obsidian-950 hover:bg-cyan-400 disabled:opacity-40"
                >
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

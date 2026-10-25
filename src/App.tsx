import React, { useState, useEffect, useRef } from 'react';
import {
  CharacterClass,
  CHARACTER_DEFS,
  GameSnapshot,
  GameStatus,
  PlayerState,
  RoomSettings
} from '@shared/types';
import { socketService } from './services/socket';
import { sound } from './services/sound';
import { HomeView } from './components/HomeView';
import { LobbyView } from './components/LobbyView';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { ResultsView } from './components/ResultsView';
import { InteractiveTutorial } from './components/InteractiveTutorial';
import { VirtualJoystick } from './components/VirtualJoystick';
import { AlertCircle } from 'lucide-react';

type Screen = 'HOME' | 'TUTORIAL' | 'LOBBY' | 'GAME' | 'RESULTS';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('HOME');
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('aftershock_pilot_name') || `Pilot-${Math.floor(Math.random() * 900 + 100)}`;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active room & game state
  const [roomSettings, setRoomSettings] = useState<RoomSettings | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [localPlayerId, setLocalPlayerId] = useState<string>('');
  const [hostId, setHostId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [pingMs, setPingMs] = useState<number>(0);

  // Mobile joystick input
  const virtualInput = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const activeKeys = useRef<Set<string>>(new Set());

  // Save pilot name
  const handleSetPlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('aftershock_pilot_name', name);
  };

  // Show error toast
  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  // Socket setup & event listeners
  useEffect(() => {
    const socket = socketService.init();

    // Check URL params for room invite code (?room=CODE)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');

    socket.on('roomStateUpdate', (data) => {
      setRoomSettings(data.roomSettings);
      setPlayers(data.players);
      setHostId(data.hostId);

      // Determine local player ID
      if (socket.id && !localPlayerId) {
        // Find player matching socket or current session
        for (const [pId, p] of Object.entries(data.players)) {
          if (p.isHost && data.hostId === pId) {
            // Local player is host
          }
        }
      }

      if (data.status === 'LOBBY') {
        setScreen((prev) => (prev === 'RESULTS' || prev === 'GAME' ? 'LOBBY' : prev));
      }
    });

    socket.on('matchStarted', (initialSnapshot) => {
      sound.playAbility('SURGE');
      setSnapshot(initialSnapshot);
      setScreen('GAME');
    });

    socket.on('gameSnapshot', (newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    socket.on('matchEnded', (finalSnapshot) => {
      sound.playEnergyPickup(true);
      setSnapshot(finalSnapshot);
      setScreen('RESULTS');
    });

    socket.on('errorNotification', (msg) => {
      showError(msg);
    });

    // Auto-join from URL if room param exists
    if (roomParam) {
      handleJoinRoom({
        roomCode: roomParam,
        playerName
      });
    }

    // Ping update timer
    const pingTimer = setInterval(() => {
      setPingMs(socketService.pingMs);
    }, 1000);

    return () => {
      clearInterval(pingTimer);
      socket.off('roomStateUpdate');
      socket.off('matchStarted');
      socket.off('gameSnapshot');
      socket.off('matchEnded');
      socket.off('errorNotification');
    };
  }, [localPlayerId]);

  // Keyboard input loop (for continuous smooth control)
  useEffect(() => {
    if (screen !== 'GAME') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default scroll on arrow keys and spacebar during match
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      activeKeys.current.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyE') {
        handleUseAbility();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 20Hz Input Dispatcher
    const inputLoop = setInterval(() => {
      let dx = virtualInput.current.dx;
      let dy = virtualInput.current.dy;

      if (activeKeys.current.has('KeyW') || activeKeys.current.has('ArrowUp')) dy -= 1;
      if (activeKeys.current.has('KeyS') || activeKeys.current.has('ArrowDown')) dy += 1;
      if (activeKeys.current.has('KeyA') || activeKeys.current.has('ArrowLeft')) dx -= 1;
      if (activeKeys.current.has('KeyD') || activeKeys.current.has('ArrowRight')) dx += 1;

      socketService.sendInput({ dx, dy });
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(inputLoop);
    };
  }, [screen]);

  // Handlers
  const handleCreateRoom = (payload: {
    playerName: string;
    roomName: string;
    password?: string;
    matchDuration: number;
    maxPlayers: number;
  }) => {
    socketService.createRoom(payload, (res) => {
      if (res.success && res.roomCode && res.player) {
        setLocalPlayerId(res.player.id);
        setScreen('LOBBY');
      } else {
        showError(res.message || 'Failed to create room.');
      }
    });
  };

  const handleJoinRoom = (payload: { roomCode: string; playerName: string; password?: string }) => {
    socketService.joinRoom(payload, (res) => {
      if (res.success && res.player) {
        setLocalPlayerId(res.player.id);
        setScreen('LOBBY');
      } else {
        showError(res.message || 'Failed to join room.');
      }
    });
  };

  const handleLeaveRoom = () => {
    socketService.leaveRoom();
    setRoomSettings(null);
    setPlayers({});
    setSnapshot(null);
    setScreen('HOME');
  };

  const handleUseAbility = () => {
    const localPlayer = snapshot?.players[localPlayerId] || players[localPlayerId];
    if (localPlayer) {
      sound.playAbility(localPlayer.character);
    }
    socketService.useAbility();
  };

  const handleRematch = () => {
    socketService.requestRematch();
    setScreen('LOBBY');
  };

  const handleKickPlayer = (targetPlayerId: string) => {
    socketService.kickPlayer(targetPlayerId);
  };

  const currentLocalPlayer = (snapshot && snapshot.players[localPlayerId]) || players[localPlayerId] || null;
  const cooldownRemaining = currentLocalPlayer
    ? Math.max(0, currentLocalPlayer.abilityCooldownUntil - Date.now())
    : 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-obsidian-950 text-slate-100">
      {/* Toast Error Alert */}
      {errorMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-hazard-danger bg-obsidian-900/95 px-5 py-3 shadow-2xl backdrop-blur-md text-hazard-danger animate-bounce">
          <AlertCircle className="h-4 w-4" />
          <span className="font-mono text-xs font-bold">{errorMessage}</span>
        </div>
      )}

      {/* Screen Routing */}
      {screen === 'HOME' && (
        <HomeView
          playerName={playerName}
          onSetPlayerName={handleSetPlayerName}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onLaunchTutorial={() => setScreen('TUTORIAL')}
        />
      )}

      {screen === 'TUTORIAL' && (
        <InteractiveTutorial
          onComplete={() => setScreen('HOME')}
          onExit={() => setScreen('HOME')}
        />
      )}

      {screen === 'LOBBY' && roomSettings && (
        <LobbyView
          roomSettings={roomSettings}
          players={players}
          localPlayerId={localPlayerId}
          hostId={hostId}
          onSetReady={(ready) => socketService.setReady(ready)}
          onSelectCharacter={(char) => socketService.selectCharacter(char)}
          onSetColor={(col) => socketService.setPlayerColor(col)}
          onUpdateSettings={(s) => socketService.updateSettings(s)}
          onStartMatch={() => socketService.startMatch()}
          onKickPlayer={handleKickPlayer}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {screen === 'GAME' && snapshot && (
        <div className="relative h-full w-full">
          {/* 60 FPS Canvas Game Engine */}
          <GameCanvas snapshot={snapshot} localPlayerId={localPlayerId} />

          {/* Sci-Fi In-Game HUD */}
          <GameHUD
            snapshot={snapshot}
            localPlayer={currentLocalPlayer}
            onUseAbility={handleUseAbility}
            pingMs={pingMs}
          />

          {/* Responsive Virtual Joystick & Touch Ability for Phones */}
          <VirtualJoystick
            onMove={(dx, dy) => {
              virtualInput.current = { dx, dy };
            }}
            onAbility={handleUseAbility}
            characterDef={currentLocalPlayer ? CHARACTER_DEFS[currentLocalPlayer.character] : undefined}
            cooldownRemainingMs={cooldownRemaining}
          />
        </div>
      )}

      {screen === 'RESULTS' && snapshot && (
        <ResultsView
          snapshot={snapshot}
          localPlayerId={localPlayerId}
          onRematch={handleRematch}
          onLeave={handleLeaveRoom}
        />
      )}
    </div>
  );
};

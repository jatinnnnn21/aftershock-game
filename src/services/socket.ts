import { io, Socket } from 'socket.io-client';
import {
  CharacterClass,
  ClientInputPacket,
  ClientToServerEvents,
  ClientUseAbilityPacket,
  GameEvent,
  GameSnapshot,
  GameStatus,
  PlayerState,
  RoomSettings,
  ServerToClientEvents
} from '@shared/types';

class SocketService {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  public isConnected: boolean = false;
  public pingMs: number = 0;
  private pingInterval: any = null;

  public init(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket) return this.socket;

    // Use current host in browser, fallback to port 3001 in vite dev proxy
    const serverUrl = window.location.hostname === 'localhost' && window.location.port === '3000'
      ? 'http://localhost:3001'
      : window.location.origin;

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.startPingMonitor();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.stopPingMonitor();
    });

    this.socket.on('pong', (sentTime) => {
      this.pingMs = Math.round(Date.now() - sentTime);
    });

    return this.socket;
  }

  private startPingMonitor() {
    this.stopPingMonitor();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping', Date.now());
      }
    }, 3000);
  }

  private stopPingMonitor() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public createRoom(
    payload: { playerName: string; roomName?: string; password?: string; matchDuration?: number; maxPlayers?: number },
    callback: (res: { success: boolean; roomCode?: string; message?: string; token?: string; player?: PlayerState }) => void
  ) {
    if (!this.socket) this.init();
    this.socket?.emit('createRoom', payload, (res) => {
      if (res.success && res.token && res.roomCode) {
        this.saveSessionToken(res.roomCode, res.token);
      }
      callback(res);
    });
  }

  public joinRoom(
    payload: { roomCode: string; playerName: string; password?: string; reconnectToken?: string },
    callback: (res: { success: boolean; message?: string; player?: PlayerState; token?: string }) => void
  ) {
    if (!this.socket) this.init();
    const token = payload.reconnectToken || this.getSessionToken(payload.roomCode);
    this.socket?.emit('joinRoom', { ...payload, reconnectToken: token || undefined }, (res) => {
      if (res.success && res.token) {
        this.saveSessionToken(payload.roomCode, res.token);
      }
      callback(res);
    });
  }

  public leaveRoom() {
    this.socket?.emit('leaveRoom');
  }

  public setReady(ready: boolean) {
    this.socket?.emit('setReady', ready);
  }

  public selectCharacter(char: CharacterClass) {
    this.socket?.emit('selectCharacter', char);
  }

  public setPlayerColor(color: string) {
    this.socket?.emit('setPlayerColor', color);
  }

  public updateSettings(settings: Partial<RoomSettings>) {
    this.socket?.emit('updateSettings', settings);
  }

  public startMatch() {
    this.socket?.emit('startMatch');
  }

  public requestRematch() {
    this.socket?.emit('requestRematch');
  }

  public kickPlayer(targetPlayerId: string) {
    this.socket?.emit('kickPlayer', targetPlayerId);
  }

  public sendInput(input: ClientInputPacket) {
    this.socket?.emit('playerInput', input);
  }

  public useAbility(payload: ClientUseAbilityPacket = {}) {
    this.socket?.emit('useAbility', payload);
  }

  public saveSessionToken(roomCode: string, token: string) {
    try {
      localStorage.setItem(`aftershock_token_${roomCode.toUpperCase()}`, token);
    } catch {}
  }

  public getSessionToken(roomCode: string): string | null {
    try {
      return localStorage.getItem(`aftershock_token_${roomCode.toUpperCase()}`);
    } catch {
      return null;
    }
  }
}

export const socketService = new SocketService();

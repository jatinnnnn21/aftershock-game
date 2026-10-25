import { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom.js';
import {
  CharacterClass,
  ClientInputPacket,
  ClientToServerEvents,
  ClientUseAbilityPacket,
  RoomSettings,
  RoomSummary,
  ServerToClientEvents
} from '../shared/types.js';

export class RoomManager {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private rooms: Map<string, GameRoom> = new Map();
  private socketToRoom: Map<string, string> = new Map(); // socketId -> roomCode
  private roomPasswords: Map<string, string> = new Map(); // roomCode -> plain password

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      let part1 = '';
      let part2 = '';
      for (let i = 0; i < 3; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      for (let i = 0; i < 3; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
      code = `${part1}-${part2}`;
    } while (this.rooms.has(code));
    return code;
  }

  public createRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    payload: {
      playerName: string;
      roomName?: string;
      password?: string;
      matchDuration?: number;
      maxPlayers?: number;
    }
  ): { success: boolean; roomCode?: string; message?: string; token?: string } {
    const roomCode = this.generateRoomCode();
    const hasPassword = Boolean(payload.password && payload.password.trim().length > 0);

    const room = new GameRoom(
      roomCode,
      '', // will be set when player is added
      {
        roomName: payload.roomName || `Arena ${roomCode}`,
        hasPassword,
        matchDuration: payload.matchDuration || 90,
        maxPlayers: payload.maxPlayers || 6,
        fillBots: false
      },
      this.io as any
    );

    if (hasPassword && payload.password) {
      this.roomPasswords.set(roomCode, payload.password.trim());
    }

    this.rooms.set(roomCode, room);

    // Join socket to room
    socket.join(roomCode);
    this.socketToRoom.set(socket.id, roomCode);

    const { player, token } = room.addPlayer(socket.id, payload.playerName);
    room.hostId = player.id;
    player.isHost = true;
    player.isReady = true;

    return {
      success: true,
      roomCode,
      token,
      player
    };
  }

  public joinRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    payload: {
      roomCode: string;
      playerName: string;
      password?: string;
      reconnectToken?: string;
    }
  ): { success: boolean; message?: string; token?: string; player?: any } {
    if (!payload?.roomCode) {
      return { success: false, message: 'Room code is required.' };
    }

    const code = payload.roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, message: 'Room not found. Check the code and try again.' };
    }

    // Verify password if not reconnecting
    if (room.settings.hasPassword && !payload.reconnectToken) {
      const actualPassword = this.roomPasswords.get(code);
      if (actualPassword && actualPassword !== payload.password) {
        return { success: false, message: 'Invalid room password.' };
      }
    }

    if (room.players.size >= room.settings.maxPlayers && !payload.reconnectToken) {
      return { success: false, message: 'Room is full (maximum players reached).' };
    }

    if (room.status === 'IN_PROGRESS' && !payload.reconnectToken) {
      return { success: false, message: 'Match is already in progress.' };
    }

    socket.join(code);
    this.socketToRoom.set(socket.id, code);

    const { player, token } = room.addPlayer(socket.id, payload.playerName, payload.reconnectToken);

    return {
      success: true,
      player,
      token
    };
  }

  public leaveRoom(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    const roomCode = this.socketToRoom.get(socket.id);
    if (!roomCode) return;

    socket.leave(roomCode);
    this.socketToRoom.delete(socket.id);

    const room = this.rooms.get(roomCode);
    if (room) {
      room.removePlayer(socket.id);

      // Clean up empty rooms or rooms where all human sockets disconnected
      if (room.players.size === 0 || room.sockets.size === 0) {
        room.destroy();
        this.rooms.delete(roomCode);
        this.roomPasswords.delete(roomCode);
      }
    }
  }

  public handleDisconnect(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    this.leaveRoom(socket);
  }

  public kickPlayer(socket: Socket<ClientToServerEvents, ServerToClientEvents>, targetPlayerId: string) {
    const room = this.getRoomBySocket(socket.id);
    if (room) {
      room.kickPlayer(socket.id, targetPlayerId);
    }
  }

  public requestRematch(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    const room = this.getRoomBySocket(socket.id);
    if (room) {
      room.requestRematch(socket.id);
    }
  }

  public getRoomBySocket(socketId: string): GameRoom | undefined {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return undefined;
    return this.rooms.get(roomCode);
  }

  public getPublicRooms(): RoomSummary[] {
    const summaries: RoomSummary[] = [];
    for (const room of this.rooms.values()) {
      summaries.push({
        roomCode: room.roomCode,
        roomName: room.settings.roomName,
        playerCount: room.players.size,
        maxPlayers: room.settings.maxPlayers,
        hasPassword: room.settings.hasPassword,
        status: room.status
      });
    }
    return summaries;
  }
}

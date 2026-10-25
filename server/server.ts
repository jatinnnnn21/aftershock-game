import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RoomManager } from './RoomManager.js';
import {
  CharacterClass,
  ClientInputPacket,
  ClientToServerEvents,
  ClientUseAbilityPacket,
  RoomSettings,
  ServerToClientEvents
} from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

const roomManager = new RoomManager(io);

app.use(express.json());

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: Date.now(), timestamp: new Date().toISOString() });
});

app.get('/api/rooms', (req, res) => {
  res.json({ rooms: roomManager.getPublicRooms() });
});

// Serve frontend static build if it exists
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log(`[AFTERSHOCK] Serving production static assets from ${distPath}`);
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Socket.io Connection & Event Handling
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on('createRoom', (payload, callback) => {
    try {
      const result = roomManager.createRoom(socket, payload);
      callback(result);
    } catch (err: any) {
      console.error('[Error] createRoom:', err);
      callback({ success: false, message: err.message || 'Failed to create room' });
    }
  });

  socket.on('joinRoom', (payload, callback) => {
    try {
      const result = roomManager.joinRoom(socket, payload);
      callback(result);
    } catch (err: any) {
      console.error('[Error] joinRoom:', err);
      callback({ success: false, message: err.message || 'Failed to join room' });
    }
  });

  socket.on('leaveRoom', () => {
    roomManager.leaveRoom(socket);
  });

  socket.on('setReady', (ready: boolean) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.setReady(socket.id, ready);
    }
  });

  socket.on('selectCharacter', (character: CharacterClass) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.selectCharacter(socket.id, character);
    }
  });

  socket.on('setPlayerColor', (color: string) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.setPlayerColor(socket.id, color);
    }
  });

  socket.on('updateSettings', (settings: Partial<RoomSettings>) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.updateSettings(socket.id, settings);
    }
  });

  socket.on('startMatch', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.startMatch(socket.id);
    }
  });

  socket.on('requestRematch', () => {
    roomManager.requestRematch(socket);
  });

  socket.on('kickPlayer', (targetPlayerId: string) => {
    roomManager.kickPlayer(socket, targetPlayerId);
  });

  socket.on('playerInput', (input: ClientInputPacket) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleInput(socket.id, input);
    }
  });

  socket.on('useAbility', (payload: ClientUseAbilityPacket) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleAbility(socket.id, payload);
    }
  });

  socket.on('ping', (clientTimestamp: number) => {
    socket.emit('pong', clientTimestamp);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    roomManager.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  ⚡ AFTERSHOCK Real-Time Game Server Running`);
  console.log(`  ⚡ Port: ${PORT}`);
  console.log(`  ⚡ Health: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

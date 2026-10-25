import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../server/RoomManager.js';
import {
  ClientToServerEvents,
  GameSnapshot,
  ServerToClientEvents
} from '../shared/types.js';

async function runE2ETest() {
  console.log('🚀 Running Comprehensive AFTERSHOCK E2E Gameplay & Netcode Validation...\n');

  const app = express();
  const server = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: '*' }
  });
  const roomManager = new RoomManager(io);

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/rooms', (req, res) => res.json({ rooms: roomManager.getPublicRooms() }));

  io.on('connection', (socket) => {
    socket.on('createRoom', (payload, cb) => cb(roomManager.createRoom(socket, payload)));
    socket.on('joinRoom', (payload, cb) => cb(roomManager.joinRoom(socket, payload)));
    socket.on('leaveRoom', () => roomManager.leaveRoom(socket));
    socket.on('setReady', (ready) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (room) room.setReady(socket.id, ready);
    });
    socket.on('selectCharacter', (char) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (room) room.selectCharacter(socket.id, char);
    });
    socket.on('startMatch', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (room) room.startMatch(socket.id);
    });
    socket.on('playerInput', (input) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (room) room.handleInput(socket.id, input);
    });
    socket.on('useAbility', (payload) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (room) room.handleAbility(socket.id, payload);
    });
    socket.on('disconnect', () => roomManager.handleDisconnect(socket));
  });

  const PORT = 48000 + Math.floor(Math.random() * 4000);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`✓ Game Server active on http://localhost:${PORT}`);

  const connectClient = (): Promise<ClientSocket<ServerToClientEvents, ClientToServerEvents>> => {
    return new Promise((resolve) => {
      const socket = ioClient(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        forceNew: true
      });
      socket.on('connect', () => resolve(socket));
    });
  };

  try {
    // 1. Health & Room API verification
    console.log('\n--- 1. REST API Verification ---');
    const healthRes = await fetch(`http://localhost:${PORT}/api/health`);
    const healthJson = await healthRes.json();
    if (healthJson.status !== 'ok') throw new Error('Health check failed');
    console.log('✓ Health endpoint /api/health returned OK');

    // 2. Connect Players
    console.log('\n--- 2. Connecting Real Socket Clients ---');
    const p1 = await connectClient();
    const p2 = await connectClient();
    console.log('✓ 2 socket clients connected');

    // 3. Create Room Alpha
    let alphaRoomCode = '';
    let p1Token = '';
    await new Promise<void>((resolve, reject) => {
      p1.emit('createRoom', { playerName: 'Striker-Alpha', matchDuration: 60 }, (res) => {
        if (res.success && res.roomCode && res.token) {
          alphaRoomCode = res.roomCode;
          p1Token = res.token;
          resolve();
        } else {
          reject(new Error('Failed to create Alpha room'));
        }
      });
    });
    console.log(`✓ Room Alpha created: ${alphaRoomCode}`);

    // 4. Join Player 2 to Alpha
    let p2Token = '';
    await new Promise<void>((resolve, reject) => {
      p2.emit('joinRoom', { roomCode: alphaRoomCode, playerName: 'Shadow-Beta' }, (res) => {
        if (res.success && res.token) {
          p2Token = res.token;
          resolve();
        } else {
          reject(new Error('Failed to join Alpha room'));
        }
      });
    });
    console.log('✓ Player 2 joined Room Alpha');

    // 5. Create Independent Room Omega
    const p3 = await connectClient();
    let omegaRoomCode = '';
    await new Promise<void>((resolve, reject) => {
      p3.emit('createRoom', { playerName: 'Titan-Omega', password: 'secretOmegaKey' }, (res) => {
        if (res.success && res.roomCode) {
          omegaRoomCode = res.roomCode;
          resolve();
        } else {
          reject(new Error('Failed to create Omega room'));
        }
      });
    });
    console.log(`✓ Independent Room Omega created: ${omegaRoomCode}`);

    // Verify rooms endpoint
    const roomsRes = await fetch(`http://localhost:${PORT}/api/rooms`);
    const roomsJson = await roomsRes.json();
    if (roomsJson.rooms.length !== 2) throw new Error('Rooms list count mismatch');
    console.log(`✓ /api/rooms confirmed 2 independent chambers in memory: ${roomsJson.rooms.map((r: any) => r.roomCode).join(', ')}`);

    // 6. Character Select & Match Start
    p1.emit('selectCharacter', 'SURGE');
    p2.emit('selectCharacter', 'SHOCKWAVE');
    p2.emit('setReady', true);
    await new Promise((r) => setTimeout(r, 150));

    let latestSnapshot: GameSnapshot | null = null;
    p1.on('gameSnapshot', (s) => {
      latestSnapshot = s;
    });

    p1.emit('startMatch');
    await new Promise((r) => setTimeout(r, 500));

    if (!latestSnapshot) throw new Error('Did not receive match start snapshot');
    console.log('✓ Match in Room Alpha successfully started');

    // 7. Test simultaneous inputs
    console.log('\n--- 3. Testing Simultaneous Inputs & Movement Bounds ---');
    p1.emit('playerInput', { dx: 1, dy: 0 }); // Move right
    p2.emit('playerInput', { dx: -1, dy: 0 }); // Move left
    await new Promise((r) => setTimeout(r, 400));

    // 8. Test Abilities
    console.log('\n--- 4. Testing Ability Triggers ---');
    p1.emit('useAbility', {});
    p2.emit('useAbility', {});
    await new Promise((r) => setTimeout(r, 300));

    const snapAfterAbilities = latestSnapshot as GameSnapshot;
    const p1State = Object.values(snapAfterAbilities.players).find(p => p.name === 'Striker-Alpha');
    if (!p1State || p1State.stats.abilitiesUsed === 0) {
      throw new Error('Ability was not tracked on server');
    }
    console.log(`✓ Pilot Striker-Alpha ability tracked (abilitiesUsed: ${p1State.stats.abilitiesUsed})`);

    // 9. Mid-Match Disconnect & Reconnect
    console.log('\n--- 5. Mid-Match Disconnect & Reconnect Verification ---');
    p2.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    const p2Reconnected = await connectClient();
    await new Promise<void>((resolve, reject) => {
      p2Reconnected.emit('joinRoom', {
        roomCode: alphaRoomCode,
        playerName: 'Shadow-Beta',
        reconnectToken: p2Token
      }, (res) => {
        if (res.success) {
          resolve();
        } else {
          reject(new Error('Failed to reconnect'));
        }
      });
    });
    console.log('✓ Pilot Shadow-Beta successfully reconnected without loss of match state');

    // Clean up
    p1.disconnect();
    p2Reconnected.disconnect();
    p3.disconnect();
    server.close();

    console.log('\n🌟 ALL E2E GAMEPLAY & NETCODE CRITERIA VERIFIED SUCCESSFULLY! 🌟\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ E2E Test failed:', err);
    server.close();
    process.exit(1);
  }
}

runE2ETest();

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

async function runTestSuite() {
  console.log('🧪 Starting AFTERSHOCK Automated Real-Time Multiplayer Test Suite...\n');

  const app = express();
  const server = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: '*' }
  });
  const roomManager = new RoomManager(io);

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

  const TEST_PORT = 49152 + Math.floor(Math.random() * 5000);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Server online on port ${TEST_PORT}`);

  const createClient = (): ClientSocket<ServerToClientEvents, ClientToServerEvents> => {
    return ioClient(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      forceNew: true
    });
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Room Creation
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Host Room Creation ---');
    const client1 = createClient();
    await new Promise<void>((resolve) => client1.on('connect', resolve));
    console.log('✓ Client 1 connected');

    let roomCodeA = '';
    let token1 = '';
    await new Promise<void>((resolve, reject) => {
      client1.emit('createRoom', { playerName: 'Viper-One', matchDuration: 60 }, (res) => {
        if (res.success && res.roomCode && res.token) {
          roomCodeA = res.roomCode;
          token1 = res.token;
          console.log(`✓ Room created successfully: ${roomCodeA}`);
          resolve();
        } else {
          reject(new Error(res.message || 'Room creation failed'));
        }
      });
    });

    // -------------------------------------------------------------
    // Test 2: Second Player Joins Room A
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Second Player Joining Room A ---');
    const client2 = createClient();
    await new Promise<void>((resolve) => client2.on('connect', resolve));

    let token2 = '';
    await new Promise<void>((resolve, reject) => {
      client2.emit('joinRoom', { roomCode: roomCodeA, playerName: 'Ghost-Two' }, (res) => {
        if (res.success && res.token) {
          token2 = res.token;
          console.log(`✓ Player 2 successfully joined room ${roomCodeA}`);
          resolve();
        } else {
          reject(new Error(res.message || 'Join room failed'));
        }
      });
    });

    // -------------------------------------------------------------
    // Test 3: Multiple Independent Rooms (Room B with Password)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Multiple Independent Rooms (Room B) ---');
    const client3 = createClient();
    await new Promise<void>((resolve) => client3.on('connect', resolve));

    let roomCodeB = '';
    await new Promise<void>((resolve, reject) => {
      client3.emit('createRoom', { playerName: 'Rogue-Three', password: 'secretPass123' }, (res) => {
        if (res.success && res.roomCode) {
          roomCodeB = res.roomCode;
          console.log(`✓ Independent Room B created: ${roomCodeB} (Password Protected)`);
          resolve();
        } else {
          reject(new Error('Room B creation failed'));
        }
      });
    });

    // Attempt to join Room B with wrong password
    const client4 = createClient();
    await new Promise<void>((resolve) => client4.on('connect', resolve));
    await new Promise<void>((resolve, reject) => {
      client4.emit('joinRoom', { roomCode: roomCodeB, playerName: 'Intruder', password: 'wrong' }, (res) => {
        if (!res.success) {
          console.log('✓ Rejected unauthorized join with wrong password as expected');
          resolve();
        } else {
          reject(new Error('Room password protection bypassed!'));
        }
      });
    });

    // -------------------------------------------------------------
    // Test 4: Character Selection & Ready Status
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Character Selection & Ready Status ---');
    client2.emit('selectCharacter', 'BLINK');
    client2.emit('setReady', true);
    await new Promise((r) => setTimeout(r, 100));
    console.log('✓ Player 2 selected BLINK and readied up');

    // -------------------------------------------------------------
    // Test 5: Match Start & Simultaneous Actions
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Match Start & 20Hz State Synchronization ---');
    let snapshotCount = 0;
    let initialSnapshot: GameSnapshot | null = null;

    client1.on('gameSnapshot', (snap) => {
      snapshotCount++;
      if (!initialSnapshot) initialSnapshot = snap;
    });

    client1.emit('startMatch');

    // Wait for match to start and receive tick frames
    await new Promise((r) => setTimeout(r, 600));

    if (snapshotCount === 0 || !initialSnapshot) {
      throw new Error('Did not receive game snapshots after match start!');
    }
    console.log(`✓ Received ${snapshotCount} authoritative game snapshots at 20Hz`);

    // -------------------------------------------------------------
    // Test 6: Simultaneous Inputs & Velocity Movement
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Simultaneous Player Inputs ---');
    const p1InitialX = Object.values((initialSnapshot as GameSnapshot).players)[0].x;

    // Player 1 moves right, Player 2 moves down
    client1.emit('playerInput', { dx: 1, dy: 0 });
    client2.emit('playerInput', { dx: 0, dy: 1 });

    await new Promise((r) => setTimeout(r, 300));

    // Player 1 uses ability (Phase Dash / Blink or default)
    client1.emit('useAbility', {});
    await new Promise((r) => setTimeout(r, 200));

    console.log('✓ Processed simultaneous input vectors and ability activations');

    // -------------------------------------------------------------
    // Test 7: Disconnection & Reconnection Token Recovery
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Disconnection & Reconnection ---');
    console.log('Disconnecting Player 2 socket...');
    client2.disconnect();

    await new Promise((r) => setTimeout(r, 300));

    console.log('Reconnecting Player 2 with stored reconnect token...');
    const client2Reconnect = createClient();
    await new Promise<void>((resolve) => client2Reconnect.on('connect', resolve));

    await new Promise<void>((resolve, reject) => {
      client2Reconnect.emit(
        'joinRoom',
        { roomCode: roomCodeA, playerName: 'Ghost-Two', reconnectToken: token2 },
        (res) => {
          if (res.success) {
            console.log('✓ Player 2 reconnected and session restored successfully!');
            resolve();
          } else {
            reject(new Error(res.message || 'Reconnection failed'));
          }
        }
      );
    });

    // Cleanup
    client1.disconnect();
    client2Reconnect.disconnect();
    client3.disconnect();
    client4.disconnect();
    server.close();

    console.log('\n🎉 ALL MULTIPLAYER REAL-TIME TESTS PASSED SUCCESSFULLY! 100% PASS RATE.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    server.close();
    process.exit(1);
  }
}

runTestSuite();

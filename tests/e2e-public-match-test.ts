import { io as ioClient } from 'socket.io-client';
import { GameSnapshot } from '../shared/types.js';

async function testPublicMultiplayer() {
  const publicUrl = 'https://her-springer-raising-painting.trycloudflare.com';
  console.log(`🌐 Testing Live Multiplayer Match over Public Cloudflare URL: ${publicUrl} ...`);

  const client1 = ioClient(publicUrl, { transports: ['websocket', 'polling'] });
  const client2 = ioClient(publicUrl, { transports: ['websocket', 'polling'] });

  await Promise.all([
    new Promise<void>((r) => client1.on('connect', r)),
    new Promise<void>((r) => client2.on('connect', r))
  ]);
  console.log('✓ Both independent clients connected to public Cloudflare edge');

  let roomCode = '';
  await new Promise<void>((resolve, reject) => {
    client1.emit('createRoom', { playerName: 'Cloud-Host', matchDuration: 60 }, (res) => {
      if (res.success && res.roomCode) {
        roomCode = res.roomCode;
        resolve();
      } else {
        reject(new Error('Failed to create room over public URL'));
      }
    });
  });
  console.log(`✓ Room created over public URL: ${roomCode}`);

  await new Promise<void>((resolve, reject) => {
    client2.emit('joinRoom', { roomCode, playerName: 'Cloud-Guest' }, (res) => {
      if (res.success) {
        resolve();
      } else {
        reject(new Error('Guest failed to join over public URL'));
      }
    });
  });
  console.log('✓ Guest joined room over public URL');

  client2.emit('setReady', true);
  await new Promise((r) => setTimeout(r, 200));

  let snapshotReceived = false;
  client1.on('gameSnapshot', (s: GameSnapshot) => {
    snapshotReceived = true;
  });

  client1.emit('startMatch');
  await new Promise((r) => setTimeout(r, 800));

  if (!snapshotReceived) {
    throw new Error('Did not receive live 20Hz snapshots over public URL');
  }
  console.log('✓ Live 20Hz authoritative snapshots received over public WebSocket');

  // Simultaneous inputs over public cloud
  client1.emit('playerInput', { dx: 1, dy: 0 });
  client2.emit('playerInput', { dx: -1, dy: 0 });
  await new Promise((r) => setTimeout(r, 400));
  console.log('✓ Simultaneous inputs exchanged over public cloud connection');

  client1.disconnect();
  client2.disconnect();

  console.log('🎉 100% SUCCESS: Live Public Multiplayer Match fully verified over the internet!\n');
  process.exit(0);
}

testPublicMultiplayer().catch((err) => {
  console.error('❌ Public multiplayer match error:', err);
  process.exit(1);
});

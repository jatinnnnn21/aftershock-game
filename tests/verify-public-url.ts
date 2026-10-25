import { io } from 'socket.io-client';

async function verifyPublicDeployment() {
  const publicUrl = 'https://her-springer-raising-painting.trycloudflare.com';
  console.log(`Connecting to Cloudflare live public URL: ${publicUrl} ...`);

  const socket = io(publicUrl, {
    transports: ['polling', 'websocket'],
    timeout: 10000
  });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`✓ Successfully established real-time socket connection to Cloudflare URL! Socket ID: ${socket.id}`);
      resolve();
    });

    socket.on('connect_error', (err) => {
      reject(err);
    });
  });

  // Test creating a public room over the live Cloudflare URL
  await new Promise<void>((resolve, reject) => {
    socket.emit('createRoom', { playerName: 'GlobalTester', roomName: 'Cloudflare Arena' }, (res) => {
      if (res.success && res.roomCode) {
        console.log(`✓ Created live room over Cloudflare URL with code: ${res.roomCode}`);
        resolve();
      } else {
        reject(new Error(res.message || 'Room creation over Cloudflare URL failed'));
      }
    });
  });

  socket.disconnect();
  console.log('🎉 Cloudflare Live Public URL is 100% operational and verified!\n');
  process.exit(0);
}

verifyPublicDeployment().catch((err) => {
  console.error('Public URL verification error:', err);
  process.exit(1);
});

import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { env } from './lib/env';
import { disconnectPrisma } from './lib/prisma';

export function startServer() {
  let io: Server | undefined;
  const app = createApp(() => io);
  const server = http.createServer(app);

  io = new Server(server, {
    cors: {
      origin: env.frontendAllowedOrigins,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('thread:join', (threadId: string) => {
      socket.join(`thread:${threadId}`);
    });
  });

  server.on('error', (error) => {
    console.error('API server failed', error);
    process.exitCode = 1;
  });

  server.listen(env.apiPort, () => {
    console.log(`API listening on http://localhost:${env.apiPort}`);
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`${signal} received. Closing API server...`);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    io?.close();
    await disconnectPrisma();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  return { app, server, io };
}

if (require.main === module) {
  startServer();
}

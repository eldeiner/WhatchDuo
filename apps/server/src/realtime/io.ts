import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { corsOrigins, getEnv } from '../config/env';
import { logger } from '../lib/logger';
import { registerHandlers } from '../realtime/handlers';
import { detachParticipant } from '../realtime/presence';
import type { CineServer } from '../realtime/socketTypes';

export function createRealtime(httpServer: HttpServer): CineServer {
  const env = getEnv();
  const io: CineServer = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: corsOrigins(env),
      methods: ['GET', 'POST'],
      credentials: false,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 64 * 1024,
    connectTimeout: 10_000,
  });

  io.on('connection', (socket) => {
    logger.debug('socket_connected', {
      socketId: socket.id,
      transport: socket.conn.transport.name,
    });

    registerHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      void detachParticipant(io, socket, 'disconnect').catch((error: unknown) => {
        logger.error('disconnect_handler_failed', { error: (error as Error).message });
      });
      logger.debug('socket_disconnected', { socketId: socket.id, reason });
    });
  });

  return io;
}

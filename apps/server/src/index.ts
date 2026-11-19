import type { Server } from 'node:http';
import { getEnv } from './config/env';
import { logger } from './lib/logger';
import { disconnectPrisma } from './lib/prisma';
import { createCineServer } from './server';
import { allLiveRooms } from './services/roomStore';
import { flushPlayback, resetStalePresence, sweepRooms } from './services/roomService';

async function main(): Promise<void> {
  const env = getEnv();

  if (env.NODE_ENV === 'production' && env.TOKEN_SECRET.includes('dev-only')) {
    throw new Error('TOKEN_SECRET de desarrollo detectado en producción. Configura uno seguro.');
  }
  if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.includes('localhost')) {
    logger.warn('cors_localhost_in_production', { origins: env.CORS_ORIGINS });
  }

  await resetStalePresence().catch((error: unknown) => {
    logger.warn('presence_reset_failed', { error: (error as Error).message });
  });

  const { httpServer, io } = createCineServer();

  httpServer.listen(env.PORT, env.HOST, () => {
    logger.info('server_started', {
      port: env.PORT,
      host: env.HOST,
      env: env.NODE_ENV,
      webOrigin: env.WEB_ORIGIN,
    });
  });

  const sweepTimer = setInterval(() => {
    void sweepRooms()
      .then((closed) => {
        if (closed > 0) logger.info('rooms_swept', { closed });
      })
      .catch((error: unknown) => {
        logger.warn('rooms_sweep_failed', { error: (error as Error).message });
      });
  }, 5 * 60_000);
  sweepTimer.unref();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutdown_started', { signal });
    clearInterval(sweepTimer);

    await Promise.all(allLiveRooms().map((room) => flushPlayback(room).catch(() => undefined)));

    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      (httpServer as Server).close(() => resolve());
    });
    await disconnectPrisma().catch(() => undefined);
    logger.info('shutdown_complete');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', { reason: String(reason) });
  });
}

main().catch((error: unknown) => {
  logger.error('fatal_startup_error', { error: (error as Error).message });
  process.exit(1);
});

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { corsOrigins, getEnv } from './config/env';
import { errorHandler } from './lib/errors';
import { logger } from './lib/logger';
import { healthRouter } from './routes/health';
import { proxyRouter } from './routes/proxy';
import { roomsRouter } from './routes/rooms';

export function createApp(): Express {
  const env = getEnv();
  const app = express();
  const allowedOrigins = new Set(corsOrigins(env));

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        // Sin Origin (curl, healthchecks, apps nativas) se permite.
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Origen no permitido por CORS'));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );
  app.use(express.json({ limit: '32kb' }));

  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.setHeader('x-request-id', requestId);
    const startedAt = Date.now();
    res.on('finish', () => {
      if (req.path === '/api/health') return;
      logger.info('http_request', {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });

  app.use('/api', healthRouter());
  app.use('/api', proxyRouter());
  app.use('/api', roomsRouter());

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
  });
  app.use(errorHandler);

  return app;
}

import { Router } from 'express';
import type { HealthResponse } from '@cineduo/shared';
import { pingDatabase } from '../lib/prisma';
import { asyncHandler } from '../lib/http';

export function healthRouter(): Router {
  const router = Router();

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const database = await pingDatabase();
      const body: HealthResponse = {
        status: database ? 'ok' : 'degraded',
        uptimeSeconds: Math.round(process.uptime()),
        database: database ? 'up' : 'down',
        version: '0.1.0',
        serverTime: Date.now(),
      };
      res.status(database ? 200 : 503).json(body);
    }),
  );

  return router;
}

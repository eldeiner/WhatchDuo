import { createServer, type Server as HttpServer } from 'node:http';
import type { Express } from 'express';
import { createApp } from './app';
import { createRealtime } from './realtime/io';
import type { CineServer } from './realtime/socketTypes';

export interface CineServerBundle {
  app: Express;
  httpServer: HttpServer;
  io: CineServer;
}

export function createCineServer(): CineServerBundle {
  const app = createApp();
  const httpServer = createServer(app);
  const io = createRealtime(httpServer);
  return { app, httpServer, io };
}

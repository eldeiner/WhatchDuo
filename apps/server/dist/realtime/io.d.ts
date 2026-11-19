import type { Server as HttpServer } from 'node:http';
import type { CineServer } from '../realtime/socketTypes';
export declare function createRealtime(httpServer: HttpServer): CineServer;

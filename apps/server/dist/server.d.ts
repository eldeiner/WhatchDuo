import { type Server as HttpServer } from 'node:http';
import type { Express } from 'express';
import type { CineServer } from './realtime/socketTypes';
export interface CineServerBundle {
    app: Express;
    httpServer: HttpServer;
    io: CineServer;
}
export declare function createCineServer(): CineServerBundle;

import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@cineduo/shared';
export type CineServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type CineSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export declare const roomChannel: (code: string) => string;

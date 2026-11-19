import type { ChatMessage } from '@cineduo/shared';
import type { CineServer, CineSocket } from '../socketTypes';
export declare function registerChatHandlers(io: CineServer, socket: CineSocket): void;
export type { ChatMessage };

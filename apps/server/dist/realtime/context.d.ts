import type { ZodType } from 'zod';
import type { LiveParticipant, LiveRoom } from '../services/roomStore';
import type { SlidingWindowLimiter } from '../lib/rateLimiter';
import type { CineSocket } from '../realtime/socketTypes';
export interface SocketContext {
    room: LiveRoom;
    participant: LiveParticipant;
}
export declare function socketContext(socket: CineSocket): SocketContext;
export declare function parsePayload<T>(schema: ZodType<T>, payload: unknown): T;
export declare function enforceLimit(limiter: SlidingWindowLimiter, key: string): void;

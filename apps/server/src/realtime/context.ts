import type { ZodType } from 'zod';
import { AppError } from '../lib/errors';
import { ERROR_CODES } from '@cineduo/shared';
import type { LiveParticipant, LiveRoom } from '../services/roomStore';
import { getLiveRoom } from '../services/roomStore';
import type { SlidingWindowLimiter } from '../lib/rateLimiter';
import type { CineSocket } from '../realtime/socketTypes';

export interface SocketContext {
  room: LiveRoom;
  participant: LiveParticipant;
}

export function socketContext(socket: CineSocket): SocketContext {
  const { roomCode, participantId } = socket.data;
  if (!roomCode || !participantId) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Únete a una sala antes de continuar', 401);
  }
  const room = getLiveRoom(roomCode);
  if (!room || !room.isActive) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'La sala ya no está disponible', 404);
  }
  const participant = room.participants.get(participantId);
  if (!participant) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Participante no válido en esta sala', 401);
  }
  return { room, participant };
}

export function parsePayload<T>(schema: ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(
      ERROR_CODES.VALIDATION,
      'Datos inválidos',
      422,
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

export function enforceLimit(limiter: SlidingWindowLimiter, key: string): void {
  const result = limiter.consume(key);
  if (!result.allowed) {
    throw new AppError(ERROR_CODES.RATE_LIMITED, 'Vas demasiado rápido. Espera un momento.', 429, {
      retryAfterMs: result.retryAfterMs,
    });
  }
}

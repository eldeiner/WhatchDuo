import { MESSAGE_MAX, RATE_LIMITS } from '@cineduo/shared';
import { SlidingWindowLimiter } from './rateLimiter';

export const limiters = {
  createRoom: new SlidingWindowLimiter(
    RATE_LIMITS.createRoom.points,
    RATE_LIMITS.createRoom.windowMs,
  ),
  joinRoom: new SlidingWindowLimiter(RATE_LIMITS.joinRoom.points, RATE_LIMITS.joinRoom.windowMs),
  chat: new SlidingWindowLimiter(RATE_LIMITS.chat.points, RATE_LIMITS.chat.windowMs),
  reaction: new SlidingWindowLimiter(RATE_LIMITS.reaction.points, RATE_LIMITS.reaction.windowMs),
  command: new SlidingWindowLimiter(RATE_LIMITS.command.points, RATE_LIMITS.command.windowMs),
  ping: new SlidingWindowLimiter(RATE_LIMITS.ping.points, RATE_LIMITS.ping.windowMs),
};

export function resetLimiters(): void {
  for (const limiter of Object.values(limiters)) limiter.reset();
}

/**
 * Limpia el texto antes de persistirlo/mostrarlo:
 * - elimina caracteres de control y direccionales (spoofing)
 * - normaliza espacios/saltos
 * - recorta a MESSAGE_MAX
 * No se eliminan `<`/`>`: React escapa por defecto y se conservan emoticonos
 * como `<3`. El servidor nunca interpreta el texto como HTML.
 */
export function sanitizeChatText(input: string): string {
  const withoutControl = input
    .replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g,
      '',
    )
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return withoutControl.slice(0, MESSAGE_MAX);
}

export function normalizeNickname(input: string): string {
  return input.trim().replace(/\s{2,}/g, ' ');
}

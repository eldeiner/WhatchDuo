import { SlidingWindowLimiter } from './rateLimiter';
export declare const limiters: {
    createRoom: SlidingWindowLimiter;
    joinRoom: SlidingWindowLimiter;
    chat: SlidingWindowLimiter;
    reaction: SlidingWindowLimiter;
    command: SlidingWindowLimiter;
    ping: SlidingWindowLimiter;
};
export declare function resetLimiters(): void;
/**
 * Limpia el texto antes de persistirlo/mostrarlo:
 * - elimina caracteres de control y direccionales (spoofing)
 * - normaliza espacios/saltos
 * - recorta a MESSAGE_MAX
 * No se eliminan `<`/`>`: React escapa por defecto y se conservan emoticonos
 * como `<3`. El servidor nunca interpreta el texto como HTML.
 */
export declare function sanitizeChatText(input: string): string;
export declare function normalizeNickname(input: string): string;

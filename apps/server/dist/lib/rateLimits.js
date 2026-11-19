"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limiters = void 0;
exports.resetLimiters = resetLimiters;
exports.sanitizeChatText = sanitizeChatText;
exports.normalizeNickname = normalizeNickname;
const shared_1 = require("@cineduo/shared");
const rateLimiter_1 = require("./rateLimiter");
exports.limiters = {
    createRoom: new rateLimiter_1.SlidingWindowLimiter(shared_1.RATE_LIMITS.createRoom.points, shared_1.RATE_LIMITS.createRoom.windowMs),
    joinRoom: new rateLimiter_1.SlidingWindowLimiter(shared_1.RATE_LIMITS.joinRoom.points, shared_1.RATE_LIMITS.joinRoom.windowMs),
    chat: new rateLimiter_1.SlidingWindowLimiter(shared_1.RATE_LIMITS.chat.points, shared_1.RATE_LIMITS.chat.windowMs),
    reaction: new rateLimiter_1.SlidingWindowLimiter(shared_1.RATE_LIMITS.reaction.points, shared_1.RATE_LIMITS.reaction.windowMs),
    command: new rateLimiter_1.SlidingWindowLimiter(shared_1.RATE_LIMITS.command.points, shared_1.RATE_LIMITS.command.windowMs),
    ping: new rateLimiter_1.SlidingWindowLimiter(shared_1.RATE_LIMITS.ping.points, shared_1.RATE_LIMITS.ping.windowMs),
};
function resetLimiters() {
    for (const limiter of Object.values(exports.limiters))
        limiter.reset();
}
/**
 * Limpia el texto antes de persistirlo/mostrarlo:
 * - elimina caracteres de control y direccionales (spoofing)
 * - normaliza espacios/saltos
 * - recorta a MESSAGE_MAX
 * No se eliminan `<`/`>`: React escapa por defecto y se conservan emoticonos
 * como `<3`. El servidor nunca interpreta el texto como HTML.
 */
function sanitizeChatText(input) {
    const withoutControl = input
        .replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return withoutControl.slice(0, shared_1.MESSAGE_MAX);
}
function normalizeNickname(input) {
    return input.trim().replace(/\s{2,}/g, ' ');
}
//# sourceMappingURL=rateLimits.js.map
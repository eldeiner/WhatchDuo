"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketContext = socketContext;
exports.parsePayload = parsePayload;
exports.enforceLimit = enforceLimit;
const errors_1 = require("../lib/errors");
const shared_1 = require("@cineduo/shared");
const roomStore_1 = require("../services/roomStore");
function socketContext(socket) {
    const { roomCode, participantId } = socket.data;
    if (!roomCode || !participantId) {
        throw new errors_1.AppError(shared_1.ERROR_CODES.UNAUTHORIZED, 'Únete a una sala antes de continuar', 401);
    }
    const room = (0, roomStore_1.getLiveRoom)(roomCode);
    if (!room || !room.isActive) {
        throw new errors_1.AppError(shared_1.ERROR_CODES.NOT_FOUND, 'La sala ya no está disponible', 404);
    }
    const participant = room.participants.get(participantId);
    if (!participant) {
        throw new errors_1.AppError(shared_1.ERROR_CODES.UNAUTHORIZED, 'Participante no válido en esta sala', 401);
    }
    return { room, participant };
}
function parsePayload(schema, payload) {
    const result = schema.safeParse(payload);
    if (!result.success) {
        throw new errors_1.AppError(shared_1.ERROR_CODES.VALIDATION, 'Datos inválidos', 422, result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })));
    }
    return result.data;
}
function enforceLimit(limiter, key) {
    const result = limiter.consume(key);
    if (!result.allowed) {
        throw new errors_1.AppError(shared_1.ERROR_CODES.RATE_LIMITED, 'Vas demasiado rápido. Espera un momento.', 429, {
            retryAfterMs: result.retryAfterMs,
        });
    }
}
//# sourceMappingURL=context.js.map
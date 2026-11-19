"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHostHandlers = registerHostHandlers;
const shared_1 = require("@cineduo/shared");
const errors_1 = require("../../lib/errors");
const rateLimits_1 = require("../../lib/rateLimits");
const roomService_1 = require("../../services/roomService");
const context_1 = require("../context");
const emit_1 = require("../emit");
const presence_1 = require("../presence");
function registerHostHandlers(io, socket) {
    socket.on('host:transfer', async (payload, ack) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            (0, context_1.enforceLimit)(rateLimits_1.limiters.command, participant.id);
            const data = (0, context_1.parsePayload)(shared_1.transferHostSchema, payload);
            const result = await (0, roomService_1.transferHost)(room, data.targetParticipantId, participant.id);
            (0, presence_1.clearHostGrace)(room);
            (0, emit_1.emitHostChanged)(io, room, 'transfer');
            (0, emit_1.emitPlaybackSnapshot)(io, room);
            (0, emit_1.broadcastSync)(io, room, 'host', result.newHost.id);
            (0, emit_1.broadcastSystemNotice)(io, room, `${participant.nickname} pasó el control a ${result.newHost.nickname}`);
            if (typeof ack === 'function') {
                ack({ ok: true, data: { ...room.playback } });
            }
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack, 'host:transfer');
        }
    });
    socket.on('host:request', (ack) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            if (participant.role === 'host') {
                throw new errors_1.AppError('VALIDATION_ERROR', 'Ya controlas la reproducción', 422);
            }
            const host = room.participants.get(room.playback.hostId);
            if (!host?.socketId) {
                throw new errors_1.AppError('CONFLICT', 'El host no está conectado. En breve se elegirá un nuevo host.', 409);
            }
            (0, context_1.enforceLimit)(rateLimits_1.limiters.command, participant.id);
            io.to(host.socketId).emit('peer:request-control', {
                participantId: participant.id,
                nickname: participant.nickname,
            });
            if (typeof ack === 'function')
                ack({ ok: true, data: { requested: true } });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack, 'host:request');
        }
    });
}
//# sourceMappingURL=host.js.map
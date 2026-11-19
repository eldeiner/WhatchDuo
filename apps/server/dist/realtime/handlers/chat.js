"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatHandlers = registerChatHandlers;
const shared_1 = require("@cineduo/shared");
const errors_1 = require("../../lib/errors");
const rateLimits_1 = require("../../lib/rateLimits");
const roomService_1 = require("../../services/roomService");
const context_1 = require("../context");
const emit_1 = require("../emit");
const node_crypto_1 = require("node:crypto");
function registerChatHandlers(io, socket) {
    socket.on('chat:send', async (payload, ack) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            (0, context_1.enforceLimit)(rateLimits_1.limiters.chat, participant.id);
            const data = (0, context_1.parsePayload)(shared_1.chatSendSchema, payload);
            const text = (0, rateLimits_1.sanitizeChatText)(data.text);
            if (!text)
                throw new errors_1.AppError('VALIDATION_ERROR', 'El mensaje está vacío', 422);
            const message = await (0, roomService_1.appendMessage)(room, participant, text);
            (0, emit_1.broadcastChat)(io, room, message);
            if (typeof ack === 'function')
                ack({ ok: true, data: message });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack, 'chat:send');
        }
    });
    socket.on('chat:reaction', (payload) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            (0, context_1.enforceLimit)(rateLimits_1.limiters.reaction, participant.id);
            const data = (0, context_1.parsePayload)(shared_1.reactionSendSchema, payload);
            const reaction = {
                id: (0, node_crypto_1.randomUUID)(),
                participantId: participant.id,
                nickname: participant.nickname,
                emoji: data.emoji,
                createdAt: Date.now(),
            };
            io.to(`room:${room.code}`).emit('chat:reaction', { reaction });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error);
        }
    });
}
//# sourceMappingURL=chat.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoomHandlers = registerRoomHandlers;
const shared_1 = require("@cineduo/shared");
const env_1 = require("../../config/env");
const errors_1 = require("../../lib/errors");
const rateLimits_1 = require("../../lib/rateLimits");
const mediaExtractor_1 = require("../../services/mediaExtractor");
const roomService_1 = require("../../services/roomService");
const context_1 = require("../context");
const emit_1 = require("../emit");
const presence_1 = require("../presence");
const emit_2 = require("../emit");
function registerRoomHandlers(io, socket) {
    socket.on('room:create', async (payload, ack) => {
        try {
            (0, context_1.enforceLimit)(rateLimits_1.limiters.createRoom, socket.handshake.address || socket.id);
            if (socket.data.roomCode) {
                throw new errors_1.AppError('CONFLICT', 'Ya estás en una sala. Sal antes de crear otra.', 409);
            }
            const data = (0, context_1.parsePayload)(shared_1.createRoomPayloadSchema, payload);
            let finalVideoUrl = data.videoUrl;
            let finalVideoType = data.videoUrl ? (0, shared_1.detectVideoType)(data.videoUrl) : undefined;
            if (data.videoUrl) {
                const extracted = await (0, mediaExtractor_1.extractMediaSource)(data.videoUrl);
                if (extracted) {
                    finalVideoUrl = extracted.streamUrl;
                    finalVideoType = extracted.type;
                }
            }
            const created = await (0, roomService_1.createRoom)({
                nickname: data.nickname,
                videoUrl: finalVideoUrl,
                videoType: finalVideoType,
            });
            await (0, presence_1.attachParticipant)(io, socket, created.room, created.participant, false);
            const response = {
                roomCode: created.room.code,
                joinUrl: `${(0, env_1.getEnv)().WEB_ORIGIN}/room/${created.room.code}`,
                participantToken: created.token,
                participant: {
                    id: created.participant.id,
                    nickname: created.participant.nickname,
                    role: created.participant.role,
                    isConnected: true,
                    lastSeen: created.participant.lastSeen,
                },
                playback: { ...created.room.playback },
            };
            if (typeof ack === 'function')
                ack({ ok: true, data: response });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack, 'room:create');
        }
    });
    socket.on('room:join', async (payload, ack) => {
        try {
            (0, context_1.enforceLimit)(rateLimits_1.limiters.joinRoom, socket.handshake.address || socket.id);
            const data = (0, context_1.parsePayload)(shared_1.joinRoomPayloadSchema, payload);
            const handshakeToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
            if (socket.data.roomCode) {
                const current = (0, context_1.socketContext)(socket);
                if (current.room.code === data.code) {
                    if (typeof ack === 'function')
                        ack({ ok: true, data: (0, emit_2.buildRoomState)(current.room) });
                    return;
                }
                throw new errors_1.AppError('CONFLICT', 'Ya estás en otra sala. Sal primero.', 409);
            }
            const joined = await (0, roomService_1.joinRoom)({
                code: data.code,
                nickname: data.nickname,
                token: data.token ?? handshakeToken,
            });
            await (0, presence_1.attachParticipant)(io, socket, joined.room, joined.participant, joined.reconnected);
            const response = (0, emit_2.buildRoomState)(joined.room);
            if (typeof ack === 'function')
                ack({ ok: true, data: response });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack, 'room:join');
        }
    });
    socket.on('room:leave', async (ack) => {
        try {
            (0, context_1.socketContext)(socket);
            await (0, presence_1.detachParticipant)(io, socket, 'leave');
            if (typeof ack === 'function')
                ack({ ok: true, data: { left: true } });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack, 'room:leave');
        }
    });
}
//# sourceMappingURL=room.js.map
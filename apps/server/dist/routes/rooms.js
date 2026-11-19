"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsRouter = roomsRouter;
const express_1 = require("express");
const shared_1 = require("@cineduo/shared");
const env_1 = require("../config/env");
const errors_1 = require("../lib/errors");
const http_1 = require("../lib/http");
const rateLimits_1 = require("../lib/rateLimits");
const tokens_1 = require("../lib/tokens");
const mediaExtractor_1 = require("../services/mediaExtractor");
const roomService_1 = require("../services/roomService");
const roomStore_1 = require("../services/roomStore");
function roomsRouter() {
    const router = (0, express_1.Router)();
    router.post('/rooms', (0, http_1.asyncHandler)(async (req, res) => {
        const limit = rateLimits_1.limiters.createRoom.consume((0, http_1.clientIp)(req));
        if (!limit.allowed) {
            throw new errors_1.AppError('RATE_LIMITED', 'Demasiadas salas creadas. Prueba más tarde.', 429, {
                retryAfterMs: limit.retryAfterMs,
            });
        }
        const data = shared_1.createRoomSchema.parse(req.body);
        let finalVideoUrl = data.videoUrl;
        let finalVideoType = data.videoUrl ? (0, shared_1.detectVideoType)(data.videoUrl) : undefined;
        if (data.videoUrl) {
            const extracted = await (0, mediaExtractor_1.extractMediaSource)(data.videoUrl);
            if (extracted) {
                finalVideoUrl = extracted.streamUrl;
                finalVideoType = extracted.type;
            }
        }
        const { room, participant, token } = await (0, roomService_1.createRoom)({
            nickname: data.nickname,
            videoUrl: finalVideoUrl,
            videoType: finalVideoType,
        });
        const body = {
            roomCode: room.code,
            joinUrl: `${(0, env_1.getEnv)().WEB_ORIGIN}/room/${room.code}`,
            participantToken: token,
            participant: (0, roomStore_1.participantToDto)(participant),
            playback: { ...room.playback },
        };
        res.status(201).json(body);
    }));
    router.get('/rooms/:code', (0, http_1.asyncHandler)(async (req, res) => {
        const code = shared_1.roomCodeSchema.parse(req.params.code);
        const limit = rateLimits_1.limiters.joinRoom.consume((0, http_1.clientIp)(req));
        if (!limit.allowed) {
            throw new errors_1.AppError('RATE_LIMITED', 'Demasiadas consultas. Espera un momento.', 429);
        }
        const room = await (0, roomService_1.requireRoom)(code);
        const body = {
            room: { code: room.code, createdAt: room.createdAt, isActive: room.isActive },
            playback: { ...room.playback },
            participants: (0, roomService_1.listParticipants)(room),
            serverTime: Date.now(),
        };
        res.json(body);
    }));
    router.post('/rooms/:code/join', (0, http_1.asyncHandler)(async (req, res) => {
        const limit = rateLimits_1.limiters.joinRoom.consume((0, http_1.clientIp)(req));
        if (!limit.allowed) {
            throw new errors_1.AppError('RATE_LIMITED', 'Demasiados intentos para unirse. Espera un momento.', 429, {
                retryAfterMs: limit.retryAfterMs,
            });
        }
        const code = shared_1.roomCodeSchema.parse(req.params.code);
        const data = shared_1.joinRoomSchema.parse(req.body);
        const joined = await (0, roomService_1.joinRoom)({ code, nickname: data.nickname });
        const token = (0, tokens_1.signParticipantToken)({ pid: joined.participant.id, rid: joined.room.id }, (0, env_1.getEnv)().TOKEN_SECRET);
        const body = {
            roomCode: joined.room.code,
            participantToken: token,
            participant: (0, roomStore_1.participantToDto)(joined.participant),
            playback: { ...joined.room.playback },
            participants: (0, roomService_1.listParticipants)(joined.room),
        };
        res.json(body);
    }));
    router.get('/rooms/:code/messages', (0, http_1.asyncHandler)(async (req, res) => {
        const code = shared_1.roomCodeSchema.parse(req.params.code);
        const room = await (0, roomService_1.requireRoom)(code);
        const token = (0, http_1.getBearerToken)(req);
        if (!token)
            throw new errors_1.AppError('UNAUTHORIZED', 'Falta el token de participante', 401);
        const payload = (0, tokens_1.verifyParticipantToken)(token, (0, env_1.getEnv)().TOKEN_SECRET);
        if (!payload || payload.rid !== room.id || !room.participants.has(payload.pid)) {
            throw new errors_1.AppError('UNAUTHORIZED', 'Token inválido para esta sala', 401);
        }
        const rawLimit = Number.parseInt(String(req.query.limit ?? '100'), 10);
        const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
        const body = { messages: await (0, roomService_1.listMessages)(room, limit) };
        res.json(body);
    }));
    return router;
}
//# sourceMappingURL=rooms.js.map
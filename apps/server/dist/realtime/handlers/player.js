"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPlayerHandlers = registerPlayerHandlers;
const shared_1 = require("@cineduo/shared");
const rateLimits_1 = require("../../lib/rateLimits");
const playbackService_1 = require("../../services/playbackService");
const context_1 = require("../context");
const emit_1 = require("../emit");
const socketTypes_1 = require("../socketTypes");
function registerPlayerHandlers(io, socket) {
    socket.on('player:play', (payload, ack) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            (0, context_1.enforceLimit)(rateLimits_1.limiters.command, participant.id);
            const data = (0, context_1.parsePayload)(shared_1.playCommandSchema, payload);
            const state = (0, playbackService_1.play)(room, participant.id, data.position);
            (0, emit_1.broadcastSync)(io, room, 'command', participant.id);
            (0, emit_1.broadcastCommand)(io, room, 'play', participant.id);
            ack?.({ ok: true, data: state });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack);
        }
    });
    socket.on('player:pause', (payload, ack) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            (0, context_1.enforceLimit)(rateLimits_1.limiters.command, participant.id);
            const data = (0, context_1.parsePayload)(shared_1.pauseCommandSchema, payload);
            const state = (0, playbackService_1.pause)(room, participant.id, data.position);
            (0, emit_1.broadcastSync)(io, room, 'command', participant.id);
            (0, emit_1.broadcastCommand)(io, room, 'pause', participant.id);
            ack?.({ ok: true, data: state });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack);
        }
    });
    socket.on('player:seek', (payload, ack) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            (0, context_1.enforceLimit)(rateLimits_1.limiters.command, participant.id);
            const data = (0, context_1.parsePayload)(shared_1.seekCommandSchema, payload);
            const state = (0, playbackService_1.seek)(room, participant.id, data.position);
            (0, emit_1.broadcastSync)(io, room, 'command', participant.id);
            (0, emit_1.broadcastCommand)(io, room, 'seek', participant.id);
            ack?.({ ok: true, data: state });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack);
        }
    });
    socket.on('player:rate', (payload, ack) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            (0, context_1.enforceLimit)(rateLimits_1.limiters.command, participant.id);
            const data = (0, context_1.parsePayload)(shared_1.rateCommandSchema, payload);
            const state = (0, playbackService_1.setRate)(room, participant.id, data.rate, data.position);
            (0, emit_1.broadcastSync)(io, room, 'command', participant.id);
            (0, emit_1.broadcastCommand)(io, room, 'rate', participant.id);
            ack?.({ ok: true, data: state });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack);
        }
    });
    socket.on('player:set-video', async (payload, ack) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            (0, context_1.enforceLimit)(rateLimits_1.limiters.command, participant.id);
            const data = (0, context_1.parsePayload)(shared_1.setVideoSchema, payload);
            const state = await (0, playbackService_1.setVideo)(room, participant.id, data.videoUrl);
            (0, emit_1.emitPlaybackSnapshot)(io, room);
            (0, emit_1.broadcastSync)(io, room, 'video', participant.id);
            ack?.({ ok: true, data: state });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error, ack);
        }
    });
    socket.on('player:heartbeat', (payload) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            const data = (0, context_1.parsePayload)(shared_1.heartbeatSchema, payload);
            if (room.playback.hostId !== participant.id) {
                // Los invitados no tienen autoridad: se ignora silenciosamente para no
                // generar ruido si un cliente antiguo envía heartbeats.
                return;
            }
            (0, context_1.enforceLimit)(rateLimits_1.limiters.command, participant.id);
            const outcome = (0, playbackService_1.applyHeartbeat)(room, participant.id, {
                position: data.position,
                isPlaying: data.isPlaying,
            });
            if (outcome.corrected) {
                (0, emit_1.broadcastSync)(io, room, 'heartbeat', participant.id);
            }
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error);
        }
    });
    socket.on('player:buffering', (payload) => {
        try {
            const { room, participant } = (0, context_1.socketContext)(socket);
            const data = (0, context_1.parsePayload)(shared_1.bufferingSchema, payload);
            socket.to((0, socketTypes_1.roomChannel)(room.code)).emit('peer:buffering', {
                participantId: participant.id,
                nickname: participant.nickname,
                isBuffering: data.isBuffering,
            });
        }
        catch (error) {
            (0, emit_1.replyError)(socket, error);
        }
    });
}
//# sourceMappingURL=player.js.map
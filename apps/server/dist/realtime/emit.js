"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRoomState = buildRoomState;
exports.emitRoomState = emitRoomState;
exports.emitStateTo = emitStateTo;
exports.broadcastSync = broadcastSync;
exports.broadcastCommand = broadcastCommand;
exports.broadcastSystemNotice = broadcastSystemNotice;
exports.broadcastChat = broadcastChat;
exports.emitParticipantJoined = emitParticipantJoined;
exports.emitParticipantReconnected = emitParticipantReconnected;
exports.emitParticipantLeft = emitParticipantLeft;
exports.emitHostChanged = emitHostChanged;
exports.emitPlaybackSnapshot = emitPlaybackSnapshot;
exports.emitErrorToSocket = emitErrorToSocket;
exports.failAck = failAck;
exports.replyError = replyError;
exports.errorPayload = errorPayload;
exports.participantDto = participantDto;
exports.playbackDto = playbackDto;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@cineduo/shared");
const errors_1 = require("../lib/errors");
const roomStore_1 = require("../services/roomStore");
const socketTypes_1 = require("./socketTypes");
function buildRoomState(room) {
    return {
        room: { code: room.code, createdAt: room.createdAt, isActive: room.isActive },
        playback: { ...room.playback },
        participants: (0, roomStore_1.sortParticipants)([...room.participants.values()]).map(roomStore_1.participantToDto),
        serverTime: Date.now(),
    };
}
function emitRoomState(io, room) {
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('room:state', buildRoomState(room));
}
function emitStateTo(socket, room) {
    socket.emit('room:state', buildRoomState(room));
}
function broadcastSync(io, room, reason, by) {
    const payload = {
        position: room.playback.position,
        isPlaying: room.playback.isPlaying,
        playbackRate: room.playback.playbackRate,
        updatedAt: room.playback.updatedAt,
        version: room.playback.version,
        serverTime: Date.now(),
        by,
        reason,
    };
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('player:sync', payload);
}
function broadcastCommand(io, room, type, by) {
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('player:command', {
        type,
        position: room.playback.position,
        rate: room.playback.playbackRate,
        by,
        version: room.playback.version,
        serverTime: Date.now(),
    });
}
function broadcastSystemNotice(io, room, text) {
    const notice = { id: (0, node_crypto_1.randomUUID)(), text, createdAt: Date.now() };
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('chat:system', { notice });
    return notice;
}
function broadcastChat(io, room, message) {
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('chat:message', { message });
}
function emitParticipantJoined(io, room, participant) {
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('participant:joined', {
        participant: (0, roomStore_1.participantToDto)(participant),
        serverTime: Date.now(),
    });
}
function emitParticipantReconnected(io, room, participant) {
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('participant:reconnected', {
        participant: (0, roomStore_1.participantToDto)(participant),
        serverTime: Date.now(),
    });
}
function emitParticipantLeft(io, room, participant) {
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('participant:left', {
        participantId: participant.id,
        nickname: participant.nickname,
        serverTime: Date.now(),
    });
}
function emitHostChanged(io, room, by) {
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('host:changed', { hostId: room.playback.hostId, by });
}
function emitPlaybackSnapshot(io, room) {
    io.to((0, socketTypes_1.roomChannel)(room.code)).emit('room:state', buildRoomState(room));
}
function emitErrorToSocket(socket, error, request) {
    const wsError = (0, errors_1.toWsError)(error);
    socket.emit('error', { ...wsError, ...(request ? { request } : {}) });
}
function failAck(error) {
    const wsError = (0, errors_1.toWsError)(error);
    return {
        ok: false,
        error: {
            code: wsError.code,
            message: wsError.message,
            details: wsError.details,
        },
    };
}
/** Responde por ack si existe; en cualquier caso notifica el error por evento. */
function replyError(socket, error, ack, request) {
    emitErrorToSocket(socket, error, request);
    if (typeof ack === 'function')
        ack(failAck(error));
}
function errorPayload(code, message) {
    return { code: shared_1.ERROR_CODES[code], message };
}
function participantDto(participant) {
    return (0, roomStore_1.participantToDto)(participant);
}
function playbackDto(room) {
    return { ...room.playback };
}
//# sourceMappingURL=emit.js.map
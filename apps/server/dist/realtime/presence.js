"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachParticipant = attachParticipant;
exports.detachParticipant = detachParticipant;
exports.clearHostGrace = clearHostGrace;
const roomStore_1 = require("../services/roomStore");
const roomService_1 = require("../services/roomService");
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const socketTypes_1 = require("./socketTypes");
const emit_1 = require("./emit");
/** Participantes que ya se conectaron en este proceso (para el aviso correcto). */
const seenParticipants = new Set();
async function attachParticipant(io, socket, room, participant, reconnected) {
    const previousSocketId = participant.socketId;
    const isReturning = seenParticipants.has(participant.id);
    seenParticipants.add(participant.id);
    await socket.join((0, socketTypes_1.roomChannel)(room.code));
    socket.data.participantId = participant.id;
    socket.data.roomCode = room.code;
    socket.data.nickname = participant.nickname;
    await (0, roomService_1.setParticipantConnection)(room, participant.id, socket.id);
    // Si el mismo participante tenía otra pestaña/dispositivo, cerramos la vieja.
    // Se hace después de actualizar el socketId para que el handler de desconexión
    // del socket antiguo no marque como ausente al participante.
    if (previousSocketId && previousSocketId !== socket.id) {
        const previous = io.sockets.sockets.get(previousSocketId);
        if (previous)
            previous.disconnect(true);
    }
    if (participant.role === 'host' && room.hostGraceTimer) {
        clearTimeout(room.hostGraceTimer);
        room.hostGraceTimer = null;
    }
    socket.emit('room:state', (0, emit_1.buildRoomState)(room));
    if (reconnected) {
        socket.to((0, socketTypes_1.roomChannel)(room.code)).emit('participant:reconnected', {
            participant: {
                id: participant.id,
                nickname: participant.nickname,
                role: participant.role,
                isConnected: true,
                lastSeen: participant.lastSeen,
            },
            serverTime: Date.now(),
        });
        (0, emit_1.broadcastSystemNotice)(io, room, isReturning
            ? `${participant.nickname} volvió a la sala`
            : `${participant.nickname} se unió a la sala`);
    }
    else {
        (0, emit_1.emitParticipantJoined)(io, room, participant);
        (0, emit_1.broadcastSystemNotice)(io, room, `${participant.nickname} se unió a la sala`);
    }
    logger_1.logger.info('participant_attached', {
        code: room.code,
        participantId: participant.id,
        role: participant.role,
        reconnected,
    });
}
async function detachParticipant(io, socket, mode) {
    const { roomCode, participantId } = socket.data;
    if (!roomCode || !participantId)
        return;
    const room = (0, roomStore_1.getLiveRoom)(roomCode);
    if (!room)
        return;
    const participant = room.participants.get(participantId);
    // Un socket antiguo no debe desconectar a la conexión nueva del participante.
    if (!participant || participant.socketId !== socket.id)
        return;
    socket.data.participantId = undefined;
    socket.data.roomCode = undefined;
    socket.data.nickname = undefined;
    await (0, roomService_1.setParticipantConnection)(room, participant.id, null);
    (0, emit_1.emitParticipantLeft)(io, room, participant);
    (0, emit_1.emitPlaybackSnapshot)(io, room);
    if (participant.role === 'host') {
        scheduleHostGrace(io, room, participant, mode);
    }
    else {
        (0, emit_1.broadcastSystemNotice)(io, room, `${participant.nickname} salió de la sala`);
    }
    if (mode === 'leave') {
        await socket.leave((0, socketTypes_1.roomChannel)(room.code));
    }
    logger_1.logger.info('participant_detached', { code: room.code, participantId, mode });
}
function scheduleHostGrace(io, room, host, mode) {
    if (room.hostGraceTimer)
        clearTimeout(room.hostGraceTimer);
    const graceMs = (0, env_1.getEnv)().HOST_DISCONNECT_GRACE_MS;
    (0, emit_1.broadcastSystemNotice)(io, room, mode === 'disconnect'
        ? `El host perdió la conexión. Si no vuelve en ${Math.round(graceMs / 1000)} s, otro participante tomará el control.`
        : 'El host salió de la sala. Esperando para transferir el control…');
    room.hostGraceTimer = setTimeout(() => {
        room.hostGraceTimer = null;
        void promoteAfterTimeout(io, room, host.id);
    }, graceMs);
    room.hostGraceTimer.unref?.();
}
async function promoteAfterTimeout(io, room, previousHostId) {
    if (!room.isActive)
        return;
    const previousHost = room.participants.get(previousHostId);
    if (previousHost?.isConnected)
        return;
    const nextHost = (0, roomService_1.pickNextHost)(room, previousHostId);
    if (!nextHost) {
        (0, emit_1.broadcastSystemNotice)(io, room, 'No hay invitados conectados para tomar el control.');
        return;
    }
    await (0, roomService_1.promoteHost)(room, nextHost, 'timeout');
    (0, emit_1.emitHostChanged)(io, room, 'timeout');
    (0, emit_1.emitPlaybackSnapshot)(io, room);
    (0, emit_1.broadcastSync)(io, room, 'host', nextHost.id);
    (0, emit_1.broadcastSystemNotice)(io, room, `${nextHost.nickname} ahora controla la reproducción.`);
    logger_1.logger.info('host_promoted_after_timeout', { code: room.code, hostId: nextHost.id });
}
/** Al cerrar el proceso: avisa y persiste. */
function clearHostGrace(room) {
    if (room.hostGraceTimer) {
        clearTimeout(room.hostGraceTimer);
        room.hostGraceTimer = null;
    }
}
//# sourceMappingURL=presence.js.map
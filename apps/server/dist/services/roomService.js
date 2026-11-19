"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRoom = loadRoom;
exports.requireRoom = requireRoom;
exports.createRoom = createRoom;
exports.joinRoom = joinRoom;
exports.participantFromToken = participantFromToken;
exports.listParticipants = listParticipants;
exports.getParticipant = getParticipant;
exports.setParticipantConnection = setParticipantConnection;
exports.leaveRoom = leaveRoom;
exports.promoteHost = promoteHost;
exports.transferHost = transferHost;
exports.pickNextHost = pickNextHost;
exports.toChatMessage = toChatMessage;
exports.appendMessage = appendMessage;
exports.listMessages = listMessages;
exports.schedulePersist = schedulePersist;
exports.flushPlayback = flushPlayback;
exports.recordEvent = recordEvent;
exports.closeRoom = closeRoom;
exports.sweepRooms = sweepRooms;
exports.resetStalePresence = resetStalePresence;
exports.roomAgeHours = roomAgeHours;
const shared_1 = require("@cineduo/shared");
const env_1 = require("../config/env");
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const prisma_1 = require("../lib/prisma");
const roomCode_1 = require("../lib/roomCode");
const rateLimits_1 = require("../lib/rateLimits");
const tokens_1 = require("../lib/tokens");
const roomStore_1 = require("./roomStore");
function toVideoType(value) {
    return shared_1.VIDEO_TYPES.includes(value) ? value : 'mp4';
}
function hydrateParticipant(row) {
    return {
        id: row.id,
        nickname: row.nickname,
        role: row.role === 'host' ? 'host' : 'guest',
        isConnected: false,
        lastSeen: row.lastSeen.getTime(),
        socketId: null,
        joinedAt: row.createdAt.getTime(),
    };
}
function hydrateRoom(row) {
    const playback = {
        videoUrl: row.videoUrl,
        videoType: toVideoType(row.videoType),
        position: row.position,
        isPlaying: row.isPlaying,
        playbackRate: row.playbackRate ?? 1,
        updatedAt: row.updatedAt.getTime(),
        version: row.version,
        hostId: row.hostId ?? '',
    };
    const participants = new Map();
    for (const participant of row.participants) {
        participants.set(participant.id, hydrateParticipant(participant));
    }
    return {
        id: row.id,
        code: row.code,
        createdAt: row.createdAt.getTime(),
        isActive: row.isActive,
        playback,
        participants,
        hostGraceTimer: null,
        persistTimer: null,
        lastActivityAt: Date.now(),
    };
}
/** Carga la sala desde memoria o desde la base de datos. */
async function loadRoom(code) {
    const normalized = code.toUpperCase();
    const cached = (0, roomStore_1.getLiveRoom)(normalized);
    if (cached?.isActive)
        return cached;
    const row = await prisma_1.prisma.room.findUnique({
        where: { code: normalized },
        include: { participants: true },
    });
    if (!row || !row.isActive)
        return null;
    // Los sockets no sobreviven a un reinicio: la presencia se reconstruye al conectar.
    for (const participant of row.participants)
        participant.isConnected = false;
    const room = hydrateRoom(row);
    (0, roomStore_1.setLiveRoom)(room);
    return room;
}
async function requireRoom(code) {
    const room = await loadRoom(code);
    if (!room)
        throw (0, errors_1.notFound)('La sala no existe o ya está cerrada');
    return room;
}
async function createRoom(input) {
    const env = (0, env_1.getEnv)();
    const nickname = (0, rateLimits_1.normalizeNickname)(input.nickname);
    const code = await (0, roomCode_1.generateUniqueRoomCode)(async (candidate) => {
        const existing = await prisma_1.prisma.room.findUnique({
            where: { code: candidate },
            select: { id: true },
        });
        return existing !== null;
    });
    const created = await prisma_1.prisma.$transaction(async (tx) => {
        const room = await tx.room.create({
            data: {
                code,
                videoUrl: input.videoUrl ?? null,
                videoType: input.videoType ?? 'mp4',
                position: 0,
                isPlaying: false,
                playbackRate: 1,
                version: 1,
                isActive: true,
            },
        });
        const participant = await tx.participant.create({
            data: {
                roomId: room.id,
                nickname,
                role: 'host',
                isConnected: false,
                socketId: null,
            },
        });
        await tx.room.update({ where: { id: room.id }, data: { hostId: participant.id } });
        await tx.roomEvent.create({
            data: {
                roomId: room.id,
                participantId: participant.id,
                type: 'room:create',
                payload: JSON.stringify({ videoUrl: input.videoUrl ?? null }),
            },
        });
        return { room, participant };
    });
    const live = {
        id: created.room.id,
        code: created.room.code,
        createdAt: created.room.createdAt.getTime(),
        isActive: true,
        playback: {
            videoUrl: created.room.videoUrl,
            videoType: toVideoType(created.room.videoType),
            position: 0,
            isPlaying: false,
            playbackRate: 1,
            updatedAt: Date.now(),
            version: 1,
            hostId: created.participant.id,
        },
        participants: new Map(),
        hostGraceTimer: null,
        persistTimer: null,
        lastActivityAt: Date.now(),
    };
    const participant = {
        id: created.participant.id,
        nickname: created.participant.nickname,
        role: 'host',
        isConnected: false,
        lastSeen: Date.now(),
        socketId: null,
        joinedAt: created.participant.createdAt.getTime(),
    };
    live.participants.set(participant.id, participant);
    (0, roomStore_1.setLiveRoom)(live);
    void prisma_1.prisma.participant
        .update({ where: { id: participant.id }, data: { lastSeen: new Date() } })
        .catch(() => undefined);
    const token = (0, tokens_1.signParticipantToken)({ pid: participant.id, rid: live.id }, env.TOKEN_SECRET);
    logger_1.logger.info('room_created', { code: live.code, participantId: participant.id });
    return { room: live, participant, token };
}
async function joinRoom(input) {
    const env = (0, env_1.getEnv)();
    const room = await requireRoom(input.code);
    if (input.token) {
        const payload = (0, tokens_1.verifyParticipantToken)(input.token, env.TOKEN_SECRET);
        if (!payload)
            throw (0, errors_1.unauthorized)('El enlace de la sala ha caducado. Vuelve a unirte con el código.');
        if (payload.rid !== room.id)
            throw (0, errors_1.unauthorized)('El token no pertenece a esta sala');
        const participant = room.participants.get(payload.pid);
        if (!participant)
            throw (0, errors_1.unauthorized)('Participante no encontrado en la sala');
        return { room, participant, reconnected: true };
    }
    const rawNickname = input.nickname?.trim();
    if (!rawNickname)
        throw (0, errors_1.validationError)('Necesitas un apodo para entrar');
    const nickname = (0, rateLimits_1.normalizeNickname)(rawNickname);
    // Reutiliza un participante desconectado con el mismo apodo (recarga sin token).
    const reusable = [...room.participants.values()].find((p) => !p.isConnected && p.nickname.toLowerCase() === nickname.toLowerCase() && p.role !== 'host');
    if (reusable)
        return { room, participant: reusable, reconnected: true };
    const connectedCount = [...room.participants.values()].filter((p) => p.isConnected).length;
    if (connectedCount >= env.MAX_PARTICIPANTS) {
        throw new errors_1.AppError('ROOM_FULL', 'La sala está llena. Pide al host que libere un sitio.', 409);
    }
    const row = await prisma_1.prisma.participant.create({
        data: { roomId: room.id, nickname, role: 'guest', isConnected: false, socketId: null },
    });
    const participant = {
        id: row.id,
        nickname: row.nickname,
        role: 'guest',
        isConnected: false,
        lastSeen: Date.now(),
        socketId: null,
        joinedAt: row.createdAt.getTime(),
    };
    room.participants.set(participant.id, participant);
    room.lastActivityAt = Date.now();
    logger_1.logger.info('room_joined', { code: room.code, participantId: participant.id });
    return { room, participant, reconnected: false };
}
/** Reconstruye el participante a partir de un token ya verificado (uso en socket). */
async function participantFromToken(room, token) {
    const env = (0, env_1.getEnv)();
    const payload = (0, tokens_1.verifyParticipantToken)(token, env.TOKEN_SECRET);
    if (!payload || payload.rid !== room.id)
        throw (0, errors_1.unauthorized)();
    const participant = room.participants.get(payload.pid);
    if (!participant)
        throw (0, errors_1.unauthorized)('Participante no encontrado');
    return participant;
}
function listParticipants(room) {
    return (0, roomStore_1.sortParticipants)([...room.participants.values()]).map(roomStore_1.participantToDto);
}
function getParticipant(room, participantId) {
    return room.participants.get(participantId) ?? null;
}
async function setParticipantConnection(room, participantId, socketId) {
    const participant = room.participants.get(participantId);
    if (!participant)
        throw (0, errors_1.notFound)('Participante no encontrado');
    participant.socketId = socketId;
    participant.isConnected = socketId !== null;
    participant.lastSeen = Date.now();
    room.lastActivityAt = Date.now();
    await prisma_1.prisma.participant
        .update({
        where: { id: participantId },
        data: {
            socketId,
            isConnected: socketId !== null,
            lastSeen: new Date(participant.lastSeen),
        },
    })
        .catch((error) => {
        logger_1.logger.warn('participant_persist_failed', { error: error.message });
    });
    return participant;
}
async function leaveRoom(room, participantId) {
    const participant = room.participants.get(participantId);
    if (!participant)
        return null;
    await setParticipantConnection(room, participantId, null);
    return participant;
}
/**
 * Cambia el host sin comprobar el actor (uso interno: timeout de host o
 * transferencia ya autorizada). Actualiza memoria, DB, roles y versión.
 */
async function promoteHost(room, target, reason) {
    const previousHostId = room.playback.hostId;
    room.playback.hostId = target.id;
    room.playback.version += 1;
    room.playback.updatedAt = Date.now();
    room.lastActivityAt = Date.now();
    for (const participant of room.participants.values()) {
        participant.role = participant.id === target.id ? 'host' : 'guest';
    }
    target.role = 'host';
    await prisma_1.prisma
        .$transaction([
        prisma_1.prisma.room.update({ where: { id: room.id }, data: { hostId: target.id } }),
        prisma_1.prisma.participant.updateMany({ where: { roomId: room.id }, data: { role: 'guest' } }),
        prisma_1.prisma.participant.update({ where: { id: target.id }, data: { role: 'host' } }),
        prisma_1.prisma.roomEvent.create({
            data: {
                roomId: room.id,
                participantId: previousHostId || null,
                type: 'host:changed',
                payload: JSON.stringify({ from: previousHostId, to: target.id, reason }),
            },
        }),
    ])
        .catch((error) => {
        logger_1.logger.error('host_change_persist_failed', { error: error.message });
    });
    schedulePersist(room);
    logger_1.logger.info('host_changed', { code: room.code, from: previousHostId, to: target.id, reason });
    return target;
}
async function transferHost(room, targetParticipantId, actorId) {
    if (room.playback.hostId !== actorId) {
        throw new errors_1.AppError('FORBIDDEN', 'Solo el host puede transferir el control', 403);
    }
    const target = room.participants.get(targetParticipantId);
    if (!target)
        throw (0, errors_1.notFound)('El participante destino no está en la sala');
    if (target.id === actorId)
        throw (0, errors_1.validationError)('Ya eres el host de esta sala');
    const previousHostId = room.playback.hostId;
    await promoteHost(room, target, 'transfer');
    return { room, previousHostId, newHost: target };
}
/** Elige al invitado conectado con presencia más reciente. */
function pickNextHost(room, excludeId) {
    const candidates = [...room.participants.values()]
        .filter((p) => p.id !== excludeId && p.isConnected && p.role !== 'host')
        .sort((a, b) => b.lastSeen - a.lastSeen);
    return candidates[0] ?? null;
}
/* ------------------------------------------------------------------ */
/* Mensajes                                                           */
/* ------------------------------------------------------------------ */
function toChatMessage(row) {
    return {
        id: row.id,
        participantId: row.participantId,
        nickname: row.nickname,
        text: row.text,
        createdAt: row.createdAt.getTime(),
    };
}
async function appendMessage(room, participant, text) {
    const row = await prisma_1.prisma.message.create({
        data: {
            roomId: room.id,
            participantId: participant.id,
            nickname: participant.nickname,
            text,
        },
    });
    room.lastActivityAt = Date.now();
    return toChatMessage(row);
}
async function listMessages(room, limit = 100) {
    const rows = await prisma_1.prisma.message.findMany({
        where: { roomId: room.id },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.reverse().map(toChatMessage);
}
/* ------------------------------------------------------------------ */
/* Persistencia del playback                                          */
/* ------------------------------------------------------------------ */
function schedulePersist(room, delayMs = 150) {
    if (room.persistTimer)
        return;
    room.persistTimer = setTimeout(() => {
        room.persistTimer = null;
        void flushPlayback(room);
    }, delayMs);
    if (typeof room.persistTimer.unref === 'function')
        room.persistTimer.unref();
}
async function flushPlayback(room) {
    if (room.persistTimer) {
        clearTimeout(room.persistTimer);
        room.persistTimer = null;
    }
    try {
        await prisma_1.prisma.room.update({
            where: { code: room.code },
            data: {
                videoUrl: room.playback.videoUrl,
                videoType: room.playback.videoType,
                position: room.playback.position,
                isPlaying: room.playback.isPlaying,
                playbackRate: room.playback.playbackRate,
                version: room.playback.version,
                hostId: room.playback.hostId,
            },
        });
    }
    catch (error) {
        logger_1.logger.warn('playback_persist_failed', { code: room.code, error: error.message });
    }
}
function recordEvent(room, type, participantId, payload) {
    void prisma_1.prisma.roomEvent
        .create({
        data: {
            roomId: room.id,
            participantId,
            type,
            payload: payload === undefined ? null : JSON.stringify(payload),
        },
    })
        .catch((error) => {
        logger_1.logger.debug('room_event_failed', { error: error.message });
    });
}
/* ------------------------------------------------------------------ */
/* Limpieza                                                           */
/* ------------------------------------------------------------------ */
async function closeRoom(room, reason) {
    room.isActive = false;
    await prisma_1.prisma.room
        .update({ where: { id: room.id }, data: { isActive: false, isPlaying: false } })
        .catch(() => undefined);
    recordEvent(room, 'room:closed', null, { reason });
    (0, roomStore_1.removeLiveRoom)(room.code);
}
/** Marca salas antiguas como inactivas y limpia las que no tienen nadie. */
async function sweepRooms(now = Date.now()) {
    const cutoff = new Date(now - shared_1.MAX_ROOM_AGE_HOURS * 60 * 60 * 1000);
    let closed = 0;
    for (const live of [...(0, roomStore_1.allLiveRooms)()]) {
        const anyone = [...live.participants.values()].some((p) => p.isConnected);
        if (!anyone && now - live.lastActivityAt > 2 * 60 * 60 * 1000) {
            await closeRoom(live, 'inactive');
            closed += 1;
        }
    }
    const result = await prisma_1.prisma.room.updateMany({
        where: { isActive: true, updatedAt: { lt: cutoff } },
        data: { isActive: false, isPlaying: false },
    });
    return closed + result.count;
}
/** Al arrancar, ningún socket previo sigue vivo. */
async function resetStalePresence() {
    await prisma_1.prisma.participant.updateMany({
        where: { isConnected: true },
        data: { isConnected: false, socketId: null },
    });
}
function roomAgeHours(room, now = Date.now()) {
    return (now - room.createdAt) / (60 * 60 * 1000);
}
//# sourceMappingURL=roomService.js.map
import type { Participant as PrismaParticipant, Room as PrismaRoom } from '@prisma/client';
import type { ChatMessage, Participant, PlaybackState, VideoType } from '@cineduo/shared';
import { MAX_ROOM_AGE_HOURS, VIDEO_TYPES } from '@cineduo/shared';
import { getEnv } from '../config/env';
import { AppError, notFound, unauthorized, validationError } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { generateUniqueRoomCode } from '../lib/roomCode';
import { normalizeNickname } from '../lib/rateLimits';
import { signParticipantToken, verifyParticipantToken } from '../lib/tokens';
import type { LiveParticipant, LiveRoom } from './roomStore';
import {
  allLiveRooms,
  getLiveRoom,
  participantToDto,
  setLiveRoom,
  sortParticipants,
  removeLiveRoom,
} from './roomStore';

function toVideoType(value: string): VideoType {
  return (VIDEO_TYPES as readonly string[]).includes(value) ? (value as VideoType) : 'mp4';
}

function hydrateParticipant(row: PrismaParticipant): LiveParticipant {
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

function hydrateRoom(row: PrismaRoom & { participants: PrismaParticipant[] }): LiveRoom {
  const playback: PlaybackState = {
    videoUrl: row.videoUrl,
    videoType: toVideoType(row.videoType),
    position: row.position,
    isPlaying: row.isPlaying,
    playbackRate: (row.playbackRate as PlaybackState['playbackRate']) ?? 1,
    updatedAt: row.updatedAt.getTime(),
    version: row.version,
    hostId: row.hostId ?? '',
  };

  const participants = new Map<string, LiveParticipant>();
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
export async function loadRoom(code: string): Promise<LiveRoom | null> {
  const normalized = code.toUpperCase();
  const cached = getLiveRoom(normalized);
  if (cached?.isActive) return cached;

  const row = await prisma.room.findUnique({
    where: { code: normalized },
    include: { participants: true },
  });
  if (!row || !row.isActive) return null;

  // Los sockets no sobreviven a un reinicio: la presencia se reconstruye al conectar.
  for (const participant of row.participants) participant.isConnected = false;

  const room = hydrateRoom(row);
  setLiveRoom(room);
  return room;
}

export async function requireRoom(code: string): Promise<LiveRoom> {
  const room = await loadRoom(code);
  if (!room) throw notFound('La sala no existe o ya está cerrada');
  return room;
}

export interface CreateRoomResult {
  room: LiveRoom;
  participant: LiveParticipant;
  token: string;
}

export async function createRoom(input: {
  nickname: string;
  videoUrl?: string | undefined;
  videoType?: VideoType | undefined;
}): Promise<CreateRoomResult> {
  const env = getEnv();
  const nickname = normalizeNickname(input.nickname);
  const code = await generateUniqueRoomCode(async (candidate) => {
    const existing = await prisma.room.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    return existing !== null;
  });

  const created = await prisma.$transaction(async (tx) => {
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

  const live: LiveRoom = {
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

  const participant: LiveParticipant = {
    id: created.participant.id,
    nickname: created.participant.nickname,
    role: 'host',
    isConnected: false,
    lastSeen: Date.now(),
    socketId: null,
    joinedAt: created.participant.createdAt.getTime(),
  };
  live.participants.set(participant.id, participant);
  setLiveRoom(live);
  void prisma.participant
    .update({ where: { id: participant.id }, data: { lastSeen: new Date() } })
    .catch(() => undefined);

  const token = signParticipantToken({ pid: participant.id, rid: live.id }, env.TOKEN_SECRET);
  logger.info('room_created', { code: live.code, participantId: participant.id });
  return { room: live, participant, token };
}

export interface JoinRoomResult {
  room: LiveRoom;
  participant: LiveParticipant;
  reconnected: boolean;
}

export async function joinRoom(input: {
  code: string;
  nickname?: string | undefined;
  token?: string | undefined;
}): Promise<JoinRoomResult> {
  const env = getEnv();
  const room = await requireRoom(input.code);

  if (input.token) {
    const payload = verifyParticipantToken(input.token, env.TOKEN_SECRET);
    if (!payload)
      throw unauthorized('El enlace de la sala ha caducado. Vuelve a unirte con el código.');
    if (payload.rid !== room.id) throw unauthorized('El token no pertenece a esta sala');
    const participant = room.participants.get(payload.pid);
    if (!participant) throw unauthorized('Participante no encontrado en la sala');
    return { room, participant, reconnected: true };
  }

  const rawNickname = input.nickname?.trim();
  if (!rawNickname) throw validationError('Necesitas un apodo para entrar');
  const nickname = normalizeNickname(rawNickname);

  // Reutiliza un participante desconectado con el mismo apodo (recarga sin token).
  const reusable = [...room.participants.values()].find(
    (p) =>
      !p.isConnected && p.nickname.toLowerCase() === nickname.toLowerCase() && p.role !== 'host',
  );
  if (reusable) return { room, participant: reusable, reconnected: true };

  const connectedCount = [...room.participants.values()].filter((p) => p.isConnected).length;
  if (connectedCount >= env.MAX_PARTICIPANTS) {
    throw new AppError('ROOM_FULL', 'La sala está llena. Pide al host que libere un sitio.', 409);
  }

  const row = await prisma.participant.create({
    data: { roomId: room.id, nickname, role: 'guest', isConnected: false, socketId: null },
  });
  const participant: LiveParticipant = {
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
  logger.info('room_joined', { code: room.code, participantId: participant.id });
  return { room, participant, reconnected: false };
}

/** Reconstruye el participante a partir de un token ya verificado (uso en socket). */
export async function participantFromToken(
  room: LiveRoom,
  token: string,
): Promise<LiveParticipant> {
  const env = getEnv();
  const payload = verifyParticipantToken(token, env.TOKEN_SECRET);
  if (!payload || payload.rid !== room.id) throw unauthorized();
  const participant = room.participants.get(payload.pid);
  if (!participant) throw unauthorized('Participante no encontrado');
  return participant;
}

export function listParticipants(room: LiveRoom): Participant[] {
  return sortParticipants([...room.participants.values()]).map(participantToDto);
}

export function getParticipant(room: LiveRoom, participantId: string): LiveParticipant | null {
  return room.participants.get(participantId) ?? null;
}

export async function setParticipantConnection(
  room: LiveRoom,
  participantId: string,
  socketId: string | null,
): Promise<LiveParticipant> {
  const participant = room.participants.get(participantId);
  if (!participant) throw notFound('Participante no encontrado');

  participant.socketId = socketId;
  participant.isConnected = socketId !== null;
  participant.lastSeen = Date.now();
  room.lastActivityAt = Date.now();

  await prisma.participant
    .update({
      where: { id: participantId },
      data: {
        socketId,
        isConnected: socketId !== null,
        lastSeen: new Date(participant.lastSeen),
      },
    })
    .catch((error: unknown) => {
      logger.warn('participant_persist_failed', { error: (error as Error).message });
    });

  return participant;
}

export async function leaveRoom(
  room: LiveRoom,
  participantId: string,
): Promise<LiveParticipant | null> {
  const participant = room.participants.get(participantId);
  if (!participant) return null;
  await setParticipantConnection(room, participantId, null);
  return participant;
}

export interface TransferResult {
  room: LiveRoom;
  previousHostId: string;
  newHost: LiveParticipant;
}

/**
 * Cambia el host sin comprobar el actor (uso interno: timeout de host o
 * transferencia ya autorizada). Actualiza memoria, DB, roles y versión.
 */
export async function promoteHost(
  room: LiveRoom,
  target: LiveParticipant,
  reason: 'transfer' | 'timeout' | 'disconnect',
): Promise<LiveParticipant> {
  const previousHostId = room.playback.hostId;
  room.playback.hostId = target.id;
  room.playback.version += 1;
  room.playback.updatedAt = Date.now();
  room.lastActivityAt = Date.now();

  for (const participant of room.participants.values()) {
    participant.role = participant.id === target.id ? 'host' : 'guest';
  }
  target.role = 'host';

  await prisma
    .$transaction([
      prisma.room.update({ where: { id: room.id }, data: { hostId: target.id } }),
      prisma.participant.updateMany({ where: { roomId: room.id }, data: { role: 'guest' } }),
      prisma.participant.update({ where: { id: target.id }, data: { role: 'host' } }),
      prisma.roomEvent.create({
        data: {
          roomId: room.id,
          participantId: previousHostId || null,
          type: 'host:changed',
          payload: JSON.stringify({ from: previousHostId, to: target.id, reason }),
        },
      }),
    ])
    .catch((error: unknown) => {
      logger.error('host_change_persist_failed', { error: (error as Error).message });
    });

  schedulePersist(room);
  logger.info('host_changed', { code: room.code, from: previousHostId, to: target.id, reason });
  return target;
}

export async function transferHost(
  room: LiveRoom,
  targetParticipantId: string,
  actorId: string,
): Promise<TransferResult> {
  if (room.playback.hostId !== actorId) {
    throw new AppError('FORBIDDEN', 'Solo el host puede transferir el control', 403);
  }
  const target = room.participants.get(targetParticipantId);
  if (!target) throw notFound('El participante destino no está en la sala');
  if (target.id === actorId) throw validationError('Ya eres el host de esta sala');

  const previousHostId = room.playback.hostId;
  await promoteHost(room, target, 'transfer');
  return { room, previousHostId, newHost: target };
}

/** Elige al invitado conectado con presencia más reciente. */
export function pickNextHost(room: LiveRoom, excludeId: string): LiveParticipant | null {
  const candidates = [...room.participants.values()]
    .filter((p) => p.id !== excludeId && p.isConnected && p.role !== 'host')
    .sort((a, b) => b.lastSeen - a.lastSeen);
  return candidates[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Mensajes                                                           */
/* ------------------------------------------------------------------ */

export function toChatMessage(row: {
  id: string;
  participantId: string;
  nickname: string;
  text: string;
  createdAt: Date;
}): ChatMessage {
  return {
    id: row.id,
    participantId: row.participantId,
    nickname: row.nickname,
    text: row.text,
    createdAt: row.createdAt.getTime(),
  };
}

export async function appendMessage(
  room: LiveRoom,
  participant: LiveParticipant,
  text: string,
): Promise<ChatMessage> {
  const row = await prisma.message.create({
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

export async function listMessages(room: LiveRoom, limit = 100): Promise<ChatMessage[]> {
  const rows = await prisma.message.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.reverse().map(toChatMessage);
}

/* ------------------------------------------------------------------ */
/* Persistencia del playback                                          */
/* ------------------------------------------------------------------ */

export function schedulePersist(room: LiveRoom, delayMs = 150): void {
  if (room.persistTimer) return;
  room.persistTimer = setTimeout(() => {
    room.persistTimer = null;
    void flushPlayback(room);
  }, delayMs);
  if (typeof room.persistTimer.unref === 'function') room.persistTimer.unref();
}

export async function flushPlayback(room: LiveRoom): Promise<void> {
  if (room.persistTimer) {
    clearTimeout(room.persistTimer);
    room.persistTimer = null;
  }
  try {
    await prisma.room.update({
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
  } catch (error) {
    logger.warn('playback_persist_failed', { code: room.code, error: (error as Error).message });
  }
}

export function recordEvent(
  room: LiveRoom,
  type: string,
  participantId: string | null,
  payload?: unknown,
): void {
  void prisma.roomEvent
    .create({
      data: {
        roomId: room.id,
        participantId,
        type,
        payload: payload === undefined ? null : JSON.stringify(payload),
      },
    })
    .catch((error: unknown) => {
      logger.debug('room_event_failed', { error: (error as Error).message });
    });
}

/* ------------------------------------------------------------------ */
/* Limpieza                                                           */
/* ------------------------------------------------------------------ */

export async function closeRoom(room: LiveRoom, reason: string): Promise<void> {
  room.isActive = false;
  await prisma.room
    .update({ where: { id: room.id }, data: { isActive: false, isPlaying: false } })
    .catch(() => undefined);
  recordEvent(room, 'room:closed', null, { reason });
  removeLiveRoom(room.code);
}

/** Marca salas antiguas como inactivas y limpia las que no tienen nadie. */
export async function sweepRooms(now = Date.now()): Promise<number> {
  const cutoff = new Date(now - MAX_ROOM_AGE_HOURS * 60 * 60 * 1000);
  let closed = 0;

  for (const live of [...allLiveRooms()]) {
    const anyone = [...live.participants.values()].some((p) => p.isConnected);
    if (!anyone && now - live.lastActivityAt > 2 * 60 * 60 * 1000) {
      await closeRoom(live, 'inactive');
      closed += 1;
    }
  }

  const result = await prisma.room.updateMany({
    where: { isActive: true, updatedAt: { lt: cutoff } },
    data: { isActive: false, isPlaying: false },
  });
  return closed + result.count;
}

/** Al arrancar, ningún socket previo sigue vivo. */
export async function resetStalePresence(): Promise<void> {
  await prisma.participant.updateMany({
    where: { isConnected: true },
    data: { isConnected: false, socketId: null },
  });
}

export function roomAgeHours(room: LiveRoom, now = Date.now()): number {
  return (now - room.createdAt) / (60 * 60 * 1000);
}

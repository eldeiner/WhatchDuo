import { randomUUID } from 'node:crypto';
import type {
  Ack,
  ApiErrorBody,
  ChatMessage,
  Participant,
  PlaybackState,
  RoomStateEvent,
  ServerToClientEvents,
  SystemNotice,
} from '@cineduo/shared';
import { ERROR_CODES } from '@cineduo/shared';
import { toWsError } from '../lib/errors';
import type { LiveParticipant, LiveRoom } from '../services/roomStore';
import { participantToDto, sortParticipants } from '../services/roomStore';
import type { CineServer, CineSocket } from './socketTypes';
import { roomChannel } from './socketTypes';

export function buildRoomState(room: LiveRoom): RoomStateEvent {
  return {
    room: { code: room.code, createdAt: room.createdAt, isActive: room.isActive },
    playback: { ...room.playback },
    participants: sortParticipants([...room.participants.values()]).map(participantToDto),
    serverTime: Date.now(),
  };
}

export function emitRoomState(io: CineServer, room: LiveRoom): void {
  io.to(roomChannel(room.code)).emit('room:state', buildRoomState(room));
}

export function emitStateTo(socket: CineSocket, room: LiveRoom): void {
  socket.emit('room:state', buildRoomState(room));
}

export function broadcastSync(
  io: CineServer,
  room: LiveRoom,
  reason: 'command' | 'heartbeat' | 'host' | 'video',
  by: string,
): void {
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
  io.to(roomChannel(room.code)).emit('player:sync', payload);
}

export function broadcastCommand(
  io: CineServer,
  room: LiveRoom,
  type: 'play' | 'pause' | 'seek' | 'rate',
  by: string,
): void {
  io.to(roomChannel(room.code)).emit('player:command', {
    type,
    position: room.playback.position,
    rate: room.playback.playbackRate,
    by,
    version: room.playback.version,
    serverTime: Date.now(),
  });
}

export function broadcastSystemNotice(io: CineServer, room: LiveRoom, text: string): SystemNotice {
  const notice: SystemNotice = { id: randomUUID(), text, createdAt: Date.now() };
  io.to(roomChannel(room.code)).emit('chat:system', { notice });
  return notice;
}

export function broadcastChat(io: CineServer, room: LiveRoom, message: ChatMessage): void {
  io.to(roomChannel(room.code)).emit('chat:message', { message });
}

export function emitParticipantJoined(
  io: CineServer,
  room: LiveRoom,
  participant: LiveParticipant,
): void {
  io.to(roomChannel(room.code)).emit('participant:joined', {
    participant: participantToDto(participant),
    serverTime: Date.now(),
  });
}

export function emitParticipantReconnected(
  io: CineServer,
  room: LiveRoom,
  participant: LiveParticipant,
): void {
  io.to(roomChannel(room.code)).emit('participant:reconnected', {
    participant: participantToDto(participant),
    serverTime: Date.now(),
  });
}

export function emitParticipantLeft(
  io: CineServer,
  room: LiveRoom,
  participant: LiveParticipant,
): void {
  io.to(roomChannel(room.code)).emit('participant:left', {
    participantId: participant.id,
    nickname: participant.nickname,
    serverTime: Date.now(),
  });
}

export function emitHostChanged(
  io: CineServer,
  room: LiveRoom,
  by: 'transfer' | 'timeout' | 'disconnect',
): void {
  io.to(roomChannel(room.code)).emit('host:changed', { hostId: room.playback.hostId, by });
}

export function emitPlaybackSnapshot(io: CineServer, room: LiveRoom): void {
  io.to(roomChannel(room.code)).emit('room:state', buildRoomState(room));
}

export function emitErrorToSocket(socket: CineSocket, error: unknown, request?: string): void {
  const wsError = toWsError(error);
  socket.emit('error', { ...wsError, ...(request ? { request } : {}) });
}

export function failAck(error: unknown): Ack<never> {
  const wsError = toWsError(error);
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
export function replyError(
  socket: CineSocket,
  error: unknown,
  ack?: (response: Ack<never>) => void,
  request?: string,
): void {
  emitErrorToSocket(socket, error, request);
  if (typeof ack === 'function') ack(failAck(error));
}

export function errorPayload(
  code: keyof typeof ERROR_CODES,
  message: string,
): ApiErrorBody['error'] {
  return { code: ERROR_CODES[code], message };
}

export function participantDto(participant: LiveParticipant): Participant {
  return participantToDto(participant);
}

export function playbackDto(room: LiveRoom): PlaybackState {
  return { ...room.playback };
}

export type { ServerToClientEvents };

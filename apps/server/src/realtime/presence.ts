import type { LiveParticipant, LiveRoom } from '../services/roomStore';
import { getLiveRoom } from '../services/roomStore';
import { pickNextHost, promoteHost, setParticipantConnection } from '../services/roomService';
import { getEnv } from '../config/env';
import { logger } from '../lib/logger';
import type { CineServer, CineSocket } from './socketTypes';
import { roomChannel } from './socketTypes';
import {
  broadcastSystemNotice,
  broadcastSync,
  buildRoomState,
  emitHostChanged,
  emitParticipantJoined,
  emitParticipantLeft,
  emitPlaybackSnapshot,
} from './emit';

/** Participantes que ya se conectaron en este proceso (para el aviso correcto). */
const seenParticipants = new Set<string>();

export async function attachParticipant(
  io: CineServer,
  socket: CineSocket,
  room: LiveRoom,
  participant: LiveParticipant,
  reconnected: boolean,
): Promise<void> {
  const previousSocketId = participant.socketId;
  const isReturning = seenParticipants.has(participant.id);
  seenParticipants.add(participant.id);

  await socket.join(roomChannel(room.code));
  socket.data.participantId = participant.id;
  socket.data.roomCode = room.code;
  socket.data.nickname = participant.nickname;

  await setParticipantConnection(room, participant.id, socket.id);

  // Si el mismo participante tenía otra pestaña/dispositivo, cerramos la vieja.
  // Se hace después de actualizar el socketId para que el handler de desconexión
  // del socket antiguo no marque como ausente al participante.
  if (previousSocketId && previousSocketId !== socket.id) {
    const previous = io.sockets.sockets.get(previousSocketId);
    if (previous) previous.disconnect(true);
  }

  if (participant.role === 'host' && room.hostGraceTimer) {
    clearTimeout(room.hostGraceTimer);
    room.hostGraceTimer = null;
  }

  socket.emit('room:state', buildRoomState(room));

  if (reconnected) {
    socket.to(roomChannel(room.code)).emit('participant:reconnected', {
      participant: {
        id: participant.id,
        nickname: participant.nickname,
        role: participant.role,
        isConnected: true,
        lastSeen: participant.lastSeen,
      },
      serverTime: Date.now(),
    });
    broadcastSystemNotice(
      io,
      room,
      isReturning
        ? `${participant.nickname} volvió a la sala`
        : `${participant.nickname} se unió a la sala`,
    );
  } else {
    emitParticipantJoined(io, room, participant);
    broadcastSystemNotice(io, room, `${participant.nickname} se unió a la sala`);
  }

  logger.info('participant_attached', {
    code: room.code,
    participantId: participant.id,
    role: participant.role,
    reconnected,
  });
}

export async function detachParticipant(
  io: CineServer,
  socket: CineSocket,
  mode: 'disconnect' | 'leave',
): Promise<void> {
  const { roomCode, participantId } = socket.data;
  if (!roomCode || !participantId) return;

  const room = getLiveRoom(roomCode);
  if (!room) return;

  const participant = room.participants.get(participantId);
  // Un socket antiguo no debe desconectar a la conexión nueva del participante.
  if (!participant || participant.socketId !== socket.id) return;

  socket.data.participantId = undefined;
  socket.data.roomCode = undefined;
  socket.data.nickname = undefined;

  await setParticipantConnection(room, participant.id, null);
  emitParticipantLeft(io, room, participant);
  emitPlaybackSnapshot(io, room);

  if (participant.role === 'host') {
    scheduleHostGrace(io, room, participant, mode);
  } else {
    broadcastSystemNotice(io, room, `${participant.nickname} salió de la sala`);
  }

  if (mode === 'leave') {
    await socket.leave(roomChannel(room.code));
  }

  logger.info('participant_detached', { code: room.code, participantId, mode });
}

function scheduleHostGrace(
  io: CineServer,
  room: LiveRoom,
  host: LiveParticipant,
  mode: 'disconnect' | 'leave',
): void {
  if (room.hostGraceTimer) clearTimeout(room.hostGraceTimer);
  const graceMs = getEnv().HOST_DISCONNECT_GRACE_MS;

  broadcastSystemNotice(
    io,
    room,
    mode === 'disconnect'
      ? `El host perdió la conexión. Si no vuelve en ${Math.round(graceMs / 1000)} s, otro participante tomará el control.`
      : 'El host salió de la sala. Esperando para transferir el control…',
  );

  room.hostGraceTimer = setTimeout(() => {
    room.hostGraceTimer = null;
    void promoteAfterTimeout(io, room, host.id);
  }, graceMs);
  room.hostGraceTimer.unref?.();
}

async function promoteAfterTimeout(
  io: CineServer,
  room: LiveRoom,
  previousHostId: string,
): Promise<void> {
  if (!room.isActive) return;
  const previousHost = room.participants.get(previousHostId);
  if (previousHost?.isConnected) return;

  const nextHost = pickNextHost(room, previousHostId);
  if (!nextHost) {
    broadcastSystemNotice(io, room, 'No hay invitados conectados para tomar el control.');
    return;
  }

  await promoteHost(room, nextHost, 'timeout');
  emitHostChanged(io, room, 'timeout');
  emitPlaybackSnapshot(io, room);
  broadcastSync(io, room, 'host', nextHost.id);
  broadcastSystemNotice(io, room, `${nextHost.nickname} ahora controla la reproducción.`);
  logger.info('host_promoted_after_timeout', { code: room.code, hostId: nextHost.id });
}

/** Al cerrar el proceso: avisa y persiste. */
export function clearHostGrace(room: LiveRoom): void {
  if (room.hostGraceTimer) {
    clearTimeout(room.hostGraceTimer);
    room.hostGraceTimer = null;
  }
}

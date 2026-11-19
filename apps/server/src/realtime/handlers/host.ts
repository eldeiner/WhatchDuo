import type { Ack } from '@cineduo/shared';
import { transferHostSchema } from '@cineduo/shared';
import { AppError } from '../../lib/errors';
import { limiters } from '../../lib/rateLimits';
import { transferHost } from '../../services/roomService';
import { enforceLimit, parsePayload, socketContext } from '../context';
import {
  broadcastSync,
  broadcastSystemNotice,
  emitHostChanged,
  emitPlaybackSnapshot,
  replyError,
} from '../emit';
import { clearHostGrace } from '../presence';
import type { CineServer, CineSocket } from '../socketTypes';

export function registerHostHandlers(io: CineServer, socket: CineSocket): void {
  socket.on('host:transfer', async (payload, ack) => {
    try {
      const { room, participant } = socketContext(socket);
      enforceLimit(limiters.command, participant.id);
      const data = parsePayload(transferHostSchema, payload);
      const result = await transferHost(room, data.targetParticipantId, participant.id);
      clearHostGrace(room);
      emitHostChanged(io, room, 'transfer');
      emitPlaybackSnapshot(io, room);
      broadcastSync(io, room, 'host', result.newHost.id);
      broadcastSystemNotice(
        io,
        room,
        `${participant.nickname} pasó el control a ${result.newHost.nickname}`,
      );
      if (typeof ack === 'function') {
        ack({ ok: true, data: { ...room.playback } });
      }
    } catch (error) {
      replyError(socket, error, ack as ((res: Ack<never>) => void) | undefined, 'host:transfer');
    }
  });

  socket.on('host:request', (ack) => {
    try {
      const { room, participant } = socketContext(socket);
      if (participant.role === 'host') {
        throw new AppError('VALIDATION_ERROR', 'Ya controlas la reproducción', 422);
      }
      const host = room.participants.get(room.playback.hostId);
      if (!host?.socketId) {
        throw new AppError(
          'CONFLICT',
          'El host no está conectado. En breve se elegirá un nuevo host.',
          409,
        );
      }
      enforceLimit(limiters.command, participant.id);
      io.to(host.socketId).emit('peer:request-control', {
        participantId: participant.id,
        nickname: participant.nickname,
      });
      if (typeof ack === 'function') ack({ ok: true, data: { requested: true } });
    } catch (error) {
      replyError(socket, error, ack as ((res: Ack<never>) => void) | undefined, 'host:request');
    }
  });
}

import type { Ack, CreateRoomResponse, RoomStateEvent } from '@cineduo/shared';
import { createRoomPayloadSchema, detectVideoType, joinRoomPayloadSchema } from '@cineduo/shared';
import { getEnv } from '../../config/env';
import { AppError } from '../../lib/errors';
import { limiters } from '../../lib/rateLimits';
import { extractMediaSource } from '../../services/mediaExtractor';
import { createRoom, joinRoom } from '../../services/roomService';
import { enforceLimit, parsePayload, socketContext } from '../context';
import { replyError } from '../emit';
import { attachParticipant, detachParticipant } from '../presence';
import type { CineServer, CineSocket } from '../socketTypes';
import { buildRoomState } from '../emit';

export function registerRoomHandlers(io: CineServer, socket: CineSocket): void {
  socket.on('room:create', async (payload, ack) => {
    try {
      enforceLimit(limiters.createRoom, socket.handshake.address || socket.id);
      if (socket.data.roomCode) {
        throw new AppError('CONFLICT', 'Ya estás en una sala. Sal antes de crear otra.', 409);
      }
      const data = parsePayload(createRoomPayloadSchema, payload);
      let finalVideoUrl = data.videoUrl;
      let finalVideoType = data.videoUrl ? detectVideoType(data.videoUrl) : undefined;
      if (data.videoUrl) {
        const extracted = await extractMediaSource(data.videoUrl);
        if (extracted) {
          finalVideoUrl = extracted.streamUrl;
          finalVideoType = extracted.type;
        }
      }
      const created = await createRoom({
        nickname: data.nickname,
        videoUrl: finalVideoUrl,
        videoType: finalVideoType,
      });
      await attachParticipant(io, socket, created.room, created.participant, false);

      const response: CreateRoomResponse = {
        roomCode: created.room.code,
        joinUrl: `${getEnv().WEB_ORIGIN}/room/${created.room.code}`,
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
      if (typeof ack === 'function') ack({ ok: true, data: response });
    } catch (error) {
      replyError(socket, error, ack as ((res: Ack<never>) => void) | undefined, 'room:create');
    }
  });

  socket.on('room:join', async (payload, ack) => {
    try {
      enforceLimit(limiters.joinRoom, socket.handshake.address || socket.id);
      const data = parsePayload(joinRoomPayloadSchema, payload);
      const handshakeToken =
        typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;

      if (socket.data.roomCode) {
        const current = socketContext(socket);
        if (current.room.code === data.code) {
          if (typeof ack === 'function') ack({ ok: true, data: buildRoomState(current.room) });
          return;
        }
        throw new AppError('CONFLICT', 'Ya estás en otra sala. Sal primero.', 409);
      }

      const joined = await joinRoom({
        code: data.code,
        nickname: data.nickname,
        token: data.token ?? handshakeToken,
      });

      await attachParticipant(io, socket, joined.room, joined.participant, joined.reconnected);

      const response: RoomStateEvent = buildRoomState(joined.room);
      if (typeof ack === 'function') ack({ ok: true, data: response });
    } catch (error) {
      replyError(socket, error, ack as ((res: Ack<never>) => void) | undefined, 'room:join');
    }
  });

  socket.on('room:leave', async (ack) => {
    try {
      socketContext(socket);
      await detachParticipant(io, socket, 'leave');
      if (typeof ack === 'function') ack({ ok: true, data: { left: true } });
    } catch (error) {
      replyError(socket, error, ack as ((res: Ack<never>) => void) | undefined, 'room:leave');
    }
  });
}

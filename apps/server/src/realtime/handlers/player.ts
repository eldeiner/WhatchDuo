import {
  bufferingSchema,
  heartbeatSchema,
  pauseCommandSchema,
  playCommandSchema,
  rateCommandSchema,
  seekCommandSchema,
  setVideoSchema,
  type Ack,
} from '@cineduo/shared';
import { limiters } from '../../lib/rateLimits';
import {
  applyHeartbeat,
  pause,
  play,
  seek,
  setRate,
  setVideo,
} from '../../services/playbackService';
import { enforceLimit, parsePayload, socketContext } from '../context';
import { broadcastCommand, broadcastSync, emitPlaybackSnapshot, replyError } from '../emit';
import type { CineServer, CineSocket } from '../socketTypes';
import { roomChannel } from '../socketTypes';

type ErrorAck = ((res: Ack<never>) => void) | undefined;

export function registerPlayerHandlers(io: CineServer, socket: CineSocket): void {
  socket.on('player:play', (payload, ack) => {
    try {
      const { room, participant } = socketContext(socket);
      enforceLimit(limiters.command, participant.id);
      const data = parsePayload(playCommandSchema, payload);
      const state = play(room, participant.id, data.position);
      broadcastSync(io, room, 'command', participant.id);
      broadcastCommand(io, room, 'play', participant.id);
      ack?.({ ok: true, data: state });
    } catch (error) {
      replyError(socket, error, ack as ErrorAck);
    }
  });

  socket.on('player:pause', (payload, ack) => {
    try {
      const { room, participant } = socketContext(socket);
      enforceLimit(limiters.command, participant.id);
      const data = parsePayload(pauseCommandSchema, payload);
      const state = pause(room, participant.id, data.position);
      broadcastSync(io, room, 'command', participant.id);
      broadcastCommand(io, room, 'pause', participant.id);
      ack?.({ ok: true, data: state });
    } catch (error) {
      replyError(socket, error, ack as ErrorAck);
    }
  });

  socket.on('player:seek', (payload, ack) => {
    try {
      const { room, participant } = socketContext(socket);
      enforceLimit(limiters.command, participant.id);
      const data = parsePayload(seekCommandSchema, payload);
      const state = seek(room, participant.id, data.position);
      broadcastSync(io, room, 'command', participant.id);
      broadcastCommand(io, room, 'seek', participant.id);
      ack?.({ ok: true, data: state });
    } catch (error) {
      replyError(socket, error, ack as ErrorAck);
    }
  });

  socket.on('player:rate', (payload, ack) => {
    try {
      const { room, participant } = socketContext(socket);
      enforceLimit(limiters.command, participant.id);
      const data = parsePayload(rateCommandSchema, payload);
      const state = setRate(room, participant.id, data.rate, data.position);
      broadcastSync(io, room, 'command', participant.id);
      broadcastCommand(io, room, 'rate', participant.id);
      ack?.({ ok: true, data: state });
    } catch (error) {
      replyError(socket, error, ack as ErrorAck);
    }
  });

  socket.on('player:set-video', async (payload, ack) => {
    try {
      const { room, participant } = socketContext(socket);
      enforceLimit(limiters.command, participant.id);
      const data = parsePayload(setVideoSchema, payload);
      const state = await setVideo(room, participant.id, data.videoUrl);
      emitPlaybackSnapshot(io, room);
      broadcastSync(io, room, 'video', participant.id);
      ack?.({ ok: true, data: state });
    } catch (error) {
      replyError(socket, error, ack as ErrorAck);
    }
  });

  socket.on('player:heartbeat', (payload) => {
    try {
      const { room, participant } = socketContext(socket);
      const data = parsePayload(heartbeatSchema, payload);
      if (room.playback.hostId !== participant.id) {
        // Los invitados no tienen autoridad: se ignora silenciosamente para no
        // generar ruido si un cliente antiguo envía heartbeats.
        return;
      }
      enforceLimit(limiters.command, participant.id);
      const outcome = applyHeartbeat(room, participant.id, {
        position: data.position,
        isPlaying: data.isPlaying,
      });
      if (outcome.corrected) {
        broadcastSync(io, room, 'heartbeat', participant.id);
      }
    } catch (error) {
      replyError(socket, error);
    }
  });

  socket.on('player:buffering', (payload) => {
    try {
      const { room, participant } = socketContext(socket);
      const data = parsePayload(bufferingSchema, payload);
      socket.to(roomChannel(room.code)).emit('peer:buffering', {
        participantId: participant.id,
        nickname: participant.nickname,
        isBuffering: data.isBuffering,
      });
    } catch (error) {
      replyError(socket, error);
    }
  });
}

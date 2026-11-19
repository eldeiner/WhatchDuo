import { PROTOCOL_VERSION, pingPayloadSchema, webrtcSignalSchema } from '@cineduo/shared';
import { limiters } from '../../lib/rateLimits';
import { parsePayload, socketContext } from '../context';
import { emitErrorToSocket } from '../emit';
import type { CineServer, CineSocket } from '../socketTypes';

export function registerClockHandlers(_io: CineServer, socket: CineSocket): void {
  socket.on('ping', (payload) => {
    // No respondemos si se supera el límite: el cliente simplemente descarta
    // esa muestra de reloj.
    if (!limiters.ping.consume(socket.id).allowed) return;
    const parsed = pingPayloadSchema.safeParse(payload);
    if (!parsed.success) return;
    socket.emit('pong', {
      clientTime: parsed.data.clientTime,
      serverTime: Date.now(),
      protocol: PROTOCOL_VERSION,
    });
  });
}

export function registerWebRtcHandlers(_io: CineServer, socket: CineSocket): void {
  socket.on('webrtc:signal', (payload) => {
    try {
      const { room } = socketContext(socket);
      const data = parsePayload(webrtcSignalSchema, payload);
      const target = room.participants.get(data.targetId);
      if (!target?.socketId) return;
      // Reenvío ciego entre participantes de la misma sala (compartir pantalla
      // es una extensión fuera del MVP; no hay lógica de señalización aquí).
      _io.to(target.socketId).emit('webrtc:signal', {
        fromId: socket.data.participantId ?? '',
        data: data.data,
      });
    } catch (error) {
      emitErrorToSocket(socket, error, 'webrtc:signal');
    }
  });
}

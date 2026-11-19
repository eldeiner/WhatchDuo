'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@cineduo/shared';
import { socketUrl } from './api';
import { clock } from './clock';
import { useRoomStore } from './store';
import { webrtcSession } from './webrtc/streamer';

export type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let activeSocket: RoomSocket | null = null;

export function getRoomSocket(): RoomSocket | null {
  return activeSocket;
}

export interface StartSessionOptions {
  code: string;
  token: string;
  onFatal: (message: string) => void;
}

/**
 * Abre la conexión Socket.IO, enlaza los eventos con el store y mantiene el
 * reloj sincronizado. Devuelve la función de limpieza.
 */
export function startSession({ code, token, onFatal }: StartSessionOptions): () => void {
  if (activeSocket) {
    activeSocket.removeAllListeners();
    activeSocket.disconnect();
    activeSocket = null;
  }

  const store = useRoomStore.getState();
  store.resetSession();
  store.setConnection('connecting');
  clock.reset();

  const socket: RoomSocket = io(socketUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 5000,
    timeout: 10_000,
    autoConnect: true,
  });
  activeSocket = socket;

  let fatal = false;
  let probeTimer: ReturnType<typeof setTimeout> | null = null;

  const handleFatal = (message: string) => {
    if (fatal) return;
    fatal = true;
    useRoomStore.getState().setConnection('offline');
    useRoomStore.getState().setError(message);
    onFatal(message);
    socket.disconnect();
  };

  const sendJoin = () => {
    socket.emit('room:join', { code, token }, (response) => {
      if (response.ok) {
        useRoomStore.getState().applyRoomState(response.data);
        useRoomStore.getState().setConnection('connected');
        useRoomStore.getState().setError(null);
      } else {
        const fatalCodes = ['UNAUTHORIZED', 'NOT_FOUND', 'ROOM_CLOSED'];
        if (fatalCodes.includes(response.error.code)) {
          handleFatal(response.error.message);
        } else {
          useRoomStore.getState().setError(response.error.message);
        }
      }
    });
  };

  const startProbes = () => {
    let sent = 0;
    const probe = () => {
      if (!socket.connected || sent >= 5) return;
      sent += 1;
      socket.emit('ping', { clientTime: Date.now() });
      probeTimer = setTimeout(probe, 280);
    };
    probe();
  };

  socket.on('connect', () => {
    useRoomStore.getState().setConnection('connecting');
    sendJoin();
    startProbes();
  });

  socket.on('disconnect', () => {
    if (fatal) return;
    useRoomStore.getState().setConnection(socket.active ? 'reconnecting' : 'offline');
  });

  socket.io.on('reconnect_attempt', () => {
    useRoomStore.getState().setConnection('reconnecting');
  });

  socket.io.on('reconnect_failed', () => {
    useRoomStore.getState().setConnection('offline');
    useRoomStore.getState().setError('No se pudo reconectar con la sala.');
  });

  socket.on('room:state', (state) => {
    useRoomStore.getState().applyRoomState(state);
    useRoomStore.getState().setConnection('connected');
  });

  socket.on('player:sync', (sync) => {
    useRoomStore.getState().applySync(sync);
  });

  socket.on('participant:joined', ({ participant }) => {
    useRoomStore.getState().upsertParticipant(participant);
    webrtcSession.notifyParticipantJoined(participant.id);
  });

  socket.on('participant:reconnected', ({ participant }) => {
    useRoomStore.getState().upsertParticipant(participant);
    webrtcSession.notifyParticipantJoined(participant.id);
  });

  socket.on('participant:left', ({ participantId }) => {
    useRoomStore.getState().markParticipantLeft(participantId);
  });

  socket.on('chat:message', ({ message }) => {
    useRoomStore.getState().addMessage(message);
  });

  socket.on('chat:system', ({ notice }) => {
    useRoomStore.getState().addNotice(notice);
  });

  socket.on('chat:reaction', ({ reaction }) => {
    useRoomStore.getState().addReaction(reaction);
  });

  socket.on('host:changed', ({ hostId }) => {
    useRoomStore.getState().setHost(hostId);
    if (useRoomStore.getState().myId === hostId) {
      useRoomStore.getState().setControlRequestSent(false);
    }
  });

  socket.on('peer:request-control', (request) => {
    useRoomStore.getState().setHostRequest(request);
  });

  socket.on('peer:buffering', (event) => {
    useRoomStore
      .getState()
      .setPeerBuffering(event.participantId, event.nickname, event.isBuffering);
  });

  socket.on('room:closed', ({ reason }) => {
    handleFatal(reason || 'La sala se cerró.');
  });

  socket.on('error', (error) => {
    if (error.code === 'UNAUTHORIZED' || error.code === 'NOT_FOUND') {
      handleFatal(error.message);
      return;
    }
    useRoomStore.getState().setError(error.message);
  });

  socket.on('pong', ({ clientTime, serverTime }) => {
    clock.addSample(clientTime, serverTime);
  });

  const pingInterval = window.setInterval(() => {
    if (socket.connected) socket.emit('ping', { clientTime: Date.now() });
  }, 20_000);

  return () => {
    fatal = true;
    if (probeTimer) clearTimeout(probeTimer);
    window.clearInterval(pingInterval);
    socket.removeAllListeners();
    socket.disconnect();
    if (activeSocket === socket) activeSocket = null;
    useRoomStore.getState().resetSession();
  };
}

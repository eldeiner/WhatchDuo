'use client';

import type { Ack, PlaybackState } from '@cineduo/shared';
import { getRoomSocket } from './session';
import { useRoomStore } from './store';

let sequence = 0;

function nextSeq(): number {
  sequence += 1;
  return sequence;
}

function fail(error: { message: string }): void {
  useRoomStore.getState().setError(error.message);
}

function ensureSocket() {
  const socket = getRoomSocket();
  if (!socket?.connected) {
    useRoomStore.getState().setError('Sin conexión con la sala. Reconectando…');
    return null;
  }
  return socket;
}

export function hostPlay(position: number): void {
  const socket = ensureSocket();
  if (!socket) return;
  socket.emit('player:play', { position, clientSeq: nextSeq() }, (res: Ack<PlaybackState>) => {
    if (!res.ok) fail(res.error);
  });
}

export function hostPause(position: number): void {
  const socket = ensureSocket();
  if (!socket) return;
  socket.emit('player:pause', { position, clientSeq: nextSeq() }, (res: Ack<PlaybackState>) => {
    if (!res.ok) fail(res.error);
  });
}

export function hostSeek(position: number): void {
  const socket = ensureSocket();
  if (!socket) return;
  socket.emit('player:seek', { position, clientSeq: nextSeq() }, (res: Ack<PlaybackState>) => {
    if (!res.ok) fail(res.error);
  });
}

export function hostSetRate(rate: number, position: number): void {
  const socket = ensureSocket();
  if (!socket) return;
  const allowed = [0.75, 1, 1.25, 1.5] as const;
  const safeRate = allowed.includes(rate as (typeof allowed)[number])
    ? (rate as (typeof allowed)[number])
    : 1;
  socket.emit(
    'player:rate',
    { rate: safeRate, position, clientSeq: nextSeq() },
    (res: Ack<PlaybackState>) => {
      if (!res.ok) fail(res.error);
    },
  );
}

export function hostSetVideo(videoUrl: string): Promise<boolean> {
  const socket = ensureSocket();
  if (!socket) return Promise.resolve(false);
  return new Promise((resolve) => {
    socket.emit(
      'player:set-video',
      { videoUrl, clientSeq: nextSeq() },
      (res: Ack<PlaybackState>) => {
        if (!res.ok) fail(res.error);
        resolve(res.ok);
      },
    );
  });
}

export function sendHeartbeat(input: {
  position: number;
  isPlaying: boolean;
  clientTime: number;
}): void {
  const socket = getRoomSocket();
  if (!socket?.connected) return;
  socket.emit('player:heartbeat', { ...input, clientSeq: nextSeq() });
}

export function sendBuffering(isBuffering: boolean): void {
  const socket = getRoomSocket();
  if (!socket?.connected) return;
  socket.emit('player:buffering', { isBuffering });
}

export async function sendChat(text: string): Promise<boolean> {
  const socket = ensureSocket();
  if (!socket) return false;
  return new Promise((resolve) => {
    socket.emit('chat:send', { text }, (res: Ack<{ id: string }>) => {
      if (!res.ok) fail(res.error);
      resolve(res.ok);
    });
  });
}

export function sendReaction(emoji: string): void {
  const socket = getRoomSocket();
  if (!socket?.connected) return;
  const allowed = ['❤️', '😂', '😮', '😢', '👏', '🔥', '🍿', '😴'] as const;
  if (!allowed.includes(emoji as (typeof allowed)[number])) return;
  socket.emit('chat:reaction', { emoji: emoji as (typeof allowed)[number] });
}

export function requestControl(): Promise<boolean> {
  const socket = ensureSocket();
  if (!socket) return Promise.resolve(false);
  return new Promise((resolve) => {
    socket.emit('host:request', (res: Ack<{ requested: true }>) => {
      if (!res.ok) {
        fail(res.error);
        resolve(false);
      } else {
        useRoomStore.getState().setControlRequestSent(true);
        resolve(true);
      }
    });
  });
}

export function transferControl(targetParticipantId: string): Promise<boolean> {
  const socket = ensureSocket();
  if (!socket) return Promise.resolve(false);
  return new Promise((resolve) => {
    socket.emit('host:transfer', { targetParticipantId }, (res: Ack<PlaybackState>) => {
      if (!res.ok) fail(res.error);
      resolve(res.ok);
    });
  });
}

export function leaveRoom(): void {
  const socket = getRoomSocket();
  if (!socket?.connected) return;
  socket.emit('room:leave');
}

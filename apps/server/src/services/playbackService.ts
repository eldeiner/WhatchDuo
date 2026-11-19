import type { PlaybackRate, PlaybackState, VideoType } from '@cineduo/shared';
import {
  clampPosition,
  computeDrift,
  detectVideoType,
  expectedPosition,
  SYNC,
} from '@cineduo/shared';
import { AppError } from '../lib/errors';
import type { LiveRoom } from './roomStore';
import { recordEvent, schedulePersist } from './roomService';
import { extractMediaSource } from './mediaExtractor';

/** Verdad del servidor: solo el host puede mutar la reproducción. */
export function assertHost(room: LiveRoom, participantId: string): void {
  if (!room.playback.hostId || room.playback.hostId !== participantId) {
    throw new AppError('FORBIDDEN', 'Solo el host controla la reproducción', 403);
  }
}

function commit(
  room: LiveRoom,
  patch: Partial<PlaybackState>,
  options: { bumpVersion?: boolean } = {},
): PlaybackState {
  const { bumpVersion = true } = options;
  const now = Date.now();
  room.playback = {
    ...room.playback,
    ...patch,
    updatedAt: now,
    version: bumpVersion ? room.playback.version + 1 : room.playback.version,
  };
  room.lastActivityAt = now;
  schedulePersist(room);
  return { ...room.playback };
}

export function play(room: LiveRoom, participantId: string, position: number): PlaybackState {
  assertHost(room, participantId);
  const state = commit(room, { position: clampPosition(position), isPlaying: true });
  recordEvent(room, 'player:play', participantId, {
    position: state.position,
    version: state.version,
  });
  return state;
}

export function pause(room: LiveRoom, participantId: string, position: number): PlaybackState {
  assertHost(room, participantId);
  const state = commit(room, { position: clampPosition(position), isPlaying: false });
  recordEvent(room, 'player:pause', participantId, {
    position: state.position,
    version: state.version,
  });
  return state;
}

export function seek(room: LiveRoom, participantId: string, position: number): PlaybackState {
  assertHost(room, participantId);
  const state = commit(room, { position: clampPosition(position) });
  recordEvent(room, 'player:seek', participantId, {
    position: state.position,
    version: state.version,
  });
  return state;
}

export function setRate(
  room: LiveRoom,
  participantId: string,
  rate: PlaybackRate,
  position?: number,
): PlaybackState {
  assertHost(room, participantId);
  // Re-anclar: si el host no envía posición, usamos la esperada en este instante.
  const anchor = position ?? expectedPosition(room.playback, Date.now());
  const state = commit(room, { position: clampPosition(anchor), playbackRate: rate });
  recordEvent(room, 'player:rate', participantId, { rate, version: state.version });
  return state;
}

export async function setVideo(
  room: LiveRoom,
  participantId: string,
  videoUrl: string,
): Promise<PlaybackState> {
  assertHost(room, participantId);

  let finalUrl = videoUrl;
  let finalType: VideoType = detectVideoType(videoUrl);

  const extracted = await extractMediaSource(videoUrl);
  if (extracted) {
    finalUrl = extracted.streamUrl;
    finalType = extracted.type;
  }

  // El tipo se deriva siempre de la URL en el servidor: el cliente no puede
  // forzar, por ejemplo, un `mp4` sobre un enlace de YouTube.
  const state = commit(room, {
    videoUrl: finalUrl,
    videoType: finalType,
    position: 0,
    isPlaying: false,
    playbackRate: 1,
  });
  recordEvent(room, 'player:video', participantId, {
    videoUrl: finalUrl,
    videoType: state.videoType,
    version: state.version,
  });
  return state;
}

export type HeartbeatOutcome = {
  corrected: boolean;
  drift: number;
  playback: PlaybackState;
  ignored: boolean;
};

/**
 * El host envía cada ~4 s su posición real. Si difiere de la predicción del
 * servidor más de `SYNC.heartbeatTolerance`, el servidor re-ancla el estado
 * (por ejemplo, tras un buffering largo) y emite un `player:sync`.
 * Si no, no se incrementa la versión para no inundar a los invitados.
 */
export function applyHeartbeat(
  room: LiveRoom,
  participantId: string,
  input: { position: number; isPlaying: boolean },
): HeartbeatOutcome {
  if (room.playback.hostId !== participantId) {
    return { corrected: false, drift: 0, playback: { ...room.playback }, ignored: true };
  }

  const now = Date.now();
  const predicted = expectedPosition(room.playback, now);
  const drift = computeDrift(clampPosition(input.position), predicted);
  const stateMismatch = input.isPlaying !== room.playback.isPlaying;

  if (!stateMismatch && Math.abs(drift) <= SYNC.heartbeatTolerance) {
    return { corrected: false, drift, playback: { ...room.playback }, ignored: false };
  }

  const state = commit(room, {
    position: clampPosition(input.position),
    isPlaying: input.isPlaying,
  });
  recordEvent(room, 'player:heartbeat-correct', participantId, {
    drift: Number(drift.toFixed(3)),
    version: state.version,
  });
  return { corrected: true, drift, playback: state, ignored: false };
}

export function snapshot(room: LiveRoom): PlaybackState {
  return { ...room.playback };
}

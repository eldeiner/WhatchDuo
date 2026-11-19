/**
 * Matemática de sincronización. Funciones puras y sin I/O para poder testearlas
 * de forma determinista. Ver docs/SYNC.md para la explicación del algoritmo.
 */
import type { PlaybackRate } from './constants';
import { SYNC } from './constants';

export interface PlaybackClockInput {
  position: number;
  isPlaying: boolean;
  playbackRate: number;
  /** epoch ms del servidor */
  updatedAt: number;
}

export type Correction =
  | { kind: 'none'; expected: number; drift: number }
  | { kind: 'seek'; expected: number; drift: number; to: number }
  | {
      kind: 'rate';
      expected: number;
      drift: number;
      /** Velocidad temporal a aplicar al elemento <video>. */
      rate: number;
      /** Velocidad nominal a restaurar. */
      baseRate: PlaybackRate;
      revertAfterMs: number;
    };

/** Posición esperada según el reloj del servidor. */
export function expectedPosition(state: PlaybackClockInput, serverNow: number): number {
  const base = Math.max(0, state.position);
  if (!state.isPlaying) return base;
  // Un updatedAt en el futuro (reloj movido) no debe restar tiempo.
  const elapsedSeconds = Math.max(0, serverNow - state.updatedAt) / 1000;
  return base + elapsedSeconds * Math.max(0, state.playbackRate);
}

export function computeDrift(localPosition: number, expected: number): number {
  return localPosition - expected;
}

export function shouldAcceptVersion(localVersion: number, incomingVersion: number): boolean {
  return incomingVersion > localVersion;
}

/**
 * Decide la corrección a aplicar en el cliente.
 *
 * - Pausado: alinear si el desfase supera la tolerancia (seek exacto).
 * - |drift| >= 0.75 s: seek directo a la posición esperada.
 * - 0.3 s <= |drift| < 0.75 s: velocidad +5% / -5% durante 2 s.
 * - Resto: nada.
 *
 * `drift > 0` significa que el cliente va por delante del servidor.
 */
export function decideCorrection(params: {
  drift: number;
  isPlaying: boolean;
  baseRate: PlaybackRate;
  expected: number;
}): Correction {
  const { drift, isPlaying, baseRate, expected } = params;
  const magnitude = Math.abs(drift);

  if (!isPlaying) {
    if (magnitude > SYNC.pausedTolerance) {
      return { kind: 'seek', expected, drift, to: expected };
    }
    return { kind: 'none', expected, drift };
  }

  if (magnitude >= SYNC.hardSeekThreshold) {
    return { kind: 'seek', expected, drift, to: expected };
  }

  if (magnitude >= SYNC.softSyncThreshold) {
    const multiplier = drift > 0 ? SYNC.softRateDown : SYNC.softRateUp;
    const rate = clampRate(baseRate * multiplier);
    return {
      kind: 'rate',
      expected,
      drift,
      rate,
      baseRate,
      revertAfterMs: SYNC.softSyncDurationMs,
    };
  }

  return { kind: 'none', expected, drift };
}

/** hls.js y HTMLMediaElement aceptan un rango amplio, pero limitamos por seguridad. */
export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(4, Math.max(0.25, Math.round(rate * 1000) / 1000));
}

export function clampPosition(position: number, duration?: number): number {
  if (!Number.isFinite(position) || position < 0) return 0;
  if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
    return Math.min(position, Math.max(0, duration - 0.05));
  }
  return position;
}

/** Distancia mínima entre dos posiciones para considerar un cambio real. */
export function positionsDiffer(a: number, b: number, tolerance = 0.15): boolean {
  return Math.abs(a - b) > tolerance;
}

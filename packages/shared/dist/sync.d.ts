/**
 * Matemática de sincronización. Funciones puras y sin I/O para poder testearlas
 * de forma determinista. Ver docs/SYNC.md para la explicación del algoritmo.
 */
import type { PlaybackRate } from './constants';
export interface PlaybackClockInput {
    position: number;
    isPlaying: boolean;
    playbackRate: number;
    /** epoch ms del servidor */
    updatedAt: number;
}
export type Correction = {
    kind: 'none';
    expected: number;
    drift: number;
} | {
    kind: 'seek';
    expected: number;
    drift: number;
    to: number;
} | {
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
export declare function expectedPosition(state: PlaybackClockInput, serverNow: number): number;
export declare function computeDrift(localPosition: number, expected: number): number;
export declare function shouldAcceptVersion(localVersion: number, incomingVersion: number): boolean;
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
export declare function decideCorrection(params: {
    drift: number;
    isPlaying: boolean;
    baseRate: PlaybackRate;
    expected: number;
}): Correction;
/** hls.js y HTMLMediaElement aceptan un rango amplio, pero limitamos por seguridad. */
export declare function clampRate(rate: number): number;
export declare function clampPosition(position: number, duration?: number): number;
/** Distancia mínima entre dos posiciones para considerar un cambio real. */
export declare function positionsDiffer(a: number, b: number, tolerance?: number): boolean;

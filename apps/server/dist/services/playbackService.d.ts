import type { PlaybackRate, PlaybackState } from '@cineduo/shared';
import type { LiveRoom } from './roomStore';
/** Verdad del servidor: solo el host puede mutar la reproducción. */
export declare function assertHost(room: LiveRoom, participantId: string): void;
export declare function play(room: LiveRoom, participantId: string, position: number): PlaybackState;
export declare function pause(room: LiveRoom, participantId: string, position: number): PlaybackState;
export declare function seek(room: LiveRoom, participantId: string, position: number): PlaybackState;
export declare function setRate(room: LiveRoom, participantId: string, rate: PlaybackRate, position?: number): PlaybackState;
export declare function setVideo(room: LiveRoom, participantId: string, videoUrl: string): Promise<PlaybackState>;
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
export declare function applyHeartbeat(room: LiveRoom, participantId: string, input: {
    position: number;
    isPlaying: boolean;
}): HeartbeatOutcome;
export declare function snapshot(room: LiveRoom): PlaybackState;

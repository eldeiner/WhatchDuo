/**
 * Constantes compartidas entre cliente y servidor.
 * Cambiar un valor aquí afecta a ambos lados del protocolo.
 */
export declare const PROTOCOL_VERSION = 1;
/** Alfabeto sin caracteres ambiguos (0/O, 1/I/L). */
export declare const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export declare const ROOM_CODE_LENGTH = 6;
export declare const NICKNAME_MIN = 2;
export declare const NICKNAME_MAX = 24;
export declare const MESSAGE_MAX = 500;
export declare const VIDEO_URL_MAX = 2048;
export declare const MAX_ROOM_AGE_HOURS = 24;
export declare const PLAYBACK_RATES: readonly [0.75, 1, 1.25, 1.5];
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];
export declare const REACTIONS: readonly ["❤️", "😂", "😮", "😢", "👏", "🔥", "🍿", "😴"];
export type ReactionEmoji = (typeof REACTIONS)[number];
export declare const VIDEO_TYPES: readonly ["mp4", "webm", "hls", "youtube", "vimeo", "webrtc"];
export type VideoType = (typeof VIDEO_TYPES)[number];
/** Parámetros del algoritmo de sincronización (ver docs/SYNC.md). */
export declare const SYNC: {
    /** Por encima de este desfase se hace seek correctivo. */
    readonly hardSeekThreshold: 0.75;
    /** Entre este umbral y hardSeekThreshold se corrige con micro-ajuste de velocidad. */
    readonly softSyncThreshold: 0.3;
    /** Multiplicadores temporales de velocidad para el micro-ajuste. */
    readonly softRateUp: 1.05;
    readonly softRateDown: 0.95;
    /** Duración del micro-ajuste antes de volver a la velocidad nominal. */
    readonly softSyncDurationMs: 2000;
    /** Tolerancia cuando el video está pausado. */
    readonly pausedTolerance: 0.1;
    /** El host envía heartbeat con su posición real. */
    readonly heartbeatIntervalMs: 4000;
    /** Tolerancia del servidor antes de corregir el estado con un heartbeat. */
    readonly heartbeatTolerance: 0.4;
    /** Nº de muestras de reloj que se conservan. */
    readonly clockSampleCount: 5;
    /** Si el host no vuelve en este tiempo, se promueve a otro participante. */
    readonly hostDisconnectGraceMs: 30000;
    /** Intervalo de limpieza de salas inactivas. */
    readonly roomSweepIntervalMs: number;
};
/** Límites de rate limiting (ventana deslizante en memoria). */
export declare const RATE_LIMITS: {
    readonly createRoom: {
        readonly points: 10;
        readonly windowMs: number;
    };
    readonly joinRoom: {
        readonly points: 30;
        readonly windowMs: number;
    };
    readonly chat: {
        readonly points: 8;
        readonly windowMs: 10000;
    };
    readonly reaction: {
        readonly points: 6;
        readonly windowMs: 5000;
    };
    readonly command: {
        readonly points: 40;
        readonly windowMs: 10000;
    };
    readonly ping: {
        readonly points: 60;
        readonly windowMs: 10000;
    };
};
export declare const ERROR_CODES: {
    readonly VALIDATION: "VALIDATION_ERROR";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly ROOM_CLOSED: "ROOM_CLOSED";
    readonly ROOM_FULL: "ROOM_FULL";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly CONFLICT: "CONFLICT";
    readonly INTERNAL: "INTERNAL_ERROR";
};
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

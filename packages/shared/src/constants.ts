/**
 * Constantes compartidas entre cliente y servidor.
 * Cambiar un valor aquí afecta a ambos lados del protocolo.
 */

export const PROTOCOL_VERSION = 1;

/** Alfabeto sin caracteres ambiguos (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 24;
export const MESSAGE_MAX = 500;
export const VIDEO_URL_MAX = 2048;
export const MAX_ROOM_AGE_HOURS = 24;

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥', '🍿', '😴'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export const VIDEO_TYPES = ['mp4', 'webm', 'hls', 'youtube', 'vimeo', 'webrtc'] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];

/** Parámetros del algoritmo de sincronización (ver docs/SYNC.md). */
export const SYNC = {
  /** Por encima de este desfase se hace seek correctivo. */
  hardSeekThreshold: 0.75,
  /** Entre este umbral y hardSeekThreshold se corrige con micro-ajuste de velocidad. */
  softSyncThreshold: 0.3,
  /** Multiplicadores temporales de velocidad para el micro-ajuste. */
  softRateUp: 1.05,
  softRateDown: 0.95,
  /** Duración del micro-ajuste antes de volver a la velocidad nominal. */
  softSyncDurationMs: 2000,
  /** Tolerancia cuando el video está pausado. */
  pausedTolerance: 0.1,
  /** El host envía heartbeat con su posición real. */
  heartbeatIntervalMs: 4000,
  /** Tolerancia del servidor antes de corregir el estado con un heartbeat. */
  heartbeatTolerance: 0.4,
  /** Nº de muestras de reloj que se conservan. */
  clockSampleCount: 5,
  /** Si el host no vuelve en este tiempo, se promueve a otro participante. */
  hostDisconnectGraceMs: 30_000,
  /** Intervalo de limpieza de salas inactivas. */
  roomSweepIntervalMs: 5 * 60_000,
} as const;

/** Límites de rate limiting (ventana deslizante en memoria). */
export const RATE_LIMITS = {
  createRoom: { points: 10, windowMs: 60 * 60_000 },
  joinRoom: { points: 30, windowMs: 5 * 60_000 },
  chat: { points: 8, windowMs: 10_000 },
  reaction: { points: 6, windowMs: 5_000 },
  command: { points: 40, windowMs: 10_000 },
  ping: { points: 60, windowMs: 10_000 },
} as const;

export const ERROR_CODES = {
  VALIDATION: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  ROOM_CLOSED: 'ROOM_CLOSED',
  ROOM_FULL: 'ROOM_FULL',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

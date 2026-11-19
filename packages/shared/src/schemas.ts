import { z } from 'zod';
import {
  MESSAGE_MAX,
  NICKNAME_MAX,
  NICKNAME_MIN,
  PLAYBACK_RATES,
  REACTIONS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  VIDEO_TYPES,
  VIDEO_URL_MAX,
  type VideoType,
} from './constants';

const ROOM_CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
const NICKNAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;
const MAX_POSITION_SECONDS = 24 * 60 * 60;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ROOM_CODE_RE, 'El código de sala no es válido');

export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN, `El apodo debe tener al menos ${NICKNAME_MIN} caracteres`)
  .max(NICKNAME_MAX, `El apodo no puede superar ${NICKNAME_MAX} caracteres`)
  .regex(NICKNAME_RE, 'El apodo solo admite letras, números, espacios, punto, guion y guion bajo');

export const positionSchema = z
  .number()
  .finite('La posición debe ser un número')
  .min(0, 'La posición no puede ser negativa')
  .max(MAX_POSITION_SECONDS, 'La posición es demasiado grande');

export const playbackRateSchema = z.union([
  z.literal(PLAYBACK_RATES[0]),
  z.literal(PLAYBACK_RATES[1]),
  z.literal(PLAYBACK_RATES[2]),
  z.literal(PLAYBACK_RATES[3]),
]);

export const videoTypeSchema = z.enum(VIDEO_TYPES);

export const clientSeqSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const reactionSchema = z.enum(REACTIONS);

/**
 * Acepta URLs absolutas http(s) y rutas relativas del propio sitio
 * (por ejemplo `/videos/demo.mp4` para el video de muestra).
 */
export function isAllowedVideoUrl(value: string): boolean {
  if (value === 'webrtc:tab' || value.startsWith('webrtc:')) return true;
  if (value.startsWith('/')) return value.length > 1 && !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const UNSUPPORTED_PLATFORMS = [
  { domain: 'netflix.com', label: 'Netflix' },
  { domain: 'disneyplus.com', label: 'Disney+' },
  { domain: 'max.com', label: 'Max' },
  { domain: 'hbomax.com', label: 'HBO Max' },
  { domain: 'primevideo.com', label: 'Prime Video' },
  { domain: 'amazon.com', label: 'Prime Video' },
] as const;

export interface FileVideoSource {
  type: 'mp4' | 'webm' | 'hls' | 'webrtc';
}

export interface EmbeddedVideoSource {
  type: 'youtube' | 'vimeo';
  videoId: string;
  /** Hash de privacidad de los videos no listados de Vimeo. */
  hash?: string;
}

export type VideoSource = FileVideoSource | EmbeddedVideoSource;

/**
 * Detecta enlaces a plataformas con DRM. No se pueden incrustar ni reproducir
 * sin eludir protecciones, algo que CineDúo no hace.
 */
export function detectUnsupportedVideoPage(value: string): string | null {
  let hostname: string;
  try {
    const url = new URL(value, 'https://cineduo.local');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    hostname = url.hostname.toLowerCase();
  } catch {
    return null;
  }

  const match = UNSUPPORTED_PLATFORMS.find(
    (platform) => hostname === platform.domain || hostname.endsWith(`.${platform.domain}`),
  );
  return match?.label ?? null;
}

const YOUTUBE_HOSTS = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'];
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_HOSTS = ['vimeo.com', 'player.vimeo.com'];

function isYouTubeHost(hostname: string): boolean {
  return hostname === 'youtu.be' || YOUTUBE_HOSTS.includes(hostname);
}

function isVimeoHost(hostname: string): boolean {
  return VIMEO_HOSTS.includes(hostname);
}

function cleanHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

function extractYouTubeId(url: URL): string | null {
  const host = cleanHostname(url);
  const segments = url.pathname.split('/').filter(Boolean);
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = segments[0] ?? null;
  } else {
    candidate = url.searchParams.get('v');
    const kind = segments[0];
    if (!candidate && kind && ['embed', 'shorts', 'live', 'v', 'e'].includes(kind)) {
      candidate = segments[1] ?? null;
    }
  }

  return candidate && YOUTUBE_ID_RE.test(candidate) ? candidate : null;
}

function extractVimeoId(url: URL): { videoId: string; hash?: string } | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const index = segments.findIndex((segment) => /^\d{6,}$/.test(segment));
  if (index === -1) return null;

  const videoId = segments[index]!;
  const next = segments[index + 1];
  const hash =
    url.searchParams.get('h') ?? (next && /^[A-Za-z0-9]+$/.test(next) ? next : undefined);
  return hash ? { videoId, hash } : { videoId };
}

function fileTypeFromPath(pathname: string): FileVideoSource['type'] {
  const path = pathname.toLowerCase();
  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.webm')) return 'webm';
  return 'mp4';
}

function isGenericEmbedHost(hostname: string): boolean {
  return (
    hostname.includes('bysedikamoum') ||
    hostname.includes('byse') ||
    hostname.includes('streamwish') ||
    hostname.includes('doodstream') ||
    hostname.includes('filemoon')
  );
}

/**
 * Clasifica una URL de video: archivo directo (MP4/WebM/HLS), YouTube o Vimeo.
 * Devuelve `null` si es un enlace de YouTube/Vimeo sin un ID reconocible.
 */
export function parseVideoSource(value: string): VideoSource | null {
  if (value === 'webrtc:tab' || value.startsWith('webrtc:')) {
    return { type: 'webrtc' };
  }
  let url: URL;
  try {
    url = new URL(value, 'https://cineduo.local');
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = cleanHostname(url);

  if (isYouTubeHost(host)) {
    const videoId = extractYouTubeId(url);
    return videoId ? { type: 'youtube', videoId } : null;
  }

  if (isVimeoHost(host)) {
    const parsed = extractVimeoId(url);
    return parsed ? { type: 'vimeo', ...parsed } : null;
  }

  if (isGenericEmbedHost(host)) {
    return { type: 'hls' };
  }

  return { type: fileTypeFromPath(url.pathname) };
}

/** URL de incrustación para los reproductores soportados. */
export function videoEmbedUrl(source: EmbeddedVideoSource): string {
  if (source.type === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${source.videoId}`;
  }
  const params = new URLSearchParams({ autopause: '0', badge: '0', byline: '0', portrait: '0' });
  if (source.hash) params.set('h', source.hash);
  return `https://player.vimeo.com/video/${source.videoId}?${params.toString()}`;
}

export const videoUrlSchema = z
  .string()
  .trim()
  .max(VIDEO_URL_MAX, 'La URL del video es demasiado larga')
  .refine(isAllowedVideoUrl, 'Introduce una URL http(s) válida o una ruta /ruta/video.mp4')
  .superRefine((value, ctx) => {
    const platform = detectUnsupportedVideoPage(value);
    if (platform) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Los enlaces de ${platform} están protegidos con DRM y no se pueden reproducir en CineDúo.`,
      });
      return;
    }

    if (!parseVideoSource(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Ese enlace de YouTube/Vimeo no contiene un video válido. Copia la URL completa del video.',
      });
    }
  });

/** Devuelve el primer error de una URL de video o `null` si es válida. */
export function videoUrlError(value: string): string | null {
  const result = videoUrlSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? 'URL de video no válida');
}

export const chatTextSchema = z
  .string()
  .min(1, 'El mensaje está vacío')
  .max(MESSAGE_MAX, `El mensaje no puede superar ${MESSAGE_MAX} caracteres`);

/** Detecta el tipo de video a partir de la URL (sin hacer peticiones de red). */
export function detectVideoType(url: string): VideoType {
  return parseVideoSource(url)?.type ?? fileTypeFromPath(url);
}

/* ------------------------------------------------------------------ */
/* REST                                                                */
/* ------------------------------------------------------------------ */

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  videoUrl: videoUrlSchema.optional(),
});

export const joinRoomSchema = z.object({
  nickname: nicknameSchema,
});

/* ------------------------------------------------------------------ */
/* Eventos de Socket.IO                                                */
/* ------------------------------------------------------------------ */

export const pingPayloadSchema = z.object({
  clientTime: z.number().finite(),
});

export const createRoomPayloadSchema = createRoomSchema;

export const joinRoomPayloadSchema = z.object({
  code: roomCodeSchema,
  nickname: nicknameSchema.optional(),
  token: z.string().min(10).max(4096).optional(),
});

export const playCommandSchema = z.object({
  position: positionSchema,
  clientSeq: clientSeqSchema,
});

export const pauseCommandSchema = z.object({
  position: positionSchema,
  clientSeq: clientSeqSchema,
});

export const seekCommandSchema = z.object({
  position: positionSchema,
  clientSeq: clientSeqSchema,
});

export const rateCommandSchema = z.object({
  rate: playbackRateSchema,
  clientSeq: clientSeqSchema,
  position: positionSchema.optional(),
});

export const heartbeatSchema = z.object({
  position: positionSchema,
  isPlaying: z.boolean(),
  clientTime: z.number().finite(),
  clientSeq: clientSeqSchema,
});

export const setVideoSchema = z.object({
  videoUrl: videoUrlSchema,
  videoType: videoTypeSchema.optional(),
  clientSeq: clientSeqSchema,
});

export const chatSendSchema = z.object({
  text: chatTextSchema,
});

export const reactionSendSchema = z.object({
  emoji: reactionSchema,
});

export const transferHostSchema = z.object({
  targetParticipantId: z.string().min(8).max(64),
});

export const bufferingSchema = z.object({
  isBuffering: z.boolean(),
});

export const webrtcSignalSchema = z.object({
  targetId: z.string().min(8).max(64),
  data: z.unknown(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

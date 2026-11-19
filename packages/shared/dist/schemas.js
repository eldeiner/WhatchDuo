"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webrtcSignalSchema = exports.bufferingSchema = exports.transferHostSchema = exports.reactionSendSchema = exports.chatSendSchema = exports.setVideoSchema = exports.heartbeatSchema = exports.rateCommandSchema = exports.seekCommandSchema = exports.pauseCommandSchema = exports.playCommandSchema = exports.joinRoomPayloadSchema = exports.createRoomPayloadSchema = exports.pingPayloadSchema = exports.joinRoomSchema = exports.createRoomSchema = exports.chatTextSchema = exports.videoUrlSchema = exports.reactionSchema = exports.clientSeqSchema = exports.videoTypeSchema = exports.playbackRateSchema = exports.positionSchema = exports.nicknameSchema = exports.roomCodeSchema = void 0;
exports.isAllowedVideoUrl = isAllowedVideoUrl;
exports.detectUnsupportedVideoPage = detectUnsupportedVideoPage;
exports.parseVideoSource = parseVideoSource;
exports.videoEmbedUrl = videoEmbedUrl;
exports.videoUrlError = videoUrlError;
exports.detectVideoType = detectVideoType;
const zod_1 = require("zod");
const constants_1 = require("./constants");
const ROOM_CODE_RE = new RegExp(`^[${constants_1.ROOM_CODE_ALPHABET}]{${constants_1.ROOM_CODE_LENGTH}}$`);
const NICKNAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;
const MAX_POSITION_SECONDS = 24 * 60 * 60;
exports.roomCodeSchema = zod_1.z
    .string()
    .trim()
    .toUpperCase()
    .regex(ROOM_CODE_RE, 'El código de sala no es válido');
exports.nicknameSchema = zod_1.z
    .string()
    .trim()
    .min(constants_1.NICKNAME_MIN, `El apodo debe tener al menos ${constants_1.NICKNAME_MIN} caracteres`)
    .max(constants_1.NICKNAME_MAX, `El apodo no puede superar ${constants_1.NICKNAME_MAX} caracteres`)
    .regex(NICKNAME_RE, 'El apodo solo admite letras, números, espacios, punto, guion y guion bajo');
exports.positionSchema = zod_1.z
    .number()
    .finite('La posición debe ser un número')
    .min(0, 'La posición no puede ser negativa')
    .max(MAX_POSITION_SECONDS, 'La posición es demasiado grande');
exports.playbackRateSchema = zod_1.z.union([
    zod_1.z.literal(constants_1.PLAYBACK_RATES[0]),
    zod_1.z.literal(constants_1.PLAYBACK_RATES[1]),
    zod_1.z.literal(constants_1.PLAYBACK_RATES[2]),
    zod_1.z.literal(constants_1.PLAYBACK_RATES[3]),
]);
exports.videoTypeSchema = zod_1.z.enum(constants_1.VIDEO_TYPES);
exports.clientSeqSchema = zod_1.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
exports.reactionSchema = zod_1.z.enum(constants_1.REACTIONS);
/**
 * Acepta URLs absolutas http(s) y rutas relativas del propio sitio
 * (por ejemplo `/videos/demo.mp4` para el video de muestra).
 */
function isAllowedVideoUrl(value) {
    if (value === 'webrtc:tab' || value.startsWith('webrtc:'))
        return true;
    if (value.startsWith('/'))
        return value.length > 1 && !value.startsWith('//');
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    }
    catch {
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
];
/**
 * Detecta enlaces a plataformas con DRM. No se pueden incrustar ni reproducir
 * sin eludir protecciones, algo que CineDúo no hace.
 */
function detectUnsupportedVideoPage(value) {
    let hostname;
    try {
        const url = new URL(value, 'https://cineduo.local');
        if (url.protocol !== 'http:' && url.protocol !== 'https:')
            return null;
        hostname = url.hostname.toLowerCase();
    }
    catch {
        return null;
    }
    const match = UNSUPPORTED_PLATFORMS.find((platform) => hostname === platform.domain || hostname.endsWith(`.${platform.domain}`));
    return match?.label ?? null;
}
const YOUTUBE_HOSTS = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'];
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_HOSTS = ['vimeo.com', 'player.vimeo.com'];
function isYouTubeHost(hostname) {
    return hostname === 'youtu.be' || YOUTUBE_HOSTS.includes(hostname);
}
function isVimeoHost(hostname) {
    return VIMEO_HOSTS.includes(hostname);
}
function cleanHostname(url) {
    return url.hostname.toLowerCase().replace(/^www\./, '');
}
function extractYouTubeId(url) {
    const host = cleanHostname(url);
    const segments = url.pathname.split('/').filter(Boolean);
    let candidate = null;
    if (host === 'youtu.be') {
        candidate = segments[0] ?? null;
    }
    else {
        candidate = url.searchParams.get('v');
        const kind = segments[0];
        if (!candidate && kind && ['embed', 'shorts', 'live', 'v', 'e'].includes(kind)) {
            candidate = segments[1] ?? null;
        }
    }
    return candidate && YOUTUBE_ID_RE.test(candidate) ? candidate : null;
}
function extractVimeoId(url) {
    const segments = url.pathname.split('/').filter(Boolean);
    const index = segments.findIndex((segment) => /^\d{6,}$/.test(segment));
    if (index === -1)
        return null;
    const videoId = segments[index];
    const next = segments[index + 1];
    const hash = url.searchParams.get('h') ?? (next && /^[A-Za-z0-9]+$/.test(next) ? next : undefined);
    return hash ? { videoId, hash } : { videoId };
}
function fileTypeFromPath(pathname) {
    const path = pathname.toLowerCase();
    if (path.endsWith('.m3u8'))
        return 'hls';
    if (path.endsWith('.webm'))
        return 'webm';
    return 'mp4';
}
function isGenericEmbedHost(hostname) {
    return (hostname.includes('bysedikamoum') ||
        hostname.includes('byse') ||
        hostname.includes('streamwish') ||
        hostname.includes('doodstream') ||
        hostname.includes('filemoon'));
}
/**
 * Clasifica una URL de video: archivo directo (MP4/WebM/HLS), YouTube o Vimeo.
 * Devuelve `null` si es un enlace de YouTube/Vimeo sin un ID reconocible.
 */
function parseVideoSource(value) {
    if (value === 'webrtc:tab' || value.startsWith('webrtc:')) {
        return { type: 'webrtc' };
    }
    let url;
    try {
        url = new URL(value, 'https://cineduo.local');
    }
    catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
        return null;
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
function videoEmbedUrl(source) {
    if (source.type === 'youtube') {
        return `https://www.youtube-nocookie.com/embed/${source.videoId}`;
    }
    const params = new URLSearchParams({ autopause: '0', badge: '0', byline: '0', portrait: '0' });
    if (source.hash)
        params.set('h', source.hash);
    return `https://player.vimeo.com/video/${source.videoId}?${params.toString()}`;
}
exports.videoUrlSchema = zod_1.z
    .string()
    .trim()
    .max(constants_1.VIDEO_URL_MAX, 'La URL del video es demasiado larga')
    .refine(isAllowedVideoUrl, 'Introduce una URL http(s) válida o una ruta /ruta/video.mp4')
    .superRefine((value, ctx) => {
    const platform = detectUnsupportedVideoPage(value);
    if (platform) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Los enlaces de ${platform} están protegidos con DRM y no se pueden reproducir en CineDúo.`,
        });
        return;
    }
    if (!parseVideoSource(value)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Ese enlace de YouTube/Vimeo no contiene un video válido. Copia la URL completa del video.',
        });
    }
});
/** Devuelve el primer error de una URL de video o `null` si es válida. */
function videoUrlError(value) {
    const result = exports.videoUrlSchema.safeParse(value);
    return result.success ? null : (result.error.issues[0]?.message ?? 'URL de video no válida');
}
exports.chatTextSchema = zod_1.z
    .string()
    .min(1, 'El mensaje está vacío')
    .max(constants_1.MESSAGE_MAX, `El mensaje no puede superar ${constants_1.MESSAGE_MAX} caracteres`);
/** Detecta el tipo de video a partir de la URL (sin hacer peticiones de red). */
function detectVideoType(url) {
    return parseVideoSource(url)?.type ?? fileTypeFromPath(url);
}
/* ------------------------------------------------------------------ */
/* REST                                                                */
/* ------------------------------------------------------------------ */
exports.createRoomSchema = zod_1.z.object({
    nickname: exports.nicknameSchema,
    videoUrl: exports.videoUrlSchema.optional(),
});
exports.joinRoomSchema = zod_1.z.object({
    nickname: exports.nicknameSchema,
});
/* ------------------------------------------------------------------ */
/* Eventos de Socket.IO                                                */
/* ------------------------------------------------------------------ */
exports.pingPayloadSchema = zod_1.z.object({
    clientTime: zod_1.z.number().finite(),
});
exports.createRoomPayloadSchema = exports.createRoomSchema;
exports.joinRoomPayloadSchema = zod_1.z.object({
    code: exports.roomCodeSchema,
    nickname: exports.nicknameSchema.optional(),
    token: zod_1.z.string().min(10).max(4096).optional(),
});
exports.playCommandSchema = zod_1.z.object({
    position: exports.positionSchema,
    clientSeq: exports.clientSeqSchema,
});
exports.pauseCommandSchema = zod_1.z.object({
    position: exports.positionSchema,
    clientSeq: exports.clientSeqSchema,
});
exports.seekCommandSchema = zod_1.z.object({
    position: exports.positionSchema,
    clientSeq: exports.clientSeqSchema,
});
exports.rateCommandSchema = zod_1.z.object({
    rate: exports.playbackRateSchema,
    clientSeq: exports.clientSeqSchema,
    position: exports.positionSchema.optional(),
});
exports.heartbeatSchema = zod_1.z.object({
    position: exports.positionSchema,
    isPlaying: zod_1.z.boolean(),
    clientTime: zod_1.z.number().finite(),
    clientSeq: exports.clientSeqSchema,
});
exports.setVideoSchema = zod_1.z.object({
    videoUrl: exports.videoUrlSchema,
    videoType: exports.videoTypeSchema.optional(),
    clientSeq: exports.clientSeqSchema,
});
exports.chatSendSchema = zod_1.z.object({
    text: exports.chatTextSchema,
});
exports.reactionSendSchema = zod_1.z.object({
    emoji: exports.reactionSchema,
});
exports.transferHostSchema = zod_1.z.object({
    targetParticipantId: zod_1.z.string().min(8).max(64),
});
exports.bufferingSchema = zod_1.z.object({
    isBuffering: zod_1.z.boolean(),
});
exports.webrtcSignalSchema = zod_1.z.object({
    targetId: zod_1.z.string().min(8).max(64),
    data: zod_1.z.unknown(),
});
//# sourceMappingURL=schemas.js.map
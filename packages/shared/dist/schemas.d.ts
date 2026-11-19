import { z } from 'zod';
import { type VideoType } from './constants';
export declare const roomCodeSchema: z.ZodString;
export declare const nicknameSchema: z.ZodString;
export declare const positionSchema: z.ZodNumber;
export declare const playbackRateSchema: z.ZodUnion<[z.ZodLiteral<0.75>, z.ZodLiteral<1>, z.ZodLiteral<1.25>, z.ZodLiteral<1.5>]>;
export declare const videoTypeSchema: z.ZodEnum<["mp4", "webm", "hls", "youtube", "vimeo", "webrtc"]>;
export declare const clientSeqSchema: z.ZodNumber;
export declare const reactionSchema: z.ZodEnum<["❤️", "😂", "😮", "😢", "👏", "🔥", "🍿", "😴"]>;
/**
 * Acepta URLs absolutas http(s) y rutas relativas del propio sitio
 * (por ejemplo `/videos/demo.mp4` para el video de muestra).
 */
export declare function isAllowedVideoUrl(value: string): boolean;
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
export declare function detectUnsupportedVideoPage(value: string): string | null;
/**
 * Clasifica una URL de video: archivo directo (MP4/WebM/HLS), YouTube o Vimeo.
 * Devuelve `null` si es un enlace de YouTube/Vimeo sin un ID reconocible.
 */
export declare function parseVideoSource(value: string): VideoSource | null;
/** URL de incrustación para los reproductores soportados. */
export declare function videoEmbedUrl(source: EmbeddedVideoSource): string;
export declare const videoUrlSchema: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
/** Devuelve el primer error de una URL de video o `null` si es válida. */
export declare function videoUrlError(value: string): string | null;
export declare const chatTextSchema: z.ZodString;
/** Detecta el tipo de video a partir de la URL (sin hacer peticiones de red). */
export declare function detectVideoType(url: string): VideoType;
export declare const createRoomSchema: z.ZodObject<{
    nickname: z.ZodString;
    videoUrl: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, "strip", z.ZodTypeAny, {
    nickname: string;
    videoUrl?: string | undefined;
}, {
    nickname: string;
    videoUrl?: string | undefined;
}>;
export declare const joinRoomSchema: z.ZodObject<{
    nickname: z.ZodString;
}, "strip", z.ZodTypeAny, {
    nickname: string;
}, {
    nickname: string;
}>;
export declare const pingPayloadSchema: z.ZodObject<{
    clientTime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    clientTime: number;
}, {
    clientTime: number;
}>;
export declare const createRoomPayloadSchema: z.ZodObject<{
    nickname: z.ZodString;
    videoUrl: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, "strip", z.ZodTypeAny, {
    nickname: string;
    videoUrl?: string | undefined;
}, {
    nickname: string;
    videoUrl?: string | undefined;
}>;
export declare const joinRoomPayloadSchema: z.ZodObject<{
    code: z.ZodString;
    nickname: z.ZodOptional<z.ZodString>;
    token: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    nickname?: string | undefined;
    token?: string | undefined;
}, {
    code: string;
    nickname?: string | undefined;
    token?: string | undefined;
}>;
export declare const playCommandSchema: z.ZodObject<{
    position: z.ZodNumber;
    clientSeq: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    position: number;
    clientSeq: number;
}, {
    position: number;
    clientSeq: number;
}>;
export declare const pauseCommandSchema: z.ZodObject<{
    position: z.ZodNumber;
    clientSeq: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    position: number;
    clientSeq: number;
}, {
    position: number;
    clientSeq: number;
}>;
export declare const seekCommandSchema: z.ZodObject<{
    position: z.ZodNumber;
    clientSeq: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    position: number;
    clientSeq: number;
}, {
    position: number;
    clientSeq: number;
}>;
export declare const rateCommandSchema: z.ZodObject<{
    rate: z.ZodUnion<[z.ZodLiteral<0.75>, z.ZodLiteral<1>, z.ZodLiteral<1.25>, z.ZodLiteral<1.5>]>;
    clientSeq: z.ZodNumber;
    position: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    rate: 1 | 0.75 | 1.25 | 1.5;
    clientSeq: number;
    position?: number | undefined;
}, {
    rate: 1 | 0.75 | 1.25 | 1.5;
    clientSeq: number;
    position?: number | undefined;
}>;
export declare const heartbeatSchema: z.ZodObject<{
    position: z.ZodNumber;
    isPlaying: z.ZodBoolean;
    clientTime: z.ZodNumber;
    clientSeq: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    isPlaying: boolean;
    clientTime: number;
    position: number;
    clientSeq: number;
}, {
    isPlaying: boolean;
    clientTime: number;
    position: number;
    clientSeq: number;
}>;
export declare const setVideoSchema: z.ZodObject<{
    videoUrl: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    videoType: z.ZodOptional<z.ZodEnum<["mp4", "webm", "hls", "youtube", "vimeo", "webrtc"]>>;
    clientSeq: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    videoUrl: string;
    clientSeq: number;
    videoType?: "mp4" | "webm" | "hls" | "youtube" | "vimeo" | "webrtc" | undefined;
}, {
    videoUrl: string;
    clientSeq: number;
    videoType?: "mp4" | "webm" | "hls" | "youtube" | "vimeo" | "webrtc" | undefined;
}>;
export declare const chatSendSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
export declare const reactionSendSchema: z.ZodObject<{
    emoji: z.ZodEnum<["❤️", "😂", "😮", "😢", "👏", "🔥", "🍿", "😴"]>;
}, "strip", z.ZodTypeAny, {
    emoji: "❤️" | "😂" | "😮" | "😢" | "👏" | "🔥" | "🍿" | "😴";
}, {
    emoji: "❤️" | "😂" | "😮" | "😢" | "👏" | "🔥" | "🍿" | "😴";
}>;
export declare const transferHostSchema: z.ZodObject<{
    targetParticipantId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    targetParticipantId: string;
}, {
    targetParticipantId: string;
}>;
export declare const bufferingSchema: z.ZodObject<{
    isBuffering: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    isBuffering: boolean;
}, {
    isBuffering: boolean;
}>;
export declare const webrtcSignalSchema: z.ZodObject<{
    targetId: z.ZodString;
    data: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    targetId: string;
    data?: unknown;
}, {
    targetId: string;
    data?: unknown;
}>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

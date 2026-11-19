import type { VideoType } from '@cineduo/shared';
export interface ExtractedMedia {
    streamUrl: string;
    type: VideoType;
    title?: string;
    posterUrl?: string;
}
/**
 * Desempaqueta código Javascript ofuscado con Dean Edwards Packer:
 * eval(function(p,a,c,k,e,d)...)
 */
export declare function unpackPacker(packedCode: string): string | null;
/**
 * Inspecciona un archivo .m3u8 maestro para extraer la URL directa de la sub-playlist (index-v1-a1.m3u8, etc.)
 * con el mejor ancho de banda o la primera pista de video disponible.
 */
export declare function resolveActualHlsStream(playlistUrl: string, refererOrigin?: string): Promise<string | null>;
/**
 * Intenta resolver cualquier URL de video compleja a un stream nativo reproducible.
 */
export declare function extractMediaSource(urlStr: string): Promise<ExtractedMedia | null>;

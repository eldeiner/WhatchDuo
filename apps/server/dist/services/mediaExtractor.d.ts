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
 * Intenta resolver cualquier URL de video compleja a un stream nativo reproducible.
 */
export declare function extractMediaSource(urlStr: string): Promise<ExtractedMedia | null>;

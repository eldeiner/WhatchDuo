import crypto from 'node:crypto';
import type { VideoType } from '@cineduo/shared';
import { logger } from '../lib/logger';

export interface ExtractedMedia {
  streamUrl: string;
  type: VideoType;
  title?: string;
  posterUrl?: string;
}

/**
 * Decodifica cadenas Base64 con compatibilidad URL-safe.
 */
function decodeBase64(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + '='.repeat(pad), 'base64');
}

/**
 * Tabla de derivación de claves para Byse/StreamWish clones.
 */
function getDerivedIndices(version: string, length: number): [number, number] | null {
  const v = parseInt(version.trim(), 10);
  if (Number.isNaN(v) || v < 1 || v > 20) return null;
  const a = v;
  const b = 31 - v;
  if (a < 1 || b < 1 || a > length || b > length) return null;
  return [a, b];
}

interface BysePlayback {
  algorithm?: string;
  iv: string;
  payload: string;
  key_parts: string[];
  version: string;
}

interface ByseApiResponse {
  id?: number;
  code?: string;
  title?: string;
  poster_url?: string;
  playback?: BysePlayback;
}

interface ByseDecryptedSource {
  sources?: Array<{
    quality?: string;
    mime_type?: string;
    url?: string;
  }>;
}

/**
 * Desempaqueta código Javascript ofuscado con Dean Edwards Packer:
 * eval(function(p,a,c,k,e,d)...)
 */
export function unpackPacker(packedCode: string): string | null {
  const packerPattern = /eval\(function\(p,a,c,k,e,[rd]\)\s*\{[\s\S]*?\}\s*\((['"][\s\S]*?['"])\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"][\s\S]*?['"])\.split\(['"]\|['"]\)/;
  const match = packedCode.match(packerPattern);
  if (!match) return null;

  try {
    let payload = match[1]!;
    // Remover comillas envolventes
    if ((payload.startsWith("'") && payload.endsWith("'")) || (payload.startsWith('"') && payload.endsWith('"'))) {
      payload = payload.slice(1, -1);
    }
    // Desescapar comillas
    payload = payload.replace(/\\'/g, "'").replace(/\\"/g, '"');

    const radix = parseInt(match[2]!, 10);
    const count = parseInt(match[3]!, 10);
    let dictStr = match[4]!;
    if ((dictStr.startsWith("'") && dictStr.endsWith("'")) || (dictStr.startsWith('"') && dictStr.endsWith('"'))) {
      dictStr = dictStr.slice(1, -1);
    }
    const dictionary = dictStr.split('|');

    if (dictionary.length < count) {
      // Padding
      while (dictionary.length < count) dictionary.push('');
    }

    const encodeBase = (num: number, rad: number): string => {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const c = chars.slice(0, rad);
      let res = '';
      if (num === 0) return '0';
      while (num > 0) {
        res = c[num % rad] + res;
        num = Math.floor(num / rad);
      }
      return res;
    };

    const lookup: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
      const key = encodeBase(i, radix);
      lookup[key] = dictionary[i] || key;
    }

    const unpacked = payload.replace(/\b[0-9a-zA-Z]+\b/g, (token) => {
      return Object.prototype.hasOwnProperty.call(lookup, token) ? lookup[token]! : token;
    });

    return unpacked;
  } catch (err) {
    logger.debug(`Error unpacking packer code: ${err}`);
    return null;
  }
}

/**
 * Cabeceras comunes imitando un navegador moderno para saltar protecciones simples.
 */
function getBrowserHeaders(refererOrigin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Upgrade-Insecure-Requests': '1',
  };
  if (refererOrigin) {
    headers.Referer = refererOrigin;
  }
  return headers;
}

/**
 * Extrae streams de páginas basadas en la plataforma Byse (p. ej. bysedikamoum.com, byse, etc.)
 */
async function extractFromByse(parsedUrl: URL): Promise<ExtractedMedia | null> {
  // URLs típicas: /d/{code} o /e/{code} o /api/videos/{code}
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const code = segments.length >= 2 && ['d', 'e', 'v'].includes(segments[0]!)
    ? segments[1]!
    : segments[0];

  if (!code || !/^[A-Za-z0-9_-]{6,}$/.test(code)) return null;

  const apiUrl = `${parsedUrl.origin}/api/videos/${encodeURIComponent(code)}`;
  const response = await fetch(apiUrl, {
    headers: getBrowserHeaders(parsedUrl.origin),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    logger.warn(`Byse API returned status ${response.status} for ${apiUrl}`);
    return null;
  }

  const data = (await response.json()) as ByseApiResponse;
  const pb = data.playback;
  if (!pb?.iv || !pb.payload || !Array.isArray(pb.key_parts) || !pb.version) {
    return null;
  }

  const indices = getDerivedIndices(pb.version, pb.key_parts.length);
  const selectedKeys = indices
    ? [pb.key_parts[indices[0] - 1]!, pb.key_parts[indices[1] - 1]!]
    : pb.key_parts;

  const keyBytes = Buffer.concat(selectedKeys.map(decodeBase64));
  const ivBytes = decodeBase64(pb.iv);
  const payloadBytes = decodeBase64(pb.payload);

  if (payloadBytes.length < 16) return null;

  // WebCrypto / AES-256-GCM auth tag se sitúa en los últimos 16 bytes del payload
  const ciphertext = payloadBytes.subarray(0, payloadBytes.length - 16);
  const tag = payloadBytes.subarray(payloadBytes.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes, ivBytes);
  decipher.setAuthTag(tag);
  const decryptedBuf = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const decrypted = JSON.parse(decryptedBuf.toString('utf8')) as ByseDecryptedSource;

  const source = decrypted.sources?.find((s) => s.url);
  if (!source?.url) return null;

  let streamUrl = source.url;
  const isHls = streamUrl.includes('.m3u8') || source.mime_type?.includes('mpegurl');

  // Si es HLS y apunta a un master.m3u8, resolver la sub-playlist index real de video
  if (isHls && (streamUrl.includes('master.m3u8') || streamUrl.endsWith('.m3u8'))) {
    try {
      const resolvedSub = await resolveActualHlsStream(streamUrl, parsedUrl.origin);
      if (resolvedSub) {
        streamUrl = resolvedSub;
      }
    } catch (err) {
      logger.debug(`Could not inspect sub-playlist for Byse master: ${err}`);
    }
  }

  return {
    streamUrl,
    type: isHls ? 'hls' : 'mp4',
    title: data.title,
    posterUrl: data.poster_url,
  };
}

/**
 * Inspecciona un archivo .m3u8 maestro para extraer la URL directa de la sub-playlist (index-v1-a1.m3u8, etc.)
 * con el mejor ancho de banda o la primera pista de video disponible.
 */
export async function resolveActualHlsStream(playlistUrl: string, refererOrigin?: string): Promise<string | null> {
  try {
    const res = await fetch(playlistUrl, {
      headers: getBrowserHeaders(refererOrigin),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const baseUrl = new URL(playlistUrl);
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (line && line.startsWith('#EXT-X-STREAM-INF')) {
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]?.trim();
          if (nextLine && !nextLine.startsWith('#')) {
            return new URL(nextLine, baseUrl).toString();
          }
        }
      }
    }
  } catch (err) {
    logger.debug(`Error resolving actual HLS stream from master: ${err}`);
  }
  return null;
}

/**
 * Escanea texto (HTML o JS desempaquetado) en busca de URLs de video HLS o MP4.
 */
function findStreamInContent(content: string, baseUrl: URL): { url: string; type: VideoType } | null {
  // 1. Enlace HLS .m3u8 (soporta barras escapadas \/ y query params)
  const m3u8Match = content.match(/https?:\\?\/\\?\/[^"'<>\s\\]+?\.m3u8(?:\?[^"'<>\s\\]*)?/i);
  if (m3u8Match && m3u8Match[0]) {
    const rawUrl = m3u8Match[0].replace(/\\/g, '');
    try {
      const resolved = new URL(rawUrl, baseUrl).toString();
      return { url: resolved, type: 'hls' };
    } catch {
      return { url: rawUrl, type: 'hls' };
    }
  }

  // 1.1 M3u8 con path relativo ej: "/hls/master.m3u8" o "source: 'master.m3u8'"
  const relativeM3u8 = content.match(/["'](\/[^"'<>\s\\]+?\.m3u8(?:\?[^"'<>\s\\]*)?)["']/i);
  if (relativeM3u8 && relativeM3u8[1]) {
    try {
      const resolved = new URL(relativeM3u8[1], baseUrl).toString();
      return { url: resolved, type: 'hls' };
    } catch {
      // Ignorar si falla parseo
    }
  }

  // 2. Enlace MP4
  const mp4Match = content.match(/https?:\\?\/\\?\/[^"'<>\s\\]+?\.mp4(?:\?[^"'<>\s\\]*)?/i);
  if (mp4Match && mp4Match[0]) {
    const rawUrl = mp4Match[0].replace(/\\/g, '');
    try {
      const resolved = new URL(rawUrl, baseUrl).toString();
      return { url: resolved, type: 'mp4' };
    } catch {
      return { url: rawUrl, type: 'mp4' };
    }
  }

  return null;
}

/**
 * Intenta resolver cualquier URL de video compleja a un stream nativo reproducible.
 */
export async function extractMediaSource(urlStr: string): Promise<ExtractedMedia | null> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return null;
  }

  // 0. Si ya es un enlace directo a archivo (.mp4, .webm, o .m3u8), no hacer extracción extra
  const pathname = parsed.pathname.toLowerCase();
  if (pathname.endsWith('.mp4')) {
    return { streamUrl: urlStr, type: 'mp4' };
  }
  if (pathname.endsWith('.webm')) {
    return { streamUrl: urlStr, type: 'webm' };
  }
  if (pathname.endsWith('.m3u8')) {
    // Si es un master.m3u8, intentar resolver el sub-playlist index de mayor compatibilidad
    if (pathname.includes('master.m3u8')) {
      const resolved = await resolveActualHlsStream(urlStr, parsed.origin);
      if (resolved) {
        return { streamUrl: resolved, type: 'hls' };
      }
    }
    return { streamUrl: urlStr, type: 'hls' };
  }

  const host = parsed.hostname.toLowerCase();

  // Función 1: Extractor específico para plataformas tipo Byse / API directa
  if (
    host.includes('bysedikamoum') ||
    host.includes('byse') ||
    parsed.pathname.startsWith('/d/') ||
    parsed.pathname.startsWith('/e/')
  ) {
    try {
      const byseResult = await extractFromByse(parsed);
      if (byseResult) return byseResult;
    } catch (err) {
      logger.warn(`Error extracting from Byse extractor for ${urlStr}: ${err}`);
    }
  }

  // Función 2 (Opción 3 Automática): Escaneo asistido de streams HLS/MP4 embebidos + Proxy CORS
  if (!host.includes('youtube') && !host.includes('youtu.be') && !host.includes('vimeo')) {
    try {
      const genericResult = await extractGenericOrProxy(parsed, urlStr);
      if (genericResult) return genericResult;
    } catch (err) {
      logger.warn(`Fallback Option 3 extraction error for ${urlStr}: ${err}`);
    }
  }

  return null;
}

/**
 * Opción 3: Extractor Asistido + Desempaquetador + Seguimiento de Iframes + Proxy CORS HLS.
 */
async function extractGenericOrProxy(
  parsedUrl: URL,
  originalUrl: string,
  depth = 0,
): Promise<ExtractedMedia | null> {
  if (depth > 2) return null;

  const isDirectHls = parsedUrl.pathname.toLowerCase().endsWith('.m3u8');
  if (isDirectHls) {
    return {
      streamUrl: `/api/proxy/hls?url=${encodeURIComponent(originalUrl)}&referer=${encodeURIComponent(parsedUrl.origin)}`,
      type: 'hls',
    };
  }

  try {
    const response = await fetch(originalUrl, {
      headers: getBrowserHeaders(parsedUrl.origin),
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;
    const finalUrl = new URL(response.url || originalUrl);
    const html = await response.text();

    // 1. Buscar stream directo en el HTML
    const directStream = findStreamInContent(html, finalUrl);
    if (directStream) {
      logger.info(`Extractor found stream in HTML: ${directStream.url}`);
      return {
        streamUrl: `/api/proxy/hls?url=${encodeURIComponent(directStream.url)}&referer=${encodeURIComponent(finalUrl.origin)}`,
        type: directStream.type,
      };
    }

    // 2. Buscar scripts ofuscados con Dean Edwards Packer (eval(function(p,a,c,k,e,d)...))
    const packerMatches = html.matchAll(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\(['"]\|['"]\)\)/g);
    for (const pMatch of packerMatches) {
      const unpacked = unpackPacker(pMatch[0]);
      if (unpacked) {
        const streamFromPacker = findStreamInContent(unpacked, finalUrl);
        if (streamFromPacker) {
          logger.info(`Extractor found stream inside unpacked JS: ${streamFromPacker.url}`);
          return {
            streamUrl: `/api/proxy/hls?url=${encodeURIComponent(streamFromPacker.url)}&referer=${encodeURIComponent(finalUrl.origin)}`,
            type: streamFromPacker.type,
          };
        }
      }
    }

    // 3. Inspeccionar iframes embebidos si es una página contenedora (Cuevana, Pelisplus, etc.)
    if (depth === 0) {
      const iframeMatches = html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi);
      for (const ifMatch of iframeMatches) {
        let iframeSrc = ifMatch[1]?.trim();
        if (!iframeSrc) continue;

        // Omitir iframes de anuncios o redes sociales comunes
        if (
          iframeSrc.includes('google') ||
          iframeSrc.includes('facebook') ||
          iframeSrc.includes('recaptcha') ||
          iframeSrc.includes('disqus')
        ) {
          continue;
        }

        if (iframeSrc.startsWith('//')) {
          iframeSrc = `${finalUrl.protocol}${iframeSrc}`;
        } else if (iframeSrc.startsWith('/')) {
          iframeSrc = new URL(iframeSrc, finalUrl).toString();
        }

        try {
          const parsedIframe = new URL(iframeSrc);
          logger.info(`Inspecting embedded iframe player: ${iframeSrc}`);
          const iframeResult = await extractGenericOrProxy(parsedIframe, iframeSrc, depth + 1);
          if (iframeResult) return iframeResult;
        } catch {
          // Ignorar URLs de iframe malformadas
        }
      }
    }
  } catch (err) {
    logger.debug(`Could not inspect HTML in generic extractor: ${err}`);
  }

  return null;
}


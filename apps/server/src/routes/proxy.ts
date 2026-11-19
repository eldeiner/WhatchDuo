import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../lib/http';
import { logger } from '../lib/logger';

export function proxyRouter(): Router {
  const router = Router();

  router.get(
    '/proxy/hls',
    asyncHandler(async (req: Request, res: Response) => {
      const targetUrl = typeof req.query.url === 'string' ? req.query.url : null;
      const referer = typeof req.query.referer === 'string' ? req.query.referer : undefined;

      if (!targetUrl) {
        res.status(400).json({ error: { message: 'Falta el parámetro url' } });
        return;
      }

      let parsedTarget: URL;
      try {
        parsedTarget = new URL(targetUrl);
      } catch {
        res.status(400).json({ error: { message: 'URL no válida' } });
        return;
      }

      if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
        res.status(400).json({ error: { message: 'Protocolo no permitido' } });
        return;
      }

      try {
        const headers: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: '*/*',
        };

        if (referer) {
          headers.Referer = referer;
          headers.Origin = new URL(referer).origin;
        }

        const upstreamResponse = await fetch(targetUrl, {
          headers,
          signal: AbortSignal.timeout(15000),
        });

        if (!upstreamResponse.ok) {
          res.status(upstreamResponse.status).send(await upstreamResponse.text());
          return;
        }

        const contentType = upstreamResponse.headers.get('content-type') || '';
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        const isPlaylist =
          targetUrl.includes('.m3u8') ||
          contentType.includes('mpegurl') ||
          contentType.includes('application/x-mpegURL');

        if (isPlaylist) {
          const playlistText = await upstreamResponse.text();
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

          // Reescribir las URIs relativas y absolutas para que pasen a través del proxy
          const baseUrl = new URL(targetUrl);
          const rewritten = playlistText
            .split('\n')
            .map((line) => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('#')) {
                // Reescribir URI dentro de etiquetas como #EXT-X-KEY:METHOD=...,URI="..."
                if (trimmed.includes('URI="')) {
                  return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
                    const resolved = new URL(uri, baseUrl).toString();
                    const proxyUri = `/api/proxy/hls?url=${encodeURIComponent(resolved)}${
                      referer ? `&referer=${encodeURIComponent(referer)}` : ''
                    }`;
                    return `URI="${proxyUri}"`;
                  });
                }
                return line;
              }

              // Línea de segmento o sub-playlist
              const resolvedSegment = new URL(trimmed, baseUrl).toString();
              return `/api/proxy/hls?url=${encodeURIComponent(resolvedSegment)}${
                referer ? `&referer=${encodeURIComponent(referer)}` : ''
              }`;
            })
            .join('\n');

          res.send(rewritten);
        } else {
          // Segmento de video (ej. .ts, .m4s) o archivo directo
          if (contentType) res.setHeader('Content-Type', contentType);
          const buffer = await upstreamResponse.arrayBuffer();
          res.send(Buffer.from(buffer));
        }
      } catch (err: unknown) {
        logger.warn(`Error en proxy HLS para ${targetUrl}: ${err}`);
        res.status(502).json({ error: { message: 'Error retransmitiendo recurso upstream' } });
      }
    }),
  );

  return router;
}

/* CineDúo Service Worker — cachea el shell y assets estáticos.
 * NUNCA cachea video (mp4/webm/m3u8) ni peticiones Range: el video se sirve
 * siempre por red para no romper el streaming ni la sincronización.
 */
const VERSION = 'cineduo-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_ASSETS = ['/', '/offline', '/manifest.webmanifest', '/icons/icon-192.png'];
const VIDEO_EXTENSIONS = /\.(mp4|webm|m3u8|ts|m4s|mpd)(\?|$)/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      /\.(css|js|woff2?|png|svg|webp|avif|jpg|jpeg)$/i.test(url.pathname))
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (VIDEO_EXTENSIONS.test(url.pathname) || request.headers.has('range')) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/');
          return cached ?? caches.match('/offline').then((r) => r ?? Response.error());
        }),
    );
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        });
      }),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

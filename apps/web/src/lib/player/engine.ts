'use client';

import Hls from 'hls.js';
import Player from '@vimeo/player';
import {
  parseVideoSource,
  videoEmbedUrl,
  type EmbeddedVideoSource,
  type VideoType,
} from '@cineduo/shared';
import { webrtcSession } from '../webrtc/streamer';

export type PlayerKind = 'native' | 'youtube' | 'vimeo' | 'webrtc';

export interface PlayerEngineCallbacks {
  onReady: (duration: number) => void;
  onTime: (current: number, duration: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onBuffering: (active: boolean) => void;
  onError: (message: string) => void;
}

export interface PlayerEngine {
  readonly kind: PlayerKind;
  currentTime(): number;
  duration(): number;
  paused(): boolean;
  /** Equivalente a `HTMLMediaElement.readyState` (0–4). */
  readyState(): number;
  isSeeking(): boolean;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setRate(rate: number): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

export interface CreateEngineOptions {
  url: string;
  type: VideoType;
  callbacks: PlayerEngineCallbacks;
  /** Contenedor para los reproductores incrustados; ignorado en nativo. */
  container: HTMLElement | null;
  /** Elemento `<video>` ya montado para archivos directos. */
  video: HTMLVideoElement | null;
}

const NOOP = () => undefined;

export function createPlayerEngine(options: CreateEngineOptions): Promise<PlayerEngine> {
  const { type, callbacks } = options;

  if (type === 'webrtc' || options.url === 'webrtc:tab') {
    return Promise.resolve(createWebRtcEngine(options));
  }

  if (type === 'youtube' || type === 'vimeo') {
    const container = options.container;
    const source = parseVideoSource(options.url);
    if (!container || !source || (source.type !== 'youtube' && source.type !== 'vimeo')) {
      const message = 'No se pudo reconocer el enlace del video. Vuelve a cargarlo.';
      callbacks.onError(message);
      return Promise.resolve(createBrokenEngine(callbacks, message));
    }
    return createEmbeddedEngine(source, container, callbacks);
  }

  return Promise.resolve(createNativeEngine(options));
}

/* ------------------------------------------------------------------ */
/* Transmisión WebRTC (Pantalla / Pestaña en Vivo)                     */
/* ------------------------------------------------------------------ */

function createWebRtcEngine({ callbacks, video }: CreateEngineOptions): PlayerEngine {
  if (!video) {
    callbacks.onError('No se pudo inicializar el reproductor WebRTC.');
    return createBrokenEngine(callbacks, 'No se pudo inicializar el reproductor WebRTC.');
  }

  let destroyed = false;

  const onLoadedMetadata = () => {
    if (destroyed) return;
    callbacks.onReady(video.duration || 0);
  };
  const onPlay = () => {
    if (!destroyed) callbacks.onPlay();
  };
  const onPause = () => {
    if (!destroyed) callbacks.onPause();
  };

  video.addEventListener('loadedmetadata', onLoadedMetadata);
  video.addEventListener('play', onPlay);
  video.addEventListener('pause', onPause);

  const applyStream = (stream: MediaStream | null) => {
    if (destroyed) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {
        // Puede requerir gesto del usuario
      });
      callbacks.onReady(0);
      callbacks.onPlay();
    } else {
      video.srcObject = null;
    }
  };

  const isBroadcaster = webrtcSession.isHostingStream();
  if (isBroadcaster) {
    const local = webrtcSession.getLocalStream();
    if (local) applyStream(local);
  } else {
    const remote = webrtcSession.getRemoteStream();
    if (remote) applyStream(remote);
  }

  const unsubscribe = webrtcSession.subscribeRemoteStream((stream) => {
    if (!webrtcSession.isHostingStream()) {
      applyStream(stream);
    }
  });

  return {
    kind: 'webrtc',
    currentTime: () => video.currentTime || 0,
    duration: () => 0,
    paused: () => video.paused,
    readyState: () => video.readyState,
    isSeeking: () => false,
    play: () => {
      video.play().catch(NOOP);
    },
    pause: () => {
      video.pause();
    },
    seek: NOOP,
    setRate: NOOP,
    setMuted: (muted) => {
      video.muted = muted;
    },
    destroy: () => {
      destroyed = true;
      unsubscribe();
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.srcObject = null;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Archivos directos (MP4 / WebM / HLS)                                */
/* ------------------------------------------------------------------ */

function createNativeEngine({ url, type, callbacks, video }: CreateEngineOptions): PlayerEngine {
  if (!video) {
    callbacks.onError('No se pudo preparar el reproductor.');
    return createBrokenEngine(callbacks, 'No se pudo preparar el reproductor.');
  }

  let hls: Hls | null = null;
  let destroyed = false;

  const emitTime = () => {
    if (destroyed) return;
    callbacks.onTime(video.currentTime || 0, Number.isFinite(video.duration) ? video.duration : 0);
  };

  const onLoadedMetadata = () => {
    if (destroyed) return;
    callbacks.onReady(Number.isFinite(video.duration) ? video.duration : 0);
    emitTime();
  };
  const onPlay = () => {
    if (!destroyed) callbacks.onPlay();
  };
  const onPause = () => {
    if (!destroyed) callbacks.onPause();
  };
  const onWaiting = () => {
    if (!destroyed) callbacks.onBuffering(true);
  };
  const onPlaying = () => {
    if (!destroyed) callbacks.onBuffering(false);
  };
  const onEnded = () => {
    if (!destroyed) callbacks.onEnded();
  };
  const onError = () => {
    if (destroyed) return;
    const code = video.error?.code;
    callbacks.onError(
      code === 4
        ? 'La fuente no es un video compatible. Usa YouTube, Vimeo o una URL directa a MP4, WebM o HLS (.m3u8).'
        : 'No se pudo cargar el video. Comprueba la URL, que el archivo exista y que su servidor permita CORS.',
    );
  };

  video.addEventListener('loadedmetadata', onLoadedMetadata);
  video.addEventListener('timeupdate', emitTime);
  video.addEventListener('play', onPlay);
  video.addEventListener('pause', onPause);
  video.addEventListener('waiting', onWaiting);
  video.addEventListener('playing', onPlaying);
  video.addEventListener('ended', onEnded);
  video.addEventListener('error', onError);

  if (type === 'hls') {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || destroyed || !hls) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          callbacks.onError(
            'No se pudo cargar el stream HLS. Comprueba la URL o el CORS del servidor.',
          );
        }
      });
    } else {
      callbacks.onError('Tu navegador no soporta HLS.');
    }
  } else {
    video.src = url;
  }

  video.load();

  return {
    kind: 'native',
    currentTime: () => video.currentTime || 0,
    duration: () => (Number.isFinite(video.duration) ? video.duration : 0),
    paused: () => video.paused,
    readyState: () => video.readyState,
    isSeeking: () => video.seeking,
    play: () => {
      const promise = video.play();
      if (promise) promise.catch(NOOP);
    },
    pause: () => video.pause(),
    seek: (seconds) => {
      try {
        video.currentTime = seconds;
      } catch {
        /* posición aún no buscable */
      }
    },
    setRate: (rate) => {
      video.playbackRate = rate;
    },
    setMuted: (muted) => {
      video.muted = muted;
    },
    destroy: () => {
      destroyed = true;
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', emitTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      if (hls) hls.destroy();
      video.removeAttribute('src');
      video.load();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Reproductores incrustados                                           */
/* ------------------------------------------------------------------ */

function createEmbeddedEngine(
  source: EmbeddedVideoSource,
  container: HTMLElement,
  callbacks: PlayerEngineCallbacks,
): Promise<PlayerEngine> {
  return source.type === 'youtube'
    ? createYouTubeEngine(source, container, callbacks)
    : createVimeoEngine(source, container, callbacks);
}

function createBrokenEngine(callbacks: PlayerEngineCallbacks, message: string): PlayerEngine {
  return {
    kind: 'native',
    currentTime: () => 0,
    duration: () => 0,
    paused: () => true,
    readyState: () => 0,
    isSeeking: () => false,
    play: () => callbacks.onError(message),
    pause: NOOP,
    seek: NOOP,
    setRate: NOOP,
    setMuted: NOOP,
    destroy: NOOP,
  };
}

/* ------------------------------- YouTube ------------------------------ */

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  destroy(): void;
}

interface YTNamespace {
  Player: new (element: HTMLElement | string, options: Record<string, unknown>) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube solo está disponible en el navegador.'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
    };

    const fail = () => {
      youtubeApiPromise = null;
      reject(new Error('No se pudo cargar el reproductor de YouTube. Revisa tu conexión.'));
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = fail;
      document.head.appendChild(script);
    }

    window.setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
    }, 50);
  });

  return youtubeApiPromise;
}

const YOUTUBE_ERRORS: Record<number, string> = {
  2: 'El enlace de YouTube no es válido.',
  5: 'El reproductor HTML5 de YouTube no está disponible en este navegador.',
  100: 'El video de YouTube no existe, es privado o fue eliminado.',
  101: 'El propietario no permite reproducir este video fuera de YouTube.',
  150: 'El propietario no permite reproducir este video fuera de YouTube.',
};

function createYouTubeEngine(
  source: EmbeddedVideoSource,
  container: HTMLElement,
  callbacks: PlayerEngineCallbacks,
): Promise<PlayerEngine> {
  return loadYouTubeApi().then(
    (api) =>
      new Promise<PlayerEngine>((resolve, reject) => {
        let destroyed = false;
        let ready = false;
        let seeking = false;
        let timer: number | null = null;

        const mount = document.createElement('div');
        mount.className = 'h-full w-full';
        container.appendChild(mount);

        const player = new api.Player(mount, {
          videoId: source.videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (destroyed) return;
              ready = true;
              callbacks.onReady(player.getDuration() || 0);
              timer = window.setInterval(() => {
                if (destroyed) return;
                callbacks.onTime(player.getCurrentTime() || 0, player.getDuration() || 0);
              }, 500);
              resolve(engine);
            },
            onStateChange: (event: { data: number }) => {
              if (destroyed) return;
              if (event.data === 1) {
                seeking = false;
                callbacks.onBuffering(false);
                callbacks.onPlay();
              } else if (event.data === 2) {
                callbacks.onPause();
              } else if (event.data === 0) {
                callbacks.onPause();
                callbacks.onEnded();
              } else if (event.data === 3) {
                callbacks.onBuffering(true);
              }
            },
            onError: (event: { data: number }) => {
              if (destroyed) return;
              callbacks.onError(
                YOUTUBE_ERRORS[event.data] ?? 'YouTube no pudo reproducir este video.',
              );
            },
          },
        });

        const engine: PlayerEngine = {
          kind: 'youtube',
          currentTime: () => player.getCurrentTime() || 0,
          duration: () => player.getDuration() || 0,
          paused: () => player.getPlayerState() !== 1,
          readyState: () => {
            if (!ready) return 0;
            return player.getPlayerState() === 3 ? 2 : 4;
          },
          isSeeking: () => seeking,
          play: () => {
            try {
              player.playVideo();
            } catch {
              /* el player aún no está listo */
            }
          },
          pause: () => {
            try {
              player.pauseVideo();
            } catch {
              /* noop */
            }
          },
          seek: (seconds) => {
            seeking = true;
            try {
              player.seekTo(seconds, true);
            } catch {
              /* noop */
            }
            window.setTimeout(() => {
              seeking = false;
            }, 400);
          },
          setRate: (rate) => {
            try {
              player.setPlaybackRate(rate);
            } catch {
              /* noop */
            }
          },
          setMuted: (muted) => {
            try {
              if (muted) player.mute();
              else player.unMute();
            } catch {
              /* noop */
            }
          },
          destroy: () => {
            destroyed = true;
            if (timer) window.clearInterval(timer);
            try {
              player.destroy();
            } catch {
              /* noop */
            }
            mount.remove();
          },
        };

        window.setTimeout(() => {
          if (!ready && !destroyed) {
            reject(new Error('YouTube tardó demasiado en cargar el video.'));
          }
        }, 15_000);
      }),
  );
}

/* -------------------------------- Vimeo ------------------------------- */

function createVimeoEngine(
  source: EmbeddedVideoSource,
  container: HTMLElement,
  callbacks: PlayerEngineCallbacks,
): Promise<PlayerEngine> {
  const iframe = document.createElement('iframe');
  const params = new URLSearchParams({
    autoplay: '0',
    controls: '0',
    title: '0',
    byline: '0',
    portrait: '0',
    dnt: '1',
  });
  iframe.src = `${videoEmbedUrl(source)}&${params.toString()}`;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  iframe.title = 'Video de Vimeo';
  iframe.className = 'h-full w-full';
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  container.appendChild(iframe);

  const player = new Player(iframe);

  let destroyed = false;
  let ready = false;
  let paused = true;
  let buffering = false;
  let duration = 0;
  let rate = 1;
  let lastTime = 0;
  let lastTimeAt = performance.now();

  const syncClock = () => {
    lastTime = 0;
    lastTimeAt = performance.now();
    void player
      .getCurrentTime()
      .then((time) => {
        if (destroyed) return;
        lastTime = time;
        lastTimeAt = performance.now();
        callbacks.onTime(time, duration);
      })
      .catch(NOOP);
  };

  const engine: PlayerEngine = {
    kind: 'vimeo',
    currentTime: () => {
      if (paused) return lastTime;
      return lastTime + ((performance.now() - lastTimeAt) / 1000) * rate;
    },
    duration: () => duration,
    paused: () => paused,
    readyState: () => (ready ? (buffering ? 2 : 4) : 0),
    isSeeking: () => false,
    play: () => {
      console.log('[vimeo] play() engine, paused =', paused, 'ready =', ready);
      player
        .play()
        .then(() => console.log('[vimeo] play resolved, paused =', paused))
        .catch((error: Error & { name?: string }) => {
          console.warn('[vimeo] play failed', error?.name, error?.message);
          if (error?.name === 'NotAllowedError') callbacks.onBuffering(false);
        });
    },
    pause: () => {
      console.log('[vimeo] pause() engine');
      player.pause().catch(NOOP);
    },
    seek: (seconds) => {
      lastTime = seconds;
      lastTimeAt = performance.now();
      player.setCurrentTime(seconds).catch(NOOP);
    },
    setRate: (value) => {
      rate = value;
      player.setPlaybackRate(value).catch(NOOP);
    },
    setMuted: (muted) => {
      player.setMuted(muted).catch(NOOP);
    },
    destroy: () => {
      destroyed = true;
      player.destroy().catch(NOOP);
      iframe.remove();
    },
  };

  player.on('play', () => {
    console.log('[vimeo] event play');
    if (destroyed) return;
    paused = false;
    syncClock();
    callbacks.onPlay();
  });

  player.on('pause', () => {
    if (destroyed) return;
    paused = true;
    void player.getCurrentTime().then((time) => {
      lastTime = time;
      lastTimeAt = performance.now();
    });
    callbacks.onPause();
  });

  player.on('ended', () => {
    if (destroyed) return;
    paused = true;
    callbacks.onPause();
    callbacks.onEnded();
  });

  player.on('timeupdate', ({ seconds, duration: total }: { seconds: number; duration: number }) => {
    if (destroyed) return;
    lastTime = seconds;
    lastTimeAt = performance.now();
    if (total > 0) duration = total;
    callbacks.onTime(seconds, duration);
  });

  player.on('bufferstart', () => {
    if (destroyed) return;
    buffering = true;
    callbacks.onBuffering(true);
  });

  player.on('bufferend', () => {
    if (destroyed) return;
    buffering = false;
    callbacks.onBuffering(false);
  });

  player.on('error', () => {
    if (destroyed) return;
    callbacks.onError(
      'Vimeo no pudo reproducir este video. Comprueba que sea público o que el enlace incluya su hash.',
    );
  });

  return player
    .ready()
    .then(() => Promise.all([player.getDuration(), player.getPaused()]))
    .then(
      ([total, isPaused]) =>
        new Promise<PlayerEngine>((resolve, reject) => {
          if (destroyed) {
            reject(new Error('Reproductor cerrado'));
            return;
          }
          ready = true;
          duration = total || 0;
          paused = isPaused;
          console.log('[vimeo] ready', { total, isPaused });
          syncClock();
          callbacks.onReady(duration);
          resolve(engine);
        }),
    )
    .catch((error: Error) => {
      if (!destroyed) {
        callbacks.onError(
          error?.message?.includes('private')
            ? 'El video de Vimeo es privado o no permite incrustarse.'
            : 'No se pudo cargar el video de Vimeo.',
        );
      }
      throw error;
    });
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SYNC,
  clampPosition,
  decideCorrection,
  expectedPosition,
  type PlaybackState,
  type PlaybackRate,
} from '@cineduo/shared';
import { clock } from '@/lib/clock';
import { createPlayerEngine, type PlayerEngine, type PlayerEngineCallbacks } from '@/lib/player/engine';
import { selectIsHost, useRoomStore } from '@/lib/store';
import {
  hostPause,
  hostPlay,
  hostSeek,
  hostSetRate,
  requestControl,
  sendBuffering,
  sendHeartbeat,
} from '@/lib/actions';
import { SeekBar } from './SeekBar';
import { SyncBadge } from './SyncBadge';
import {
  Play,
  Pause,
  SpeakerHigh,
  SpeakerSimpleSlash,
  CornersOut,
  CornersIn,
  Crown,
  ArrowClockwise,
  ArrowCounterClockwise,
  FilmReel,
  Sparkle,
  CircleNotch,
} from '@phosphor-icons/react';
import { MagneticButton } from '@/components/ui/MagneticButton';

const RATES = [0.75, 1, 1.25, 1.5] as const;

interface VideoStageProps {
  onOpenSource: () => void;
}

export function VideoStage({ onOpenSource }: VideoStageProps) {
  const playback = useRoomStore((s) => s.playback);
  const isHost = useRoomStore(selectIsHost);
  const connection = useRoomStore((s) => s.connection);
  const needsGesture = useRoomStore((s) => s.needsGesture);
  const setNeedsGesture = useRoomStore((s) => s.setNeedsGesture);
  const setSyncStatus = useRoomStore((s) => s.setSyncStatus);
  const controlRequestSent = useRoomStore((s) => s.controlRequestSent);
  const participants = useRoomStore((s) => s.participants);

  const videoRef = useRef<HTMLVideoElement>(null);
  const embedMountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlayerEngine | null>(null);
  const nudgeTimer = useRef<number | null>(null);
  const autoplayTimer = useRef<number | null>(null);
  const bufferingSent = useRef(false);

  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const playbackRef = useRef<PlaybackState | null>(playback);
  playbackRef.current = playback;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const isEmbed = playback?.videoType === 'youtube' || playback?.videoType === 'vimeo';
  const isWebRtc = playback?.videoType === 'webrtc' || playback?.videoUrl === 'webrtc:tab';
  const host = playback ? participants.find((p) => p.id === playback.hostId) : undefined;
  const hostDisconnected = Boolean(host && !host.isConnected);
  const canCommand = isHost && connection === 'connected' && !isWebRtc;

  const reportBuffering = useCallback((value: boolean) => {
    if (bufferingSent.current === value) return;
    bufferingSent.current = value;
    sendBuffering(value);
  }, []);

  const attemptPlay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.play();

    if (autoplayTimer.current) window.clearTimeout(autoplayTimer.current);
    autoplayTimer.current = window.setTimeout(() => {
      const first = engineRef.current;
      if (!first || !playbackRef.current?.isPlaying || !first.paused()) return;

      first.setMuted(true);
      setMuted(true);
      setAutoplayMuted(true);
      first.play();

      window.setTimeout(() => {
        const retry = engineRef.current;
        if (retry && playbackRef.current?.isPlaying && retry.paused()) {
          useRoomStore.getState().setNeedsGesture(true);
        }
      }, 1400);
    }, 1200);
  }, []);

  const nudgeRate = useCallback((rate: number, baseRate: number, revertAfterMs: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setRate(rate);
    if (nudgeTimer.current) window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => {
      nudgeTimer.current = null;
      engineRef.current?.setRate(baseRate);
    }, revertAfterMs);
  }, []);

  const syncToRoom = useCallback(
    (targetState: PlaybackState) => {
      const engine = engineRef.current;
      if (!engine) return;

      const durationSec = engine.duration() || 0;
      const targetPos = clampPosition(
        expectedPosition(targetState, clock.now()),
        durationSec || undefined
      );
      const currentPos = engine.currentTime();
      const baseRate = targetState.playbackRate as PlaybackRate;

      if (!targetState.isPlaying) {
        if (!engine.paused()) engine.pause();
        const drift = Math.abs(currentPos - targetPos);
        if (drift > 0.25) {
          engine.seek(targetPos);
          setCurrent(targetPos);
        }
        setSyncStatus('paused');
        return;
      }

      const decision = decideCorrection({
        drift: currentPos - targetPos,
        isPlaying: targetState.isPlaying,
        baseRate,
        expected: targetPos,
      });

      switch (decision.kind) {
        case 'none':
          setSyncStatus('synced');
          if (engine.paused()) attemptPlay();
          break;
        case 'rate':
          setSyncStatus('correcting');
          nudgeRate(decision.rate, baseRate, decision.revertAfterMs);
          if (engine.paused()) attemptPlay();
          break;
        case 'seek':
          setSyncStatus('correcting');
          engine.seek(decision.to);
          engine.setRate(baseRate);
          setCurrent(decision.to);
          if (engine.paused()) attemptPlay();
          break;
      }
    },
    [attemptPlay, nudgeRate, setSyncStatus]
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const videoUrl = playback?.videoUrl;
    const videoType = playback?.videoType;
    if (!videoUrl || !videoType) {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      setReady(false);
      setDuration(0);
      setCurrent(0);
      return;
    }

    setReady(false);
    setMediaError(null);

    let active = true;

    const callbacks: PlayerEngineCallbacks = {
      onReady: (d: number) => {
        if (!active) return;
        setReady(true);
        setDuration(d);
        if (playbackRef.current) syncToRoom(playbackRef.current);
      },
      onTime: (curr: number, dur: number) => {
        if (!active) return;
        setCurrent(curr);
        if (dur > 0) setDuration(dur);
      },
      onPlay: () => {},
      onPause: () => {},
      onEnded: () => {},
      onBuffering: (isBuffering: boolean) => {
        if (active) reportBuffering(isBuffering);
      },
      onError: (err: string) => {
        if (active) setMediaError(err);
      },
    };

    createPlayerEngine({
      url: videoUrl,
      type: videoType,
      callbacks,
      container: embedMountRef.current,
      video: videoRef.current,
    })
      .then((engine) => {
        if (!active) {
          engine.destroy();
          return;
        }
        engineRef.current = engine;
      })
      .catch((err) => {
        if (active) {
          setMediaError(err instanceof Error ? err.message : 'Error al inicializar el reproductor.');
        }
      });

    return () => {
      active = false;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [playback?.videoUrl, playback?.videoType, reportBuffering, syncToRoom]);

  useEffect(() => {
    if (!ready || !playback) return;
    syncToRoom(playback);
  }, [playback, ready, syncToRoom]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine || !ready) return;
      const currentPos = engine.currentTime();
      setCurrent(currentPos);
      if (isHostRef.current && playbackRef.current?.isPlaying) {
        sendHeartbeat({
          position: currentPos,
          isPlaying: playbackRef.current.isPlaying,
          clientTime: clock.now(),
        });
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [ready]);

  const handleTogglePlay = () => {
    if (!canCommand) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.paused()) {
      engine.play();
      hostPlay(engine.currentTime());
    } else {
      engine.pause();
      hostPause(engine.currentTime());
    }
  };

  const handleSeek = (position: number) => {
    if (!canCommand) return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.seek(clampPosition(position, engine.duration() || undefined));
    setCurrent(position);
    hostSeek(position);
  };

  const handleJump = (deltaSeconds: number) => {
    if (!canCommand) return;
    const engine = engineRef.current;
    if (!engine) return;
    const next = clampPosition(engine.currentTime() + deltaSeconds, engine.duration() || undefined);
    engine.seek(next);
    setCurrent(next);
    hostSeek(next);
  };

  const handleRate = (rate: (typeof RATES)[number]) => {
    if (!canCommand) return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.setRate(rate);
    hostSetRate(rate, engine.currentTime());
  };

  const toggleMute = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !muted;
    setMuted(next);
    setAutoplayMuted(false);
    engine.setMuted(next);
  };

  const toggleFullscreen = async () => {
    const element = containerRef.current;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (element?.requestFullscreen) {
        await element.requestFullscreen();
      }
    } catch {
      /* fallback */
    }
  };

  const unlockPlayback = () => {
    const engine = engineRef.current;
    const state = playbackRef.current;
    setNeedsGesture(false);
    setAutoplayMuted(false);
    if (!engine) return;
    if (state) {
      engine.seek(clampPosition(expectedPosition(state, clock.now()), engine.duration() || undefined));
    }
    engine.setMuted(false);
    setMuted(false);
    engine.play();
  };

  const effectiveRate = playback?.playbackRate ?? 1;
  const isPlaying = Boolean(playback?.isPlaying);

  if (!playback?.videoUrl) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 px-6 text-center bg-slate-900 dark:bg-[#07080b]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-sky-400">
          <FilmReel size={32} weight="duotone" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">
            {isHost ? 'Selecciona una fuente de video' : 'Esperando al anfitrión'}
          </h3>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-400">
            {isHost
              ? 'YouTube, Vimeo, enlaces directos MP4/HLS o transmisión WebRTC de pestaña.'
              : 'En cuanto el host cargue el video, comenzará en perfecta sincronía.'}
          </p>
        </div>
        {isHost ? (
          <MagneticButton
            variant="primary"
            onClick={onOpenSource}
            className="mt-2 text-xs font-bold gap-2"
          >
            <Sparkle size={16} weight="fill" />
            Cargar Video
          </MagneticButton>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-zinc-400">
            <CircleNotch size={14} className="animate-spin text-sky-400" />
            <span>Esperando reproducción...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-black">
      {/* Video Screen Container */}
      <div ref={containerRef} className="relative aspect-video w-full bg-black overflow-hidden group">
        {isEmbed ? (
          <div
            ref={embedMountRef}
            className="pointer-events-none absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
          />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full bg-black object-contain"
            playsInline
            preload="metadata"
          />
        )}

        {/* Video Overlay Badges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
          <SyncBadge />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-medium text-zinc-200 backdrop-blur-md">
            <Crown size={14} weight="fill" className={isHost ? 'text-sky-400' : 'text-zinc-500'} />
            {isHost ? 'Tú controlas' : host ? `Host: ${host.nickname}` : 'Espectador'}
          </span>
        </div>

        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <CircleNotch size={36} className="animate-spin text-sky-400" />
          </div>
        )}

        {needsGesture && (
          <button
            type="button"
            onClick={unlockPlayback}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/75 backdrop-blur-sm"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-400 text-slate-950 shadow-2xl shadow-sky-500/40 hover:scale-105 transition-transform">
              <Play size={32} weight="fill" className="ml-1" />
            </div>
            <span className="text-sm font-bold text-white">Toca para reproducir con audio</span>
          </button>
        )}

        {autoplayMuted && !needsGesture && (
          <button
            type="button"
            onClick={() => {
              const eng = engineRef.current;
              if (eng) {
                eng.setMuted(false);
                setMuted(false);
                setAutoplayMuted(false);
              }
            }}
            className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-xl border border-white/15 bg-black/80 px-3.5 py-2 text-xs font-semibold text-zinc-100 backdrop-blur-md hover:bg-black"
          >
            <SpeakerSimpleSlash size={16} className="text-sky-400" />
            <span>Activar sonido</span>
          </button>
        )}

        {mediaError && (
          <div className="absolute inset-x-4 bottom-4 z-20 rounded-xl border border-rose-500/30 bg-[#0e0f14]/95 px-4 py-3 text-xs text-rose-300">
            {mediaError}
          </div>
        )}
      </div>

      {/* Cinematic Control Bar (Rare UI / Modern Anti-Slop Layout) */}
      <div className="w-full border-t border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-[#090a0f] p-4 transition-colors">
        {/* Timeline Range */}
        <SeekBar
          current={current}
          duration={duration}
          disabled={!canCommand}
          onCommit={handleSeek}
        />

        {/* Buttons Row */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={!canCommand}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400 text-slate-950 font-bold transition-all hover:bg-sky-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40 shadow-md shadow-sky-400/20"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" className="ml-0.5" />}
            </button>

            {/* Jump -10s */}
            <button
              type="button"
              onClick={() => handleJump(-10)}
              disabled={!canCommand}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-sky-600 dark:hover:text-white disabled:opacity-40"
              title="Retroceder 10 segundos"
            >
              <ArrowCounterClockwise size={18} />
            </button>

            {/* Jump +10s */}
            <button
              type="button"
              onClick={() => handleJump(10)}
              disabled={!canCommand}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-sky-600 dark:hover:text-white disabled:opacity-40"
              title="Adelantar 10 segundos"
            >
              <ArrowClockwise size={18} />
            </button>

            {/* Mute/Unmute */}
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-sky-600 dark:hover:text-white"
              title={muted ? 'Activar sonido' : 'Silenciar'}
            >
              {muted ? <SpeakerSimpleSlash size={18} /> : <SpeakerHigh size={18} />}
            </button>
          </div>

          {/* Rates and Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white/70 dark:bg-black/40 p-1">
              {RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleRate(rate)}
                  disabled={!canCommand}
                  className={`h-7 px-2.5 rounded-lg text-xs font-mono font-medium transition-colors disabled:opacity-40 ${
                    effectiveRate === rate
                      ? 'bg-sky-400 text-slate-950 font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-white'
                  }`}
                >
                  {rate}×
                </button>
              ))}
            </div>

            {/* Request Control if not host */}
            {!isHost && (
              <button
                type="button"
                disabled={controlRequestSent || hostDisconnected || connection !== 'connected'}
                onClick={() => void requestControl()}
                className="flex items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-600 dark:text-sky-300 hover:bg-sky-400/20 disabled:opacity-50"
              >
                <Crown size={14} />
                <span>{controlRequestSent ? 'Solicitado' : 'Pedir mando'}</span>
              </button>
            )}

            {/* Change Source if host */}
            {isHost && (
              <button
                type="button"
                onClick={onOpenSource}
                className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.08]"
              >
                <FilmReel size={15} />
                <span>Cambiar video</span>
              </button>
            )}

            {/* Fullscreen */}
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-sky-600 dark:hover:text-white"
              title="Pantalla completa"
            >
              {isFullscreen ? <CornersIn size={18} /> : <CornersOut size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

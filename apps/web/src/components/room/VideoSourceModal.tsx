'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { videoUrlError } from '@cineduo/shared';
import { useRoomStore } from '@/lib/store';
import { hostSetVideo } from '@/lib/actions';
import { webrtcSession } from '@/lib/webrtc/streamer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { FilmIcon, ScreenShareIcon } from '../icons';

interface VideoSourceModalProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  {
    label: 'Video de ejemplo (MP4)',
    url: '/videos/demo.mp4',
    hint: 'Incluido en la app para probar la sincronía.',
  },
  {
    label: 'YouTube (Big Buck Bunny)',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    hint: 'Se reproduce con el reproductor oficial de YouTube.',
  },
  {
    label: 'Stream HLS de prueba',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    hint: 'Requiere conexión a internet y CORS abierto.',
  },
] as const;

export function VideoSourceModal({ open, onClose }: VideoSourceModalProps) {
  const currentUrl = useRoomStore((s) => s.playback?.videoUrl ?? '');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl(currentUrl);
      setError(null);
    }
  }, [open, currentUrl]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = url.trim();
    if (!value || busy) return;

    const urlError = videoUrlError(value);
    if (urlError) {
      setError(urlError);
      return;
    }

    setError(null);
    setBusy(true);
    const ok = await hostSetVideo(value);
    setBusy(false);
    if (ok) onClose();
  };

  const handleStartTabShare = async () => {
    try {
      setError(null);
      setBusy(true);
      await webrtcSession.startTabShare();
      const ok = await hostSetVideo('webrtc:tab');
      setBusy(false);
      if (ok) onClose();
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Error al compartir pestaña';
      setError(msg);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Fuente del video"
      description="Pega un enlace de YouTube, Vimeo o una URL directa a MP4, WebM o HLS (.m3u8). Todos verán lo mismo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="marquee"
            type="submit"
            form="video-source-form"
            loading={busy}
            disabled={!url.trim()}
          >
            Cargar video
          </Button>
        </>
      }
    >
      <form id="video-source-form" onSubmit={submit} className="space-y-4">
        <Input
          label="URL del video"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError(null);
          }}
          inputMode="url"
          autoFocus
          placeholder="https://www.youtube.com/watch?v=..."
          error={error ?? undefined}
          hint="YouTube y Vimeo se incrustan; los archivos directos deben permitir CORS."
        />

        <div className="rounded-xl border border-marquee-400/20 bg-marquee-400/[0.05] p-3 text-left">
          <div className="flex items-start gap-3">
            <ScreenShareIcon className="mt-0.5 h-5 w-5 shrink-0 text-marquee-300" />
            <div className="space-y-1">
              <span className="block text-xs font-semibold text-mist-100">
                Opción 1 Universal: Retransmitir Pestaña (WebRTC)
              </span>
              <p className="text-[11px] leading-relaxed text-mist-400">
                Ideal para páginas protegidas con Cloudflare (como playmogo), pelisplus u otros reproductores externos. Abre el video en una pestaña y compártela directamente con audio.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 text-xs"
                onClick={handleStartTabShare}
                loading={busy}
              >
                Retransmitir Pestaña de Navegador
              </Button>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mist-500">
            Atajos
          </p>
          <div className="space-y-1.5">
            {SUGGESTIONS.map((item) => (
              <button
                key={item.url}
                type="button"
                onClick={() => setUrl(item.url)}
                className="flex w-full items-start gap-2.5 rounded-xl border border-white/[0.06] bg-ink-900/60 px-3 py-2 text-left transition hover:border-marquee-400/30 hover:bg-marquee-400/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marquee-400"
              >
                <FilmIcon className="mt-0.5 h-4 w-4 shrink-0 text-marquee-300" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-mist-200">{item.label}</span>
                  <span className="block truncate text-[11px] text-mist-500">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="rounded-xl border border-white/[0.06] bg-ink-900/40 p-2.5 text-[11px] leading-relaxed text-mist-500">
          Usa únicamente contenido propio, libre o autorizado. CineDúo no elude DRM ni reproduce
          catálogos protegidos de plataformas de streaming.
        </p>
      </form>
    </Modal>
  );
}

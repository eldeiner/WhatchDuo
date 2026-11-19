'use client';

import { useEffect } from 'react';
import { useRoomStore } from '@/lib/store';
import { CloseIcon, InfoIcon } from './icons';

/** Aviso flotante para errores no fatales (rate limit, permisos, red…). */
export function Toast() {
  const error = useRoomStore((s) => s.error);
  const setError = useRoomStore((s) => s.setError);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [error, setError]);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md animate-fade-up items-start gap-3 rounded-xl border border-rose-500/30 bg-ink-850/95 px-3.5 py-3 text-sm text-mist-100 shadow-panel backdrop-blur-md sm:bottom-5 sm:left-auto sm:right-5 sm:mx-0"
    >
      <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      <p className="flex-1 leading-snug">{error}</p>
      <button
        type="button"
        onClick={() => setError(null)}
        aria-label="Cerrar aviso"
        className="rounded p-1 text-mist-500 hover:text-mist-200"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

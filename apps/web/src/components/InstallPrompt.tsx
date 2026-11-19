'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { DownloadIcon, CloseIcon } from './icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'cineduo:install-dismissed';

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setStandalone(media.matches || nav.standalone === true);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === '1');

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (standalone || dismissed) return null;
  if (!deferred && !isIos) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') dismiss();
    setDeferred(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md animate-fade-up rounded-2xl border border-marquee-400/25 bg-ink-850/95 p-3.5 shadow-panel backdrop-blur-md sm:left-auto sm:right-5 sm:mx-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-marquee-400/15 text-marquee-300">
          <DownloadIcon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-mist-100">Instala CineDúo en tu móvil</p>
          <p className="mt-0.5 text-xs leading-relaxed text-mist-400">
            {deferred
              ? 'Pantalla completa, sin barra del navegador y acceso desde el inicio.'
              : 'En iPhone: toca Compartir y luego “Añadir a pantalla de inicio”.'}
          </p>
          {deferred ? (
            <Button size="sm" variant="marquee" className="mt-2.5" onClick={() => void install()}>
              Instalar app
            </Button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Descartar sugerencia de instalación"
          className="rounded-full p-1.5 text-mist-500 transition hover:bg-white/5 hover:text-mist-200"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

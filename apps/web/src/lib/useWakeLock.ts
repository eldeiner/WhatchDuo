'use client';

import { useEffect } from 'react';

interface WakeLockLike {
  release: () => Promise<void>;
}

interface WakeLockNavigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockLike>;
  };
}

/**
 * Mantiene la pantalla encendida mientras estás en una sala (API Screen Wake
 * Lock). Si el navegador no la soporta, no hace nada. Al volver de segundo
 * plano, el bloqueo se vuelve a pedir porque el sistema lo libera solo.
 */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return;

    const nav = navigator as Navigator & WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockLike | null = null;
    let disposed = false;

    const request = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      if (sentinel) return;
      try {
        sentinel = await nav.wakeLock!.request('screen');
      } catch {
        sentinel = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        void sentinel.release().catch(() => undefined);
        sentinel = null;
      }
    };
  }, [enabled]);
}

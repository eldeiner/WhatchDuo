'use client';

import { useRoomStore } from '@/lib/store';
import { WifiHigh, WifiSlash } from '@phosphor-icons/react';

export function SyncBadge() {
  const connection = useRoomStore((s) => s.connection);
  const syncStatus = useRoomStore((s) => s.syncStatus);

  if (connection === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
        <WifiSlash size={13} />
        Desconectado
      </span>
    );
  }

  if (connection === 'connecting' || connection === 'reconnecting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
        Sincronizando...
      </span>
    );
  }

  if (syncStatus === 'buffering' || syncStatus === 'correcting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Ajustando drift
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
      <WifiHigh size={13} weight="bold" />
      <span>Sincronizado</span>
    </span>
  );
}

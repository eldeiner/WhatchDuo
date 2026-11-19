'use client';

import { Brand } from '@/components/Brand';
import { SyncBadge } from './SyncBadge';
import { Copy, SignOut } from '@phosphor-icons/react';
import { useCopy } from '@/lib/useCopy';

interface RoomHeaderProps {
  code: string;
  onLeave: () => void;
}

export function RoomHeader({ code, onLeave }: RoomHeaderProps) {
  const [copied, copy] = useCopy();

  const handleCopyCode = () => {
    void copy(code);
  };

  return (
    <header className="relative z-30 flex h-16 w-full items-center justify-between border-b border-white/[0.08] bg-[#090a0f]/80 px-4 sm:px-6 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <Brand compact />
        <div className="h-4 w-px bg-white/10 hidden sm:block" />
        <div className="hidden items-center gap-2 sm:flex">
          <SyncBadge />
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-amber-400/40 hover:bg-white/[0.07] hover:text-white"
        >
          <span className="font-mono tracking-widest text-amber-400 font-bold">{code}</span>
          <Copy size={14} className={copied ? 'text-amber-400' : 'text-zinc-400'} />
          <span className="hidden md:inline">{copied ? '¡Copiado!' : 'Copiar'}</span>
        </button>

        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 hover:text-rose-200"
        >
          <SignOut size={15} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}

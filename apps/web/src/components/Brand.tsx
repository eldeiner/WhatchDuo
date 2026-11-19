'use client';

import React from 'react';
import Link from 'next/link';
import { FilmReel, Sparkle } from '@phosphor-icons/react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-3 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl"
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 font-black shadow-sm transition-transform duration-200 group-hover:scale-105">
        <FilmReel size={22} weight="fill" className="transition-transform group-hover:rotate-12" />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#090a0f] border border-amber-400/40">
          <Sparkle size={9} weight="fill" className="text-amber-300" />
        </span>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className="font-sans text-lg font-bold tracking-tight text-zinc-100">CineDúo</span>
          <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
            SYNC
          </span>
        </div>
        {!compact && (
          <span className="mt-1 text-[11px] font-medium tracking-wide text-zinc-500">
            Cine compartido en milisegundos
          </span>
        )}
      </div>
    </Link>
  );
}

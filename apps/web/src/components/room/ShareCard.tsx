'use client';

import { useEffect, useState } from 'react';
import { useCopy } from '@/lib/useCopy';
import { useRoomStore } from '@/lib/store';
import { Button } from '../ui/Button';
import { CheckIcon, CopyIcon, LinkIcon } from '../icons';

export function ShareCard({ code }: { code: string }) {
  const participants = useRoomStore((s) => s.participants);
  const [copied, copy] = useCopy();
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const joinUrl = `${origin}/room/${code}`;
  const connected = participants.filter((p) => p.isConnected).length;

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="eyebrow">Código de sala</p>
        <span className="text-[11px] text-mist-500">{connected} conectados</span>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4 pt-2 sm:flex-row sm:items-center">
        <p
          className="font-mono text-[2rem] font-medium leading-none tracking-[0.28em] text-marquee-200 sm:text-[2.2rem]"
          aria-label={`Código de sala ${code.split('').join(' ')}`}
        >
          {code}
        </p>
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <Button
            size="sm"
            variant="marquee"
            fullWidth
            onClick={() => void copy(joinUrl)}
            icon={copied ? <CheckIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
          >
            {copied ? '¡Copiado!' : 'Copiar enlace'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void copy(code)}
            aria-label="Copiar solo el código"
            className="shrink-0 px-3"
          >
            <CopyIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="border-t border-white/[0.05] px-4 py-2 text-[11px] text-mist-500">
        Comparte el enlace o dicta el código. Solo necesitan un apodo para entrar.
      </p>
    </div>
  );
}

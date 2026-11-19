'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import type { PublicRoomResponse } from '@cineduo/shared';
import { ApiError, joinRoomRequest } from '@/lib/api';
import { getStoredNickname, setRoomToken, setStoredNickname } from '@/lib/storage';
import { Brand } from '../Brand';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { FilmIcon, LinkIcon, LockIcon, UsersIcon } from '../icons';

interface JoinGateProps {
  code: string;
  room: PublicRoomResponse | null;
  loadError: string | null;
  initialError: string | null;
  onJoined: (token: string) => void;
}

export function JoinGate({ code, room, loadError, initialError, onJoined }: JoinGateProps) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNickname(getStoredNickname());
  }, []);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const connected = room?.participants.filter((participant) => participant.isConnected) ?? [];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError('Escribe un apodo de al menos 2 caracteres.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const response = await joinRoomRequest(code, trimmed);
      setStoredNickname(trimmed);
      setRoomToken(code, response.participantToken);
      onJoined(response.participantToken);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo entrar en la sala. Inténtalo de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-marquee-400/50 to-transparent"
      />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-[calc(1.1rem+env(safe-area-inset-top))] sm:px-8">
        <Brand />
        <Link
          href="/"
          className="rounded-lg px-3 py-2 text-sm text-mist-400 transition hover:text-mist-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marquee-400"
        >
          Inicio
        </Link>
      </header>

      <main
        id="contenido"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-10 sm:px-0"
      >
        <div className="panel relative overflow-hidden p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Te han invitado</p>
              <p className="mt-2 font-display text-3xl tracking-[0.18em] text-marquee-200">
                {code}
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-marquee-400/25 bg-marquee-400/10 text-marquee-300">
              <FilmIcon className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.05] bg-ink-900/60 p-3">
            {loadError ? (
              <p role="alert" className="text-sm leading-relaxed text-rose-300">
                {loadError}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-mist-400">
                <UsersIcon className="h-4 w-4 shrink-0 text-mist-500" />
                {room ? (
                  <span>
                    {connected.length > 0
                      ? `${connected.map((p) => p.nickname).join(' y ')} en la sala`
                      : 'Sala creada, esperando a que entre alguien'}
                  </span>
                ) : (
                  <span className="text-mist-500">Comprobando la sala…</span>
                )}
              </div>
            )}
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
            >
              {error}
            </p>
          ) : null}

          {loadError ? (
            <Link
              href="/"
              className="mt-5 flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-ink-800 text-sm font-medium text-mist-100 transition hover:bg-ink-700"
            >
              Volver al inicio
            </Link>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <Input
                label="Tu apodo"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={24}
                autoComplete="nickname"
                placeholder="Leo"
                required
                hint="Así te verán en el chat y en la sala."
              />
              <Button
                type="submit"
                variant="marquee"
                size="lg"
                fullWidth
                loading={loading}
                icon={<LinkIcon className="h-5 w-5" />}
              >
                Entrar en la sala
              </Button>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-mist-500">
                <LockIcon className="mt-0.5 h-3 w-3 shrink-0" />
                Sala privada por invitación. No hace falta cuenta: tu acceso queda guardado en este
                dispositivo.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

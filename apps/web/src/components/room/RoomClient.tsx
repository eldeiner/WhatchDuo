'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PublicRoomResponse } from '@cineduo/shared';
import { ApiError, getMessagesRequest, getRoomRequest } from '@/lib/api';
import { clearRoomToken, getRoomToken, participantIdFromToken, setRoomToken } from '@/lib/storage';
import { useRoomStore } from '@/lib/store';
import { RoomView } from './RoomView';
import { JoinGate } from './JoinGate';

interface RoomClientProps {
  code: string;
}

function RoomSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Cargando sala">
      <div className="border-b border-white/[0.06] bg-ink-950/85">
        <div className="mx-auto flex h-[60px] w-full max-w-[1500px] items-center gap-3 px-4">
          <span className="h-9 w-9 animate-pulse rounded-xl bg-white/[0.06]" />
          <span className="h-4 w-24 animate-pulse rounded bg-white/[0.05]" />
          <span className="ml-auto h-9 w-24 animate-pulse rounded-xl bg-white/[0.05]" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-[1500px] gap-3 px-3 pt-3 sm:px-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-3">
          <div className="aspect-video w-full animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
          <div className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        </div>
        <div className="hidden h-[420px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03] lg:block" />
      </div>
    </div>
  );
}

/**
 * Resuelve el token del participante (query `?t=` o localStorage), valida la
 * sala por REST y decide entre la pantalla de entrada y la sala conectada.
 */
export function RoomClient({ code: rawCode }: RoomClientProps) {
  const code = rawCode.toUpperCase();
  const searchParams = useSearchParams();
  const queryToken = searchParams.get('t');

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [room, setRoom] = useState<PublicRoomResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* Token: prioridad al enlace compartido, luego al guardado en el dispositivo. */
  useEffect(() => {
    const fromQuery = queryToken?.trim() || null;
    const resolved = fromQuery ?? getRoomToken(code);
    if (fromQuery) {
      setRoomToken(code, fromQuery);
      const url = new URL(window.location.href);
      url.searchParams.delete('t');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    setToken(resolved);
    setReady(true);
  }, [code, queryToken]);

  /* Vista previa de la sala para la pantalla de entrada y validación temprana. */
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getRoomRequest(code)
      .then((response) => {
        if (!cancelled) setRoom(response);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'No se pudo comprobar la sala. Revisa tu conexión.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  /* Historial de chat (REST) para no perder mensajes al recargar. */
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getMessagesRequest(code, token)
      .then((response) => {
        if (!cancelled) useRoomStore.getState().setMessages(response.messages);
      })
      .catch(() => {
        /* token caducado o sala reiniciada: el socket mostrará el error real */
      });
    return () => {
      cancelled = true;
    };
  }, [code, token]);

  const handleJoined = useCallback(
    (nextToken: string) => {
      setRoomToken(code, nextToken);
      setFatalError(null);
      setToken(nextToken);
    },
    [code],
  );

  const handleFatal = useCallback(
    (message: string) => {
      clearRoomToken(code);
      setToken(null);
      setFatalError(message);
    },
    [code],
  );

  if (!ready) return <RoomSkeleton />;

  if (!token) {
    return (
      <JoinGate
        code={code}
        room={room}
        loadError={loadError}
        initialError={fatalError}
        onJoined={handleJoined}
      />
    );
  }

  const myId = participantIdFromToken(token);
  return <RoomView code={code} token={token} myId={myId} onFatal={handleFatal} />;
}

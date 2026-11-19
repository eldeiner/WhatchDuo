'use client';

import type { Participant } from '@cineduo/shared';
import { selectIsHost, useRoomStore } from '@/lib/store';
import { requestControl } from '@/lib/actions';
import { Button } from '../ui/Button';
import { CrownIcon, UsersIcon } from '../icons';

function initials(nickname: string): string {
  return nickname
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function avatarTone(id: string): string {
  const tones = [
    'from-marquee-300/25 to-marquee-500/10 text-marquee-200',
    'from-rose-400/25 to-rose-500/10 text-rose-300',
    'from-sky-400/20 to-sky-500/10 text-sky-300',
    'from-emerald-400/20 to-emerald-500/10 text-emerald-300',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % tones.length;
  return tones[hash] ?? tones[0]!;
}

interface ParticipantsPanelProps {
  onTransferRequest: (participant: Participant) => void;
}

export function ParticipantsPanel({ onTransferRequest }: ParticipantsPanelProps) {
  const participants = useRoomStore((s) => s.participants);
  const myId = useRoomStore((s) => s.myId);
  const isHost = useRoomStore(selectIsHost);
  const playback = useRoomStore((s) => s.playback);
  const controlRequestSent = useRoomStore((s) => s.controlRequestSent);
  const connection = useRoomStore((s) => s.connection);

  const host = participants.find((p) => p.id === playback?.hostId);
  const others = participants.filter((p) => p.id !== myId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">En la sala</p>
          <span className="text-[11px] text-mist-500">
            {participants.filter((p) => p.isConnected).length} en línea
          </span>
        </div>

        <ul className="space-y-1.5" aria-label="Participantes de la sala">
          {participants.map((participant) => {
            const isMe = participant.id === myId;
            return (
              <li
                key={participant.id}
                className="flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-2.5 py-2"
              >
                <span
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold ${avatarTone(participant.id)}`}
                  aria-hidden
                >
                  {initials(participant.nickname)}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-850 ${
                      participant.isConnected ? 'bg-emerald-400' : 'bg-mist-500'
                    }`}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm text-mist-100">
                    {participant.nickname}
                    {isMe ? (
                      <span className="rounded bg-white/[0.07] px-1 py-0.5 text-[9px] uppercase tracking-wide text-mist-400">
                        tú
                      </span>
                    ) : null}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-mist-500">
                    {participant.role === 'host' ? (
                      <>
                        <CrownIcon className="h-3 w-3 text-marquee-400" /> Host
                      </>
                    ) : (
                      'Invitado'
                    )}
                    <span aria-hidden>·</span>
                    {participant.isConnected ? 'Conectado' : 'Desconectado'}
                  </p>
                </div>

                {isHost && !isMe && participant.role !== 'host' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onTransferRequest(participant)}
                    disabled={!participant.isConnected}
                    className="shrink-0"
                  >
                    Dar control
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {!isHost ? (
          <div className="mt-4 rounded-xl border border-white/[0.05] bg-ink-900/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-mist-200">
              <CrownIcon className="h-3.5 w-3.5 text-marquee-400" />
              ¿Quieres llevar tú el mando?
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-mist-500">
              Envía una solicitud a {host?.nickname ?? 'el host'}. La reproducción seguirá
              sincronizada.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2.5"
              fullWidth
              disabled={controlRequestSent || connection !== 'connected' || !host?.isConnected}
              onClick={() => void requestControl()}
            >
              {controlRequestSent ? 'Solicitud enviada' : 'Pedir control'}
            </Button>
          </div>
        ) : others.length === 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.05] bg-ink-900/60 p-3 text-[11px] leading-relaxed text-mist-500">
            <UsersIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Comparte el enlace para que entre la otra persona. Tú mantendrás el control hasta que lo
            cedas.
          </div>
        ) : null}
      </div>
    </div>
  );
}

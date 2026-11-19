'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Participant } from '@cineduo/shared';
import { leaveRoom, transferControl } from '@/lib/actions';
import { startSession } from '@/lib/session';
import { useRoomStore } from '@/lib/store';
import { useWakeLock } from '@/lib/useWakeLock';
import { RoomHeader } from './RoomHeader';
import { VideoStage } from './VideoStage';
import { ChatPanel } from './ChatPanel';
import { ParticipantsPanel } from './ParticipantsPanel';
import { ReactionLayer } from './ReactionLayer';
import { ShareCard } from './ShareCard';
import { VideoSourceModal } from './VideoSourceModal';
import { HostRequestModal, TransferConfirmModal } from './HostRequestModal';
import { Dock, DockItem } from '@/components/ui/Dock';
import {
  ChatTeardropDots,
  UsersThree,
  FilmStrip,
  ShareNetwork,
  WarningCircle,
} from '@phosphor-icons/react';

type PanelTab = 'chat' | 'participants' | 'none';

interface RoomViewProps {
  code: string;
  token: string;
  myId: string | null;
  onFatal: (message: string) => void;
}

export function RoomView({ code, token, myId, onFatal }: RoomViewProps) {
  const router = useRouter();
  const connection = useRoomStore((s) => s.connection);
  const peerBuffering = useRoomStore((s) => s.peerBuffering);

  const [tab, setTab] = useState<PanelTab>('chat');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Participant | null>(null);

  useWakeLock(true);

  useEffect(() => {
    useRoomStore.getState().setIdentity({ code, token, myId });
    const cleanup = startSession({ code, token, onFatal });
    return cleanup;
  }, [code, token, myId, onFatal]);

  const confirmLeave = () => {
    leaveRoom();
    setLeaveOpen(false);
    router.push('/');
  };

  const confirmTransfer = async () => {
    if (!transferTarget) return;
    const ok = await transferControl(transferTarget.id);
    if (ok) setTransferTarget(null);
  };

  const bufferingNames = Object.values(peerBuffering);
  const reconnecting = connection === 'reconnecting' || connection === 'connecting';
  const offline = connection === 'offline';

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[#07080b] text-zinc-100 overflow-x-hidden">
      <RoomHeader code={code} onLeave={() => setLeaveOpen(true)} />

      {reconnecting || offline ? (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs font-semibold text-amber-300">
          {offline
            ? 'Conexión interrumpida. Verificando red...'
            : 'Reconectando sincronizador con el servidor maestro...'}
        </div>
      ) : null}

      {bufferingNames.length > 0 ? (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 text-center text-xs font-medium text-blue-300 flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
          <span>
            Pausado momentáneamente: {bufferingNames.join(', ')} está cargando el búfer de video...
          </span>
        </div>
      ) : null}

      <div className="relative flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Main Stage */}
        <main className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-5 lg:p-6">
          <div className="relative w-full max-w-5xl rounded-2xl overflow-hidden border border-white/[0.08] bg-[#090a0f] shadow-2xl flex flex-col">
            <VideoStage onOpenSource={() => setSourceOpen(true)} />
            <ReactionLayer />
          </div>

          {/* Interactive Floating Dock inspired by Rare UI */}
          <div className="mt-4 sm:mt-5 z-20">
            <Dock>
              <DockItem
                active={tab === 'chat'}
                onClick={() => setTab(tab === 'chat' ? 'none' : 'chat')}
                tooltip="Abrir Chat"
              >
                <ChatTeardropDots size={22} weight={tab === 'chat' ? 'fill' : 'regular'} />
              </DockItem>

              <DockItem
                active={tab === 'participants'}
                onClick={() => setTab(tab === 'participants' ? 'none' : 'participants')}
                tooltip="Ver Participantes"
              >
                <UsersThree size={22} weight={tab === 'participants' ? 'fill' : 'regular'} />
              </DockItem>

              <DockItem onClick={() => setSourceOpen(true)} tooltip="Cambiar Video / Fuente">
                <FilmStrip size={22} />
              </DockItem>

              <DockItem onClick={() => setShareOpen(true)} tooltip="Compartir Invitación">
                <ShareNetwork size={22} />
              </DockItem>
            </Dock>
          </div>
        </main>

        {/* Sidebar Panel for Chat / Participants */}
        {tab !== 'none' && (
          <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-white/[0.08] bg-[#0a0b10]/95 backdrop-blur-xl flex flex-col h-80 lg:h-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('chat')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    tab === 'chat'
                      ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Chat en Vivo
                </button>
                <button
                  onClick={() => setTab('participants')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    tab === 'participants'
                      ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Participantes
                </button>
              </div>

              <button
                onClick={() => setTab('none')}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Ocultar
              </button>
            </div>

            <div className="flex-1 overflow-hidden p-2">
              {tab === 'chat' ? (
                <ChatPanel />
              ) : (
                <ParticipantsPanel onTransferRequest={(p: Participant) => setTransferTarget(p)} />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modals and Overlays */}
      <VideoSourceModal open={sourceOpen} onClose={() => setSourceOpen(false)} />
      <HostRequestModal />

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0d0e14] p-6 shadow-2xl">
            <ShareCard code={code} />
            <button
              onClick={() => setShareOpen(false)}
              className="mt-4 w-full rounded-xl bg-white/[0.06] py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.1]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {leaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#0d0e14] p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <WarningCircle size={28} />
            </div>
            <h3 className="mt-4 text-base font-bold text-white">¿Salir de la sala?</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Te desconectarás de la sincronización en vivo. Podrás unirte de nuevo con el mismo código.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setLeaveOpen(false)}
                className="flex-1 rounded-xl bg-white/[0.06] py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.1]"
              >
                Permanecer
              </button>
              <button
                onClick={confirmLeave}
                className="flex-1 rounded-xl bg-rose-500 py-2.5 text-xs font-semibold text-white hover:bg-rose-600"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {transferTarget && (
        <TransferConfirmModal
          nickname={transferTarget.nickname}
          onConfirm={confirmTransfer}
          onClose={() => setTransferTarget(null)}
        />
      )}
    </div>
  );
}

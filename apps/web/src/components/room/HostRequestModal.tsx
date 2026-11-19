'use client';

import { useState } from 'react';
import { useRoomStore } from '@/lib/store';
import { transferControl } from '@/lib/actions';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function HostRequestModal() {
  const request = useRoomStore((s) => s.hostRequest);
  const setHostRequest = useRoomStore((s) => s.setHostRequest);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setHostRequest(null);
  };

  const accept = async () => {
    if (!request) return;
    setBusy(true);
    const ok = await transferControl(request.participantId);
    setBusy(false);
    if (ok) setHostRequest(null);
  };

  return (
    <Modal
      open={Boolean(request)}
      onClose={close}
      title="Solicitud de control"
      description={
        request
          ? `${request.nickname} quiere controlar la reproducción. Seguiréis viendo lo mismo.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Ahora no
          </Button>
          <Button variant="marquee" onClick={() => void accept()} loading={busy}>
            Ceder el control
          </Button>
        </>
      }
    >
      <p className="rounded-xl border border-white/[0.06] bg-ink-900/60 p-3 text-xs leading-relaxed text-mist-400">
        Si aceptas, {request?.nickname ?? 'la otra persona'} podrá reproducir, pausar, buscar y
        cambiar la velocidad. Tú podrás pedir el control de vuelta.
      </p>
    </Modal>
  );
}

interface TransferConfirmModalProps {
  nickname: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function TransferConfirmModal({ nickname, onClose, onConfirm }: TransferConfirmModalProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={Boolean(nickname)}
      onClose={onClose}
      title="Ceder el control"
      description={`¿Seguro que quieres que ${nickname ?? 'esta persona'} controle la reproducción?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="marquee"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            Sí, ceder el control
          </Button>
        </>
      }
    >
      <p className="rounded-xl border border-white/[0.06] bg-ink-900/60 p-3 text-xs leading-relaxed text-mist-400">
        Podrás seguir viendo el video y usando el chat. Para recuperar el mando, pídeselo a la nueva
        persona o espera a que se desconecte.
      </p>
    </Modal>
  );
}

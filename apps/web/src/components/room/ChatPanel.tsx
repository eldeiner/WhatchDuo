'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage, Reaction, SystemNotice } from '@cineduo/shared';
import { ChatCircleDots } from '@phosphor-icons/react';
import { MESSAGE_MAX, REACTIONS } from '@cineduo/shared';
import { sendChat, sendReaction } from '@/lib/actions';
import { useRoomStore } from '@/lib/store';
import { SendIcon } from '../icons';

type Item =
  | { kind: 'chat'; id: string; at: number; message: ChatMessage; mine: boolean }
  | { kind: 'notice'; id: string; at: number; notice: SystemNotice };

function clockTime(timestamp: number): string {
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function mergeItems(messages: ChatMessage[], notices: SystemNotice[], myId: string | null): Item[] {
  const items: Item[] = [
    ...messages.map((message) => ({
      kind: 'chat' as const,
      id: message.id,
      at: message.createdAt,
      message,
      mine: message.participantId === myId,
    })),
    ...notices.map((notice) => ({
      kind: 'notice' as const,
      id: notice.id,
      at: notice.createdAt,
      notice,
    })),
  ];
  return items.sort((a, b) => a.at - b.at);
}

export function ChatPanel() {
  const messages = useRoomStore((s) => s.messages);
  const notices = useRoomStore((s) => s.notices);
  const myId = useRoomStore((s) => s.myId);
  const connection = useRoomStore((s) => s.connection);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  const items = useMemo(() => mergeItems(messages, notices, myId), [messages, notices, myId]);

  useEffect(() => {
    if (!nearBottom.current) return;
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [items.length]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const ok = await sendChat(trimmed);
    if (ok) setText('');
    setSending(false);
    nearBottom.current = true;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Mensajes del chat"
        onScroll={() => {
          const node = listRef.current;
          if (!node) return;
          nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90;
        }}
        className="scrollbar-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
      >
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-zinc-400">
              <ChatCircleDots size={22} weight="duotone" />
            </div>
            <p className="text-sm font-medium text-mist-300">Aún no hay mensajes</p>
            <p className="text-xs text-mist-500">
              Rompe el hielo: comenta la escena o manda una reacción.
            </p>
          </div>
        ) : null}

        {items.map((item) =>
          item.kind === 'notice' ? (
            <p key={item.id} className="px-2 text-center text-[11px] leading-relaxed text-mist-500">
              {item.notice.text}
            </p>
          ) : (
            <div
              key={item.id}
              className={`flex flex-col ${item.mine ? 'items-end' : 'items-start'}`}
            >
              <div className="mb-0.5 flex items-center gap-1.5 px-1 text-[10px] text-mist-500">
                {!item.mine ? (
                  <span className="font-medium text-mist-400">{item.message.nickname}</span>
                ) : null}
                <time dateTime={new Date(item.at).toISOString()}>{clockTime(item.at)}</time>
              </div>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                  item.mine
                    ? 'rounded-br-md bg-marquee-400/[0.14] text-marquee-50 ring-1 ring-inset ring-marquee-400/20'
                    : 'rounded-bl-md bg-white/[0.055] text-mist-200'
                }`}
              >
                {item.message.text}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-white/[0.05] p-2.5">
        <div
          className="mb-2 flex items-center gap-1 overflow-x-auto no-scrollbar"
          aria-label="Reacciones rápidas"
        >
          {(REACTIONS as readonly Reaction['emoji'][]).map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              disabled={connection !== 'connected'}
              aria-label={`Reaccionar con ${emoji}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base transition hover:bg-white/[0.06] active:scale-95 disabled:opacity-40"
            >
              {emoji}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Escribe un mensaje
          </label>
          <textarea
            id="chat-input"
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MESSAGE_MAX))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit(event);
              }
            }}
            rows={1}
            maxLength={MESSAGE_MAX}
            placeholder="Escribe un mensaje…"
            className="max-h-24 min-h-[44px] w-full resize-none rounded-xl border border-white/[0.08] bg-ink-900/80 px-3 py-2.5 text-[13px] text-mist-100 placeholder:text-mist-500 focus:border-marquee-400/60 focus:outline-none focus:ring-2 focus:ring-marquee-400/20"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="Enviar mensaje"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marquee-400 text-ink-950 transition hover:bg-marquee-300 disabled:pointer-events-none disabled:bg-white/[0.06] disabled:text-mist-500"
          >
            <SendIcon className="h-[18px] w-[18px]" />
          </button>
        </form>
        {text.length > MESSAGE_MAX - 60 ? (
          <p className="mt-1 text-right text-[10px] text-mist-500">
            {text.length}/{MESSAGE_MAX}
          </p>
        ) : null}
      </div>
    </div>
  );
}

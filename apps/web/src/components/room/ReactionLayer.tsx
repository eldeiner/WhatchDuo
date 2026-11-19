'use client';

import { useRoomStore } from '@/lib/store';

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result);
}

/**
 * Capa decorativa de reacciones flotantes sobre el video. No captura el
 * puntero: los controles siguen siendo accesibles por debajo.
 */
export function ReactionLayer() {
  const reactions = useRoomStore((s) => s.reactions);

  if (reactions.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {reactions.map((reaction) => {
        const seed = hash(reaction.id);
        const left = 6 + (seed % 86);
        const delay = (seed >> 4) % 320;
        const drift = 120 + ((seed >> 8) % 80);
        const size = 24 + ((seed >> 12) % 14);
        return (
          <span
            key={reaction.id}
            title={`${reaction.nickname}: ${reaction.emoji}`}
            className="absolute bottom-[10%] animate-drift select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}ms`,
              fontSize: `${size}px`,
              ['--drift-distance' as string]: `${drift}px`,
            }}
          >
            {reaction.emoji}
          </span>
        );
      })}
    </div>
  );
}

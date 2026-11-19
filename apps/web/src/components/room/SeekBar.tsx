'use client';

import { useState, type CSSProperties } from 'react';
import { formatTime } from '@cineduo/shared';

interface SeekBarProps {
  current: number;
  duration: number;
  disabled?: boolean;
  onCommit?: (position: number) => void;
}

export function SeekBar({ current, duration, disabled = false, onCommit }: SeekBarProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? current;
  const max = Number.isFinite(duration) ? duration : 0;
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  const commit = () => {
    if (drag === null || disabled) return;
    onCommit?.(drag);
    setDrag(null);
  };

  return (
    <div className="w-full select-none">
      <div className="relative flex items-center h-4 group cursor-pointer">
        {/* Track background */}
        <div className="absolute h-1.5 w-full rounded-full bg-white/[0.12] overflow-hidden group-hover:h-2 transition-all">
          {/* Progress fill */}
          <div
            className="h-full bg-sky-400 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Real HTML range over track */}
        <input
          type="range"
          min={0}
          max={max || 1}
          step={0.1}
          value={Math.min(value, max || 0)}
          disabled={disabled || max <= 0}
          onChange={(event) => setDrag(Number(event.target.value))}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={(event) => {
            if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End')
              commit();
          }}
          onPointerCancel={() => setDrag(null)}
          onBlur={() => setDrag(null)}
          aria-label="Línea de tiempo del video"
          aria-valuetext={`${formatTime(value)} de ${formatTime(max)}`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        {/* Thumb indicator on hover */}
        <div
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-sky-400 shadow-md shadow-sky-500/50 scale-0 group-hover:scale-100 transition-transform"
          style={{ left: `${percent}%` }}
        />
      </div>

      <div className="mt-1 flex items-center justify-between font-mono text-[11px] tabular-nums text-slate-500 dark:text-zinc-400">
        <span className="font-semibold text-sky-500 dark:text-sky-300">{formatTime(value)}</span>
        <span>{formatTime(max)}</span>
      </div>
    </div>
  );
}

'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SpinnerIcon } from '../icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'marquee';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-marquee-400 text-ink-950 hover:bg-marquee-300 active:bg-marquee-500 shadow-marquee focus-visible:ring-marquee-300',
  marquee:
    'bg-amber-400 text-ink-950 hover:bg-amber-300 active:bg-amber-500 border border-amber-300/40 font-semibold',
  secondary:
    'bg-ink-800 text-mist-100 hover:bg-ink-700 border border-white/10 focus-visible:ring-white/40',
  ghost:
    'bg-transparent text-mist-300 hover:bg-white/5 hover:text-mist-100 focus-visible:ring-white/30',
  danger:
    'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 focus-visible:ring-rose-400',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-[52px] px-5 text-base rounded-2xl gap-2.5',
  icon: 'h-12 w-12 rounded-xl justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  fullWidth,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex select-none items-center justify-center font-medium tracking-tight transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        'disabled:pointer-events-none disabled:opacity-45',
        'active:scale-[0.985]',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? <SpinnerIcon className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}

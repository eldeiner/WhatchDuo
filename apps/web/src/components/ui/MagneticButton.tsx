'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { cn } from '@/lib/utils';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  strength?: number;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function MagneticButton({
  children,
  strength = 0.35,
  className,
  variant = 'primary',
  onClick,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 15, stiffness: 150, mass: 0.2 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    x.set((clientX - centerX) * strength);
    y.set((clientY - centerY) * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const baseStyles =
    'relative inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

  const variants = {
    primary:
      'bg-sky-400 text-slate-950 font-semibold shadow-lg shadow-sky-500/20 hover:bg-sky-300 rounded-xl px-5 py-3',
    secondary:
      'bg-white/[0.05] border border-white/[0.1] text-zinc-200 hover:bg-white/[0.08] hover:text-white rounded-xl px-4 py-2.5',
    ghost:
      'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] rounded-xl px-3 py-2',
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: smoothX, y: smoothY }}
      className={cn(baseStyles, variants[variant], className)}
      onClick={onClick}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

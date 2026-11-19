'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';

interface DockProps {
  children: React.ReactNode;
  className?: string;
}

export function Dock({ children, className }: DockProps) {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        'mx-auto flex h-14 items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0c0d12]/90 px-3 backdrop-blur-2xl shadow-2xl',
        className
      )}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { mouseX });
        }
        return child;
      })}
    </motion.div>
  );
}

interface DockItemProps {
  mouseX?: any;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  tooltip?: string;
}

export function DockItem({
  mouseX,
  children,
  className,
  onClick,
  active,
  tooltip,
}: DockItemProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const distance = useTransform(mouseX ?? 0, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-120, 0, 120], [38, 52, 38]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 180, damping: 14 });

  return (
    <motion.button
      ref={ref}
      style={{ width, height: width }}
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center rounded-xl text-zinc-400 transition-colors',
        active
          ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
          : 'hover:bg-white/[0.06] hover:text-zinc-100',
        className
      )}
      title={tooltip}
    >
      {children}
    </motion.button>
  );
}

'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export function FluidOrb({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute overflow-hidden select-none', className)}>
      <motion.div
        animate={{
          scale: [1, 1.15, 0.95, 1],
          x: [0, 25, -20, 0],
          y: [0, -35, 15, 0],
          rotate: [0, 45, 90, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="h-96 w-96 rounded-full bg-gradient-to-tr from-amber-500/15 via-rose-500/10 to-amber-300/10 blur-[90px]"
      />
    </div>
  );
}

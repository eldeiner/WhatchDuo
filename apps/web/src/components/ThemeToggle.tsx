'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from '@phosphor-icons/react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-400 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300 hover:bg-sky-500/20 active:scale-95 transition-all shadow-sm ${className}`}
    >
      {theme === 'dark' ? (
        <Sun size={18} weight="fill" className="transition-transform rotate-0 hover:rotate-45" />
      ) : (
        <Moon size={18} weight="fill" className="transition-transform -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
}

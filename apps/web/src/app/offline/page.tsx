import Link from 'next/link';
import { FilmIcon } from '@/components/icons';

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <FilmIcon className="h-10 w-10 text-marquee-400" />
      <h1 className="mt-4 font-display text-3xl text-mist-100">Sin conexión</h1>
      <p className="mt-2 max-w-sm text-sm text-mist-400">
        CineDúo necesita conexión para sincronizar la reproducción. Comprueba tu red y vuelve a
        intentarlo.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-marquee-400 px-5 text-sm font-medium text-ink-950"
      >
        Reintentar
      </Link>
    </main>
  );
}

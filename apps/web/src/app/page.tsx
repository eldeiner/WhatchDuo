import { Suspense } from 'react';
import { HomeScreen } from '@/components/home/HomeScreen';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-mist-500">
          Cargando CineDúo…
        </div>
      }
    >
      <HomeScreen />
    </Suspense>
  );
}

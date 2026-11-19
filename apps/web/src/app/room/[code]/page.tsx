import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RoomClient } from '@/components/room/RoomClient';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const { code } = await params;
  const normalized = code.toUpperCase();
  return {
    title: `Sala ${normalized}`,
    description: `Únete a la sala ${normalized} de CineDúo y mira el mismo video, sincronizado.`,
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center px-6 text-sm text-mist-500">
          Entrando en la sala…
        </div>
      }
    >
      <RoomClient code={code} />
    </Suspense>
  );
}

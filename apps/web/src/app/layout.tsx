import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/PwaRegister';
import { ThemeProvider } from '@/components/ThemeProvider';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CineDúo — ver juntos, sincronizados',
    template: '%s · CineDúo',
  },
  description:
    'CineDúo sincroniza la reproducción de tus propios videos entre una PC y un móvil. Sala privada, chat, reacciones y control compartido.',
  applicationName: 'CineDúo',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CineDúo',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'CineDúo',
    description: 'La misma película, a la vez. Sincroniza tu propio video entre PC y móvil.',
    type: 'website',
    locale: 'es_ES',
  },
};

export const viewport: Viewport = {
  themeColor: '#070b12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>
        <ThemeProvider>
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-sky-400 focus:px-4 focus:py-2 focus:text-slate-950"
          >
            Saltar al contenido
          </a>
          {children}
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}

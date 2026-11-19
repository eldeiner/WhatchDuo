'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Broadcast,
  CheckCircle,
  ClockAfternoon,
  DeviceMobile,
  FilmReel,
  PlayCircle,
  PlusCircle,
  SignIn,
  Sparkle,
  Users,
  VideoCamera,
} from '@phosphor-icons/react';
import { videoUrlError } from '@cineduo/shared';
import { ApiError, createRoomRequest, joinRoomRequest } from '@/lib/api';
import { getLastRoom, getStoredNickname, setRoomToken, setStoredNickname } from '@/lib/storage';
import { Brand } from '@/components/Brand';
import { InstallPrompt } from '@/components/InstallPrompt';
import { ThemeToggle } from '@/components/ThemeToggle';

type Mode = 'create' | 'join';

const CAPABILITIES = [
  {
    icon: Broadcast,
    title: 'Reloj Maestro de Servidor',
    desc: 'Compensación de latencia sub-segundo con corrección automática por drift.',
  },
  {
    icon: Users,
    title: 'Control Bilateral Fluido',
    desc: 'Transfiere el mando al instante o permite intervenciones mutuas sin fricción.',
  },
  {
    icon: DeviceMobile,
    title: 'PWA Multi-dispositivo',
    desc: 'Abre la sala en Smart TV, laptop o iPhone sin instalar aplicaciones pesadas.',
  },
];

export function HomeScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const initialCode = (params.get('code') ?? '').toUpperCase().slice(0, 6);
  const initialMode = params.get('mode') === 'join' || initialCode ? 'join' : 'create';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(initialCode);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRoom, setLastRoom] = useState<string | null>(null);

  useEffect(() => {
    setNickname(getStoredNickname());
    setLastRoom(getLastRoom());
  }, []);

  const validateNickname = (): boolean => {
    if (nickname.trim().length < 2) {
      setError('Escribe un apodo de al menos 2 caracteres.');
      return false;
    }
    return true;
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validateNickname()) return;

    const trimmed = videoUrl.trim();
    const urlErr = trimmed ? videoUrlError(trimmed) : null;
    if (urlErr) {
      setError(urlErr);
      return;
    }

    setLoading(true);
    try {
      const response = await createRoomRequest({
        nickname: nickname.trim(),
        ...(trimmed ? { videoUrl: trimmed } : {}),
      });
      setStoredNickname(nickname.trim());
      setRoomToken(response.roomCode, response.participantToken);
      router.push(`/room/${response.roomCode}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la sala.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validateNickname()) return;

    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError('El código de sala debe tener exactamente 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await joinRoomRequest(normalized, nickname.trim());
      setStoredNickname(nickname.trim());
      setRoomToken(response.roomCode, response.participantToken);
      router.push(`/room/${response.roomCode}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo acceder a la sala.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-slate-50 dark:bg-[#070b12] text-slate-800 dark:text-zinc-100 subtle-grid transition-colors duration-200">
      {/* Navigation Header */}
      <header className="relative z-20 mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
        <Brand />
        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />
          <a
            href="#arquitectura"
            className="hidden text-sm font-medium text-slate-600 dark:text-zinc-400 transition-colors hover:text-slate-900 dark:hover:text-zinc-100 sm:block"
          >
            Protocolo de Sync
          </a>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-600 dark:text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            Baja latencia activa
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-6 pb-20 lg:px-12 lg:pt-14">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Value Prop */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
              <Sparkle size={14} weight="fill" className="text-sky-400" />
              <span>Sincronización cinematográfica de alta precisión</span>
            </div>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:leading-[1.08] text-balance">
              Cine compartido en tiempo real.{' '}
              <span className="text-sky-500 dark:text-sky-400">
                Cero desfase.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 dark:text-zinc-400 sm:text-lg text-pretty">
              Visualiza películas y streams con quien quieras a través de un servidor sincronizador centralizado. Sin cuentas, sin extensiones intrusivas y con control mutuo.
            </p>

            {/* Feature highlights */}
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {CAPABILITIES.map((cap) => (
                <div
                  key={cap.title}
                  className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white/70 dark:bg-[#0d0e14]/60 p-4 shadow-sm backdrop-blur-md"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 dark:text-sky-300">
                    <cap.icon size={20} weight="duotone" />
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-slate-800 dark:text-zinc-200">{cap.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Clean Solid Form Panel */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0d0e14] p-6 sm:p-8 shadow-xl">
              <div className="flex rounded-xl bg-slate-100 dark:bg-zinc-900/90 p-1 border border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('create');
                    setError(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                    mode === 'create'
                      ? 'bg-sky-400 text-slate-950 font-bold shadow-sm shadow-sky-400/30'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <PlusCircle size={16} weight="bold" />
                  Crear Sala
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('join');
                    setError(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                    mode === 'join'
                      ? 'bg-sky-400 text-slate-950 font-bold shadow-sm shadow-sky-400/30'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <SignIn size={16} weight="bold" />
                  Unirse
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-500 dark:text-rose-300">
                  {error}
                </div>
              )}

              <AnimatePresence mode="wait">
                {mode === 'create' ? (
                  <motion.form
                    key="create-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleCreate}
                    className="mt-6 space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                        Tu Apodo
                      </label>
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={24}
                        placeholder="Ej. Sofía"
                        required
                        className="mt-2 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-colors focus:border-sky-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                          Enlace de Video (Opcional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setVideoUrl('/videos/demo.mp4')}
                          className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300"
                        >
                          Usar demo
                        </button>
                      </div>
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="YouTube, MP4, HLS (.m3u8)"
                        className="mt-2 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-colors focus:border-sky-400 focus:outline-none"
                      />
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-500">
                        Compatible con YouTube, Vimeo, archivos directos MP4 o WebRTC.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 py-3.5 text-sm font-bold text-slate-950 shadow-md shadow-sky-400/25 transition-all hover:bg-sky-300 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? (
                        <span>Configurando sala...</span>
                      ) : (
                        <>
                          <PlayCircle size={18} weight="fill" />
                          <span>Lanzar Sala de Cine</span>
                        </>
                      )}
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="join-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleJoin}
                    className="mt-6 space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                        Código de Sala (6 letras)
                      </label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) =>
                          setCode(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, '')
                              .slice(0, 6)
                          )
                        }
                        maxLength={6}
                        placeholder="ABC123"
                        required
                        className="mt-2 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.4em] uppercase text-sky-500 dark:text-sky-400 placeholder-slate-400 dark:placeholder-zinc-600 transition-colors focus:border-sky-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                        Tu Apodo
                      </label>
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={24}
                        placeholder="Ej. Lucas"
                        required
                        className="mt-2 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 py-3 text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 transition-colors focus:border-sky-400 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 py-3.5 text-sm font-bold text-slate-950 shadow-md shadow-sky-400/25 transition-all hover:bg-sky-300 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? (
                        <span>Conectando...</span>
                      ) : (
                        <>
                          <SignIn size={18} weight="bold" />
                          <span>Entrar a la Función</span>
                        </>
                      )}
                    </button>

                    {lastRoom && lastRoom !== code && (
                      <button
                        type="button"
                        onClick={() => setCode(lastRoom)}
                        className="w-full text-center text-xs text-slate-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-300"
                      >
                        Volver a la sala previa <span className="font-mono font-bold text-sky-500 dark:text-sky-400">{lastRoom}</span>
                      </button>
                    )}
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Bento Grid Features Section */}
        <section id="arquitectura" className="mt-28">
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-bold tracking-widest text-sky-500 dark:text-sky-400 uppercase">
              Ingeniería de Sincronía
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Diseñado para ver cine a distancia sin desincronizaciones
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-zinc-400">
              Arquitectura websocket bidireccional conectada a un oscilador maestro con compensación instantánea.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col h-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0d0e14] p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-500 dark:text-sky-400">
                <ClockAfternoon size={26} weight="duotone" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">Oscilador Maestro Central</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 text-pretty">
                El servidor orquesta cada microsegundo del timeline. Si la conexión de un participante vacila, el reproductor realiza un catch-up progresivo sin congelar al resto.
              </p>
            </div>

            <div className="flex flex-col h-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0d0e14] p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-500 dark:text-sky-400">
                <FilmReel size={26} weight="duotone" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">Fuentes Híbridas & P2P</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 text-pretty">
                Transmite archivos directos, streaming en vivo HLS, videos de YouTube o tu propia pantalla mediante WebRTC de bajísima latencia.
              </p>
            </div>

            <div className="flex flex-col h-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0d0e14] p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-500 dark:text-sky-400">
                <DeviceMobile size={26} weight="duotone" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">Instalable como App Nativa</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 text-pretty">
                Tecnología Progressive Web App con WakeLock que evita que la pantalla se apague durante películas de larga duración.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Aesthetic Footer */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-[#07080b] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-slate-500 dark:text-zinc-500 sm:flex-row lg:px-12">
          <p>© 2026 CineDúo Sync. Estándar de reproducción en tiempo real.</p>
          <div className="flex items-center gap-6">
            <span>Usa exclusivamente contenido libre o con derechos.</span>
          </div>
        </div>
      </footer>

      <InstallPrompt />
    </div>
  );
}

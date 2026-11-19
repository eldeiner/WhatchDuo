/**
 * Sincronización de reloj estilo NTP simplificado.
 *
 * t0 = reloj local al enviar
 * t1 = reloj del servidor al recibir/responder
 * t2 = reloj local al recibir la respuesta
 *
 * offset = t1 - (t0 + t2) / 2
 * rtt    = t2 - t0
 *
 * Se toman varias muestras y se usa la mediana de las de menor RTT para
 * reducir el impacto de picos de latencia.
 */

export interface ClockSample {
  /** ms que el reloj local va por detrás del servidor (serverTime - localTime). */
  offset: number;
  /** ida y vuelta en ms */
  rtt: number;
  /** epoch ms local en el momento del cálculo */
  at: number;
}

export function sampleFromPong(
  clientSentAt: number,
  serverTime: number,
  receivedAt: number,
): ClockSample {
  const rtt = Math.max(0, receivedAt - clientSentAt);
  const offset = serverTime - (clientSentAt + receivedAt) / 2;
  return { offset, rtt, at: receivedAt };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Selecciona las `keep` muestras con menor RTT y devuelve la mediana de sus
 * offsets. Filtrar por RTT bajo evita que una petición lenta contamine el reloj.
 */
export function estimateOffset(
  samples: ClockSample[],
  keep = 3,
): { offset: number; rtt: number; used: number } {
  if (samples.length === 0) return { offset: 0, rtt: 0, used: 0 };
  const best = [...samples].sort((a, b) => a.rtt - b.rtt).slice(0, Math.max(1, keep));
  return {
    offset: median(best.map((s) => s.offset)),
    rtt: median(best.map((s) => s.rtt)),
    used: best.length,
  };
}

export function keepRecentSamples(samples: ClockSample[], limit: number): ClockSample[] {
  return samples.length <= limit ? samples : samples.slice(samples.length - limit);
}

export function serverNowFrom(localNow: number, offset: number): number {
  return localNow + offset;
}

export function localTimeFrom(serverTime: number, offset: number): number {
  return serverTime - offset;
}

/** Formatea segundos como m:ss (o h:mm:ss). */
export function formatTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const s = Math.floor(safe % 60);
  const m = Math.floor((safe / 60) % 60);
  const h = Math.floor(safe / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

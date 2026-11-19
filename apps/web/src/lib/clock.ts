'use client';

import {
  estimateOffset,
  keepRecentSamples,
  sampleFromPong,
  type ClockSample,
} from '@cineduo/shared';

/**
 * Reloj del cliente alineado con el servidor mediante ping/pong.
 * `now()` devuelve la hora estimada del servidor en ms.
 */
class ServerClock {
  private offset = 0;
  private rtt = 0;
  private samples: ClockSample[] = [];
  private hint = 0;

  reset(): void {
    this.offset = 0;
    this.rtt = 0;
    this.samples = [];
    this.hint = 0;
  }

  /** Estimación inicial con el `serverTime` del último snapshot. */
  setHint(serverTime: number): void {
    if (this.samples.length > 0) return;
    this.hint = serverTime - Date.now();
    this.offset = this.hint;
  }

  addSample(clientSentAt: number, serverTime: number): void {
    const sample = sampleFromPong(clientSentAt, serverTime, Date.now());
    this.samples = keepRecentSamples([...this.samples, sample], 9);
    const estimate = estimateOffset(this.samples, 3);
    this.offset = estimate.offset;
    this.rtt = estimate.rtt;
  }

  now(): number {
    return Date.now() + this.offset;
  }

  localToServer(localMs: number): number {
    return localMs + this.offset;
  }

  get latency(): number {
    return this.rtt;
  }

  get isSynced(): boolean {
    return this.samples.length >= 3;
  }

  get sampleCount(): number {
    return this.samples.length;
  }
}

export const clock = new ServerClock();

import { describe, expect, it } from 'vitest';
import {
  estimateOffset,
  formatTime,
  keepRecentSamples,
  median,
  sampleFromPong,
  serverNowFrom,
  type ClockSample,
} from '../src/clock';

describe('sampleFromPong', () => {
  it('calcula offset y RTT simétricos', () => {
    // Enviamos en local 1000, el servidor responde en 1100, recibimos en 1200.
    const sample = sampleFromPong(1000, 1100, 1200);
    expect(sample.offset).toBe(0); // 1100 - (1000+1200)/2
    expect(sample.rtt).toBe(200);
  });

  it('detecta un reloj local atrasado', () => {
    // El servidor va 5 s por delante.
    const sample = sampleFromPong(10_000, 15_050, 10_100);
    expect(sample.offset).toBeCloseTo(5000, 0);
  });

  it('nunca devuelve RTT negativo si el reloj salta', () => {
    expect(sampleFromPong(2000, 1500, 1000).rtt).toBe(0);
  });
});

describe('median', () => {
  it('calcula mediana par e impar', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('estimateOffset', () => {
  it('usa las muestras con menor RTT', () => {
    const samples: ClockSample[] = [
      { offset: 9999, rtt: 800, at: 1 },
      { offset: 100, rtt: 40, at: 2 },
      { offset: 102, rtt: 50, at: 3 },
      { offset: 104, rtt: 45, at: 4 },
    ];
    const estimate = estimateOffset(samples, 3);
    expect(estimate.offset).toBe(102);
    expect(estimate.used).toBe(3);
  });

  it('tolera una lista vacía', () => {
    expect(estimateOffset([], 3)).toEqual({ offset: 0, rtt: 0, used: 0 });
  });
});

describe('keepRecentSamples', () => {
  it('conserva solo las últimas N muestras', () => {
    const samples: ClockSample[] = Array.from({ length: 8 }, (_, i) => ({
      offset: i,
      rtt: 10,
      at: i,
    }));
    const kept = keepRecentSamples(samples, 5);
    expect(kept).toHaveLength(5);
    expect(kept[4]?.offset).toBe(7);
  });
});

describe('serverNowFrom', () => {
  it('suma el offset al reloj local', () => {
    expect(serverNowFrom(1000, 250)).toBe(1250);
  });
});

describe('formatTime', () => {
  it('formatea segundos, minutos y horas', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

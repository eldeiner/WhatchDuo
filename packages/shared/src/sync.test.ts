import { describe, expect, it } from 'vitest';
import { SYNC } from '../src/constants';
import {
  clampPosition,
  decideCorrection,
  expectedPosition,
  shouldAcceptVersion,
} from '../src/sync';

const base = {
  position: 100,
  isPlaying: true,
  playbackRate: 1,
  updatedAt: 1_000_000,
};

describe('expectedPosition', () => {
  it('no avanza si está pausado', () => {
    expect(expectedPosition({ ...base, isPlaying: false }, 1_060_000)).toBe(100);
  });

  it('avanza según el tiempo transcurrido y la velocidad', () => {
    // 60 s a 1x
    expect(expectedPosition(base, 1_060_000)).toBeCloseTo(160, 5);
    // 60 s a 1.5x
    expect(expectedPosition({ ...base, playbackRate: 1.5 }, 1_060_000)).toBeCloseTo(190, 5);
    // 60 s a 0.75x
    expect(expectedPosition({ ...base, playbackRate: 0.75 }, 1_060_000)).toBeCloseTo(145, 5);
  });

  it('no resta tiempo si updatedAt está en el futuro', () => {
    expect(expectedPosition(base, 900_000)).toBe(100);
  });

  it('trata posiciones negativas como 0', () => {
    expect(expectedPosition({ ...base, isPlaying: false, position: -5 }, 1_000_000)).toBe(0);
  });
});

describe('decideCorrection', () => {
  it('no corrige desfases pequeños al reproducir', () => {
    const correction = decideCorrection({
      drift: 0.1,
      isPlaying: true,
      baseRate: 1,
      expected: 50,
    });
    expect(correction.kind).toBe('none');
  });

  it('hace seek cuando el desfase supera 0.75 s', () => {
    const ahead = decideCorrection({ drift: 0.9, isPlaying: true, baseRate: 1, expected: 50 });
    expect(ahead.kind).toBe('seek');
    if (ahead.kind === 'seek') expect(ahead.to).toBe(50);

    const behind = decideCorrection({ drift: -0.9, isPlaying: true, baseRate: 1, expected: 50 });
    expect(behind.kind).toBe('seek');
  });

  it('acelera ligeramente si el cliente va por detrás', () => {
    const correction = decideCorrection({
      drift: -0.5,
      isPlaying: true,
      baseRate: 1,
      expected: 50,
    });
    expect(correction.kind).toBe('rate');
    if (correction.kind === 'rate') {
      expect(correction.rate).toBeCloseTo(1.05, 5);
      expect(correction.revertAfterMs).toBe(SYNC.softSyncDurationMs);
      expect(correction.baseRate).toBe(1);
    }
  });

  it('frena ligeramente si el cliente va por delante', () => {
    const correction = decideCorrection({
      drift: 0.45,
      isPlaying: true,
      baseRate: 1,
      expected: 50,
    });
    expect(correction.kind).toBe('rate');
    if (correction.kind === 'rate') expect(correction.rate).toBeCloseTo(0.95, 5);
  });

  it('aplica el multiplicador sobre velocidades distintas de 1x', () => {
    const correction = decideCorrection({
      drift: -0.4,
      isPlaying: true,
      baseRate: 1.5,
      expected: 50,
    });
    if (correction.kind === 'rate') {
      expect(correction.rate).toBeCloseTo(1.575, 5);
      expect(correction.baseRate).toBe(1.5);
    } else {
      throw new Error('Se esperaba corrección de velocidad');
    }
  });

  it('cuando está pausado alinea exactamente si supera la tolerancia', () => {
    const correction = decideCorrection({
      drift: 0.2,
      isPlaying: false,
      baseRate: 1,
      expected: 75,
    });
    expect(correction).toMatchObject({ kind: 'seek', to: 75 });
  });

  it('cuando está pausado ignora desfases menores a 0.1 s', () => {
    const correction = decideCorrection({
      drift: 0.05,
      isPlaying: false,
      baseRate: 1,
      expected: 75,
    });
    expect(correction.kind).toBe('none');
  });
});

describe('versionado', () => {
  it('solo acepta versiones estrictamente mayores', () => {
    expect(shouldAcceptVersion(3, 4)).toBe(true);
    expect(shouldAcceptVersion(3, 3)).toBe(false);
    expect(shouldAcceptVersion(3, 2)).toBe(false);
  });
});

describe('clampPosition', () => {
  it('recorta al rango válido', () => {
    expect(clampPosition(-1)).toBe(0);
    expect(clampPosition(Number.NaN)).toBe(0);
    expect(clampPosition(10, 10)).toBeCloseTo(9.95, 5);
    expect(clampPosition(5, 10)).toBe(5);
  });
});

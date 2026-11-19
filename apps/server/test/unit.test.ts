import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

/**
 * Aísla los tests unitarios de la base de datos: la persistencia es un efecto
 * secundario del dominio y aquí solo verificamos permisos/versionado.
 */
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    room: { update: vi.fn().mockResolvedValue({}) },
    roomEvent: { create: vi.fn().mockResolvedValue({}) },
    participant: { update: vi.fn().mockResolvedValue({}), updateMany: vi.fn() },
  },
  pingDatabase: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

import { getEnv } from '../src/config/env';
import { limiters, sanitizeChatText, normalizeNickname } from '../src/lib/rateLimits';
import { randomRoomCode } from '../src/lib/roomCode';
import { signParticipantToken, verifyParticipantToken } from '../src/lib/tokens';
import { assertHost, play } from '../src/services/playbackService';
import type { LiveRoom } from '../src/services/roomStore';

const env = getEnv();

function buildRoom(): LiveRoom {
  return {
    id: 'room-1',
    code: 'ABC234',
    createdAt: Date.now(),
    isActive: true,
    playback: {
      videoUrl: null,
      videoType: 'mp4',
      position: 0,
      isPlaying: false,
      playbackRate: 1,
      updatedAt: Date.now(),
      version: 1,
      hostId: 'host-1',
    },
    participants: new Map(),
    hostGraceTimer: null,
    persistTimer: null,
    lastActivityAt: Date.now(),
  };
}

describe('permisos de host', () => {
  it('permite al host emitir comandos', () => {
    const room = buildRoom();
    const state = play(room, 'host-1', 42);
    expect(state.isPlaying).toBe(true);
    expect(state.position).toBe(42);
    expect(state.version).toBe(2);
  });

  it('rechaza comandos de un invitado', () => {
    const room = buildRoom();
    expect(() => play(room, 'guest-1', 10)).toThrowError(/Solo el host/);
    expect(room.playback.isPlaying).toBe(false);
    expect(room.playback.version).toBe(1);
  });

  it('assertHost lanza con código FORBIDDEN', () => {
    const room = buildRoom();
    try {
      assertHost(room, 'guest-1');
      throw new Error('No debería llegar aquí');
    } catch (error) {
      expect((error as { code?: string }).code).toBe('FORBIDDEN');
    }
  });
});

describe('tokens de participante', () => {
  it('firma y verifica', () => {
    const token = signParticipantToken({ pid: 'p1', rid: 'r1' }, env.TOKEN_SECRET);
    const payload = verifyParticipantToken(token, env.TOKEN_SECRET);
    expect(payload).toMatchObject({ v: 1, pid: 'p1', rid: 'r1' });
  });

  it('rechaza tokens manipulados', () => {
    const token = signParticipantToken({ pid: 'p1', rid: 'r1' }, env.TOKEN_SECRET);
    const [body, signature] = token.split('.');
    const tampered = `${body}.${String(signature).slice(0, -2)}aa`;
    expect(verifyParticipantToken(tampered, env.TOKEN_SECRET)).toBeNull();
  });

  it('rechaza tokens firmados con otro secreto', () => {
    const token = signParticipantToken(
      { pid: 'p1', rid: 'r1' },
      'otro-secreto-de-32-caracteres!!!!',
    );
    expect(verifyParticipantToken(token, env.TOKEN_SECRET)).toBeNull();
  });

  it('rechaza tokens caducados (más de 7 días)', () => {
    const token = signParticipantToken({ pid: 'p1', rid: 'r1' }, env.TOKEN_SECRET);
    const eightDays = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(verifyParticipantToken(token, env.TOKEN_SECRET, eightDays)).toBeNull();
  });

  it('rechaza formatos inválidos', () => {
    expect(verifyParticipantToken('nope', env.TOKEN_SECRET)).toBeNull();
    expect(verifyParticipantToken('a.b.c', env.TOKEN_SECRET)).toBeNull();
  });
});

describe('códigos de sala', () => {
  it('genera 6 caracteres del alfabeto permitido', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = randomRoomCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('no produce colisiones evidentes en 500 muestras', () => {
    const codes = new Set(Array.from({ length: 500 }, () => randomRoomCode()));
    expect(codes.size).toBeGreaterThan(495);
  });
});

describe('sanitizeChatText', () => {
  it('elimina caracteres de control y normaliza espacios', () => {
    expect(sanitizeChatText('  hola \u0007  mundo \n\n\n\n fin ')).toBe('hola mundo\n\nfin');
  });

  it('conserva texto normal y emojis', () => {
    expect(sanitizeChatText('Nos vemos <3 🍿')).toBe('Nos vemos <3 🍿');
  });

  it('recorta al máximo permitido', () => {
    expect(sanitizeChatText('a'.repeat(900))).toHaveLength(500);
  });

  it('normaliza el apodo', () => {
    expect(normalizeNickname('  Ana   María  ')).toBe('Ana María');
  });
});

describe('rate limiter', () => {
  it('bloquea tras agotar los puntos y se recupera', () => {
    limiters.chat.reset('test-key');
    for (let i = 0; i < 8; i += 1) {
      expect(limiters.chat.consume('test-key').allowed).toBe(true);
    }
    expect(limiters.chat.consume('test-key').allowed).toBe(false);
    limiters.chat.reset('test-key');
    expect(limiters.chat.consume('test-key').allowed).toBe(true);
  });
});

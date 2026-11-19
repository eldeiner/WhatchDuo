import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  PlayerSyncEvent,
  RoomStateEvent,
} from '@cineduo/shared';
import {
  connectSocket,
  emitAck,
  fetchJson,
  resetAll,
  startTestServer,
  waitFor,
  type TestServer,
} from './helpers';

let server: TestServer;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  await resetAll();
});

afterEach(() => {
  while (sockets.length > 0) sockets.pop()?.close();
});

async function createRoom(nickname: string, videoUrl?: string) {
  const { status, body } = await fetchJson<CreateRoomResponse>(`${server.baseUrl}/api/rooms`, {
    method: 'POST',
    body: JSON.stringify({ nickname, ...(videoUrl ? { videoUrl } : {}) }),
  });
  expect(status).toBe(201);
  return body;
}

async function joinRoom(code: string, nickname: string) {
  const { status, body } = await fetchJson<JoinRoomResponse>(
    `${server.baseUrl}/api/rooms/${code}/join`,
    { method: 'POST', body: JSON.stringify({ nickname }) },
  );
  expect(status).toBe(200);
  return body;
}

async function joinSocket(socket: Socket, code: string, token: string, nickname?: string) {
  const ack = await emitAck<{ ok: boolean; data: RoomStateEvent }>(socket, 'room:join', {
    code,
    token,
    ...(nickname ? { nickname } : {}),
  });
  expect(ack.ok).toBe(true);
  return ack.data;
}

describe('API REST', () => {
  it('responde al healthcheck', async () => {
    const { status, body } = await fetchJson(`${server.baseUrl}/api/health`);
    expect(status).toBe(200);
    expect(body.database).toBe('up');
    expect(body.status).toBe('ok');
  });

  it('crea una sala, la consulta y permite unirse', async () => {
    const created = await createRoom('Ana', 'https://cdn.example.com/peli.mp4');
    expect(created.roomCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.joinUrl).toContain(`/room/${created.roomCode}`);
    expect(created.participant.role).toBe('host');
    expect(created.participantToken.length).toBeGreaterThan(20);
    expect(created.playback.videoType).toBe('mp4');
    expect(created.playback.version).toBe(1);

    const publicRoom = await fetchJson(`${server.baseUrl}/api/rooms/${created.roomCode}`);
    expect(publicRoom.status).toBe(200);
    expect(publicRoom.body.room.code).toBe(created.roomCode);
    expect(publicRoom.body.playback.videoUrl).toBe('https://cdn.example.com/peli.mp4');

    const guest = await joinRoom(created.roomCode, 'Leo');
    expect(guest.participant.role).toBe('guest');
    expect(guest.participants).toHaveLength(2);
    expect(guest.participantToken).not.toBe(created.participantToken);

    const youtube = await createRoom('Ana', 'https://youtu.be/aqz-KE-bpKQ');
    expect(youtube.playback.videoType).toBe('youtube');
    const vimeo = await createRoom('Ana', 'https://vimeo.com/76979871');
    expect(vimeo.playback.videoType).toBe('vimeo');
  });

  it('valida los datos con errores consistentes', async () => {
    const invalid = await fetchJson(`${server.baseUrl}/api/rooms`, {
      method: 'POST',
      body: JSON.stringify({ nickname: 'A' }),
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const drm = await fetchJson(`${server.baseUrl}/api/rooms`, {
      method: 'POST',
      body: JSON.stringify({ nickname: 'Ana', videoUrl: 'https://www.netflix.com/watch/123' }),
    });
    expect(drm.status).toBe(422);
    expect(drm.body.error.message).toContain('DRM');

    const missing = await fetchJson(`${server.baseUrl}/api/rooms/ZZZZZZ`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('protege el historial de mensajes con token de la sala', async () => {
    const created = await createRoom('Ana');
    const noToken = await fetchJson(`${server.baseUrl}/api/rooms/${created.roomCode}/messages`);
    expect(noToken.status).toBe(401);

    const ok = await fetchJson(`${server.baseUrl}/api/rooms/${created.roomCode}/messages`, {
      headers: { authorization: `Bearer ${created.participantToken}` },
    });
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body.messages)).toBe(true);
  });
});

describe('sincronización por WebSocket', () => {
  it('el host controla y el invitado recibe el mismo estado', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');

    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);

    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    // play
    const syncAfterPlay = waitFor<PlayerSyncEvent>(
      guest,
      'player:sync',
      (payload) => payload.isPlaying,
    );
    const playAck = await emitAck<{ ok: boolean; data: { version: number } }>(host, 'player:play', {
      position: 12.5,
      clientSeq: 1,
    });
    expect(playAck.ok).toBe(true);
    const playSync = await syncAfterPlay;
    expect(playSync.position).toBeCloseTo(12.5, 2);
    expect(playSync.playbackRate).toBe(1);
    expect(playSync.by).toBe(created.participant.id);

    // pause
    const syncAfterPause = waitFor<PlayerSyncEvent>(
      guest,
      'player:sync',
      (payload) => !payload.isPlaying,
    );
    await emitAck(host, 'player:pause', { position: 20, clientSeq: 2 });
    const pauseSync = await syncAfterPause;
    expect(pauseSync.position).toBeCloseTo(20, 2);
    expect(pauseSync.version).toBeGreaterThan(playSync.version);

    // seek
    const syncAfterSeek = waitFor<PlayerSyncEvent>(
      guest,
      'player:sync',
      (payload) => Math.abs(payload.position - 90) < 0.01,
    );
    await emitAck(host, 'player:seek', { position: 90, clientSeq: 3 });
    const seekSync = await syncAfterSeek;
    expect(seekSync.isPlaying).toBe(false);
    expect(seekSync.version).toBeGreaterThan(pauseSync.version);

    // rate
    const syncAfterRate = waitFor<PlayerSyncEvent>(
      guest,
      'player:sync',
      (payload) => payload.playbackRate === 1.5,
    );
    await emitAck(host, 'player:rate', { rate: 1.5, position: 91, clientSeq: 4 });
    const rateSync = await syncAfterRate;
    expect(rateSync.position).toBeCloseTo(91, 2);
  });

  it('rechaza comandos de reproducción de un invitado', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    const ack = await emitAck<{ ok: boolean; error?: { code: string } }>(guest, 'player:play', {
      position: 5,
      clientSeq: 1,
    });
    expect(ack.ok).toBe(false);
    expect(ack.error?.code).toBe('FORBIDDEN');

    const publicRoom = await fetchJson(`${server.baseUrl}/api/rooms/${created.roomCode}`);
    expect(publicRoom.body.playback.isPlaying).toBe(false);
    expect(publicRoom.body.playback.version).toBe(1);
  });

  it('corrige la posición con el heartbeat del host', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);
    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    await emitAck(host, 'player:play', { position: 10, clientSeq: 1 });

    // El host dice ir por el segundo 500: desfase enorme, el servidor re-ancla.
    const correction = waitFor<PlayerSyncEvent>(
      guest,
      'player:sync',
      (payload) => payload.reason === 'heartbeat',
    );
    host.emit('player:heartbeat', {
      position: 500,
      isPlaying: true,
      clientTime: Date.now(),
      clientSeq: 2,
    });
    const sync = await correction;
    expect(sync.position).toBe(500);
    expect(sync.reason).toBe('heartbeat');
  });

  it('ignora heartbeats de invitados sin afectar la versión', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    guest.emit('player:heartbeat', {
      position: 300,
      isPlaying: true,
      clientTime: Date.now(),
      clientSeq: 9,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    const publicRoom = await fetchJson(`${server.baseUrl}/api/rooms/${created.roomCode}`);
    expect(publicRoom.body.playback.position).toBe(0);
    expect(publicRoom.body.playback.version).toBe(1);
  });
});

describe('chat, presencia y reloj', () => {
  it('entrega mensajes saneados en ambos sentidos y persiste historial', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);
    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    const inbound = waitFor<{ message: { text: string; nickname: string } }>(host, 'chat:message');
    const ack = await emitAck<{ ok: boolean; data: { text: string } }>(guest, 'chat:send', {
      text: '  Hola   Ana 👋  ',
    });
    expect(ack.ok).toBe(true);
    expect(ack.data.text).toBe('Hola Ana 👋');
    const received = await inbound;
    expect(received.message.nickname).toBe('Leo');

    const response = await fetchJson(`${server.baseUrl}/api/rooms/${created.roomCode}/messages`, {
      headers: { authorization: `Bearer ${guestRest.participantToken}` },
    });
    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.messages[0].text).toBe('Hola Ana 👋');

    const tooLong = await emitAck<{ ok: boolean; error?: { code: string } }>(guest, 'chat:send', {
      text: 'x'.repeat(501),
    });
    expect(tooLong.ok).toBe(false);
    expect(tooLong.error?.code).toBe('VALIDATION_ERROR');
  });

  it('emite reacciones y notifica buffering', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);
    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    const reaction = waitFor<{ reaction: { emoji: string; nickname: string } }>(
      host,
      'chat:reaction',
    );
    guest.emit('chat:reaction', { emoji: '🍿' });
    expect((await reaction).reaction).toMatchObject({ emoji: '🍿', nickname: 'Leo' });

    const buffering = waitFor<{ nickname: string; isBuffering: boolean }>(host, 'peer:buffering');
    guest.emit('player:buffering', { isBuffering: true });
    expect(await buffering).toMatchObject({ nickname: 'Leo', isBuffering: true });
  });

  it('responde al ping con el reloj del servidor', async () => {
    const created = await createRoom('Ana');
    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);

    const clientTime = Date.now();
    const pongPromise = waitFor<{ clientTime: number; serverTime: number; protocol: number }>(
      host,
      'pong',
    );
    host.emit('ping', { clientTime });
    const pong = await pongPromise;
    expect(pong.clientTime).toBe(clientTime);
    expect(Math.abs(pong.serverTime - Date.now())).toBeLessThan(2000);
    expect(pong.protocol).toBe(1);
  });

  it('marca presencia al desconectar', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);
    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    const leftPromise = waitFor<{ participantId: string }>(host, 'participant:left');
    guest.close();
    const left = await leftPromise;
    expect(left.participantId).toBe(guestRest.participant.id);

    await new Promise((resolve) => setTimeout(resolve, 100));
    const publicRoom = await fetchJson(`${server.baseUrl}/api/rooms/${created.roomCode}`);
    const disconnected = publicRoom.body.participants.find(
      (p: { nickname: string }) => p.nickname === 'Leo',
    );
    expect(disconnected.isConnected).toBe(false);
  });
});

describe('host y reconexión', () => {
  it('transfiere el control y el nuevo host puede reproducir', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);
    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    const changed = waitFor<{ hostId: string; by: string }>(guest, 'host:changed');
    const ack = await emitAck<{ ok: boolean }>(host, 'host:transfer', {
      targetParticipantId: guestRest.participant.id,
    });
    expect(ack.ok).toBe(true);
    const hostChanged = await changed;
    expect(hostChanged).toMatchObject({ hostId: guestRest.participant.id, by: 'transfer' });

    const oldHostAck = await emitAck<{ ok: boolean; error?: { code: string } }>(
      host,
      'player:play',
      { position: 1, clientSeq: 2 },
    );
    expect(oldHostAck.ok).toBe(false);
    expect(oldHostAck.error?.code).toBe('FORBIDDEN');

    const newHostAck = await emitAck<{ ok: boolean }>(guest, 'player:play', {
      position: 1,
      clientSeq: 3,
    });
    expect(newHostAck.ok).toBe(true);
  });

  it('recupera el estado al reconectarse con el token', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);
    const guest1 = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest1);
    await joinSocket(guest1, created.roomCode, guestRest.participantToken);

    await emitAck(host, 'player:play', { position: 30, clientSeq: 1 });
    guest1.close();
    await waitFor(host, 'participant:left');

    const guest2 = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest2);
    const state = await joinSocket(guest2, created.roomCode, guestRest.participantToken);
    expect(state.playback.isPlaying).toBe(true);
    expect(state.playback.position).toBeCloseTo(30, 2);
    expect(state.participants.find((p) => p.nickname === 'Leo')?.isConnected).toBe(true);
  });

  it('promueve a un invitado cuando el host no vuelve en el plazo', async () => {
    const created = await createRoom('Ana');
    const guestRest = await joinRoom(created.roomCode, 'Leo');
    const host = await connectSocket(server.baseUrl, created.participantToken);
    sockets.push(host);
    await joinSocket(host, created.roomCode, created.participantToken);
    const guest = await connectSocket(server.baseUrl, guestRest.participantToken);
    sockets.push(guest);
    await joinSocket(guest, created.roomCode, guestRest.participantToken);

    const changed = waitFor<{ hostId: string; by: string }>(
      guest,
      'host:changed',
      (payload) => payload.by === 'timeout',
      5000,
    );
    host.close();
    const promoted = await changed;
    expect(promoted.hostId).toBe(guestRest.participant.id);

    // El invitado promovido ya puede controlar.
    const ack = await emitAck<{ ok: boolean }>(guest, 'player:play', {
      position: 4,
      clientSeq: 10,
    });
    expect(ack.ok).toBe(true);
  });
});

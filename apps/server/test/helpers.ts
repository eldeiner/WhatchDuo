import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createCineServer } from '../src/server';
import { prisma } from '../src/lib/prisma';
import { resetLimiters } from '../src/lib/rateLimits';
import { clearLiveRooms } from '../src/services/roomStore';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const { httpServer, io } = createCineServer();
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
      clearLiveRooms();
    },
  };
}

export async function connectSocket(baseUrl: string, token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5000,
      auth: token ? { token } : {},
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Timeout conectando el socket'));
    }, 6000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export function waitFor<T = unknown>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout esperando "${event}"`));
    }, timeoutMs);

    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

export function emitAck<T = unknown>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout en ack de "${event}"`)), timeoutMs);
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export async function fetchJson<T = any>(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as T;
  return { status: response.status, body };
}

export async function resetAll(): Promise<void> {
  clearLiveRooms();
  // Deja terminar eventos de auditoría en vuelo antes de borrar filas.
  await new Promise((resolve) => setTimeout(resolve, 120));
  await prisma.message.deleteMany();
  await prisma.roomEvent.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.room.deleteMany();
  resetLimiters();
}

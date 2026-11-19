import type {
  CreateRoomResponse,
  JoinRoomResponse,
  MessagesResponse,
  PublicRoomResponse,
} from '@cineduo/shared';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export function socketUrl(): string {
  if (BASE_URL) return BASE_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Revisa tu conexión.',
      'NETWORK_ERROR',
      0,
    );
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      error?.message ?? 'Ha ocurrido un error inesperado',
      error?.code ?? 'INTERNAL_ERROR',
      response.status,
    );
  }

  return data as T;
}

export function createRoomRequest(input: { nickname: string; videoUrl?: string }) {
  return request<CreateRoomResponse>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function joinRoomRequest(code: string, nickname: string) {
  return request<JoinRoomResponse>(`/api/rooms/${code}/join`, {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  });
}

export function getRoomRequest(code: string) {
  return request<PublicRoomResponse>(`/api/rooms/${code}`);
}

export function getMessagesRequest(code: string, token: string) {
  return request<MessagesResponse>(`/api/rooms/${code}/messages?limit=100`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

export function getHealth() {
  return request<{ status: string; database: string }>('/api/health');
}

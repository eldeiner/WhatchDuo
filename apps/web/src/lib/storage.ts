const NICKNAME_KEY = 'cineduo:nickname';
const TOKEN_PREFIX = 'cineduo:token:';
const LAST_ROOM_KEY = 'cineduo:last-room';

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* modo privado / cuota llena: la app sigue funcionando en memoria */
  }
}

export function getStoredNickname(): string {
  return safeGet(NICKNAME_KEY) ?? '';
}

export function setStoredNickname(nickname: string): void {
  safeSet(NICKNAME_KEY, nickname.trim());
}

export function getRoomToken(code: string): string | null {
  return safeGet(`${TOKEN_PREFIX}${code.toUpperCase()}`);
}

export function setRoomToken(code: string, token: string): void {
  safeSet(`${TOKEN_PREFIX}${code.toUpperCase()}`, token);
  safeSet(LAST_ROOM_KEY, code.toUpperCase());
}

export function clearRoomToken(code: string): void {
  safeSet(`${TOKEN_PREFIX}${code.toUpperCase()}`, null);
}

export function getLastRoom(): string | null {
  return safeGet(LAST_ROOM_KEY);
}

/** Extrae el participantId del token firmado (el payload no es secreto). */
export function participantIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const body = token.split('.')[0];
  if (!body) return null;
  try {
    const normalized = body.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as { pid?: unknown };
    return typeof decoded.pid === 'string' ? decoded.pid : null;
  } catch {
    return null;
  }
}

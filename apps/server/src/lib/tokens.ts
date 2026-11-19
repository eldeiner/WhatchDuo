import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ParticipantTokenPayload {
  /** Versión del token. */
  v: 1;
  /** participantId */
  pid: string;
  /** roomId */
  rid: string;
  /** emitido en (epoch ms) */
  iat: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/**
 * Token opaco con payload firmado (HMAC-SHA256). No contiene el rol: el rol se
 * lee siempre de la base de datos, de modo que una transferencia de host no
 * requiere reemitir tokens.
 */
export function signParticipantToken(
  payload: Omit<ParticipantTokenPayload, 'v' | 'iat'>,
  secret: string,
): string {
  const full: ParticipantTokenPayload = { v: 1, ...payload, iat: Date.now() };
  const body = base64UrlEncode(JSON.stringify(full));
  const signature = sign(body, secret);
  return `${body}.${signature}`;
}

export function verifyParticipantToken(
  token: string,
  secret: string,
  now = Date.now(),
): ParticipantTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(body).toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const payload = parsed as ParticipantTokenPayload;
    if (payload.v !== 1) return null;
    if (typeof payload.pid !== 'string' || typeof payload.rid !== 'string') return null;
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) return null;
    // Los tokens de sala caducan a los 7 días.
    if (now - payload.iat > 7 * 24 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

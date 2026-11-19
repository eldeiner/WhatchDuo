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
/**
 * Token opaco con payload firmado (HMAC-SHA256). No contiene el rol: el rol se
 * lee siempre de la base de datos, de modo que una transferencia de host no
 * requiere reemitir tokens.
 */
export declare function signParticipantToken(payload: Omit<ParticipantTokenPayload, 'v' | 'iat'>, secret: string): string;
export declare function verifyParticipantToken(token: string, secret: string, now?: number): ParticipantTokenPayload | null;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signParticipantToken = signParticipantToken;
exports.verifyParticipantToken = verifyParticipantToken;
const node_crypto_1 = require("node:crypto");
function base64UrlEncode(input) {
    return Buffer.from(input).toString('base64url');
}
function base64UrlDecode(input) {
    return Buffer.from(input, 'base64url');
}
function sign(data, secret) {
    return (0, node_crypto_1.createHmac)('sha256', secret).update(data).digest('base64url');
}
/**
 * Token opaco con payload firmado (HMAC-SHA256). No contiene el rol: el rol se
 * lee siempre de la base de datos, de modo que una transferencia de host no
 * requiere reemitir tokens.
 */
function signParticipantToken(payload, secret) {
    const full = { v: 1, ...payload, iat: Date.now() };
    const body = base64UrlEncode(JSON.stringify(full));
    const signature = sign(body, secret);
    return `${body}.${signature}`;
}
function verifyParticipantToken(token, secret, now = Date.now()) {
    const parts = token.split('.');
    if (parts.length !== 2)
        return null;
    const [body, signature] = parts;
    if (!body || !signature)
        return null;
    const expected = sign(body, secret);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !(0, node_crypto_1.timingSafeEqual)(a, b))
        return null;
    try {
        const parsed = JSON.parse(base64UrlDecode(body).toString('utf8'));
        if (!parsed || typeof parsed !== 'object')
            return null;
        const payload = parsed;
        if (payload.v !== 1)
            return null;
        if (typeof payload.pid !== 'string' || typeof payload.rid !== 'string')
            return null;
        if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat))
            return null;
        // Los tokens de sala caducan a los 7 días.
        if (now - payload.iat > 7 * 24 * 60 * 60 * 1000)
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=tokens.js.map
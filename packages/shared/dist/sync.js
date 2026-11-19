"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectedPosition = expectedPosition;
exports.computeDrift = computeDrift;
exports.shouldAcceptVersion = shouldAcceptVersion;
exports.decideCorrection = decideCorrection;
exports.clampRate = clampRate;
exports.clampPosition = clampPosition;
exports.positionsDiffer = positionsDiffer;
const constants_1 = require("./constants");
/** Posición esperada según el reloj del servidor. */
function expectedPosition(state, serverNow) {
    const base = Math.max(0, state.position);
    if (!state.isPlaying)
        return base;
    // Un updatedAt en el futuro (reloj movido) no debe restar tiempo.
    const elapsedSeconds = Math.max(0, serverNow - state.updatedAt) / 1000;
    return base + elapsedSeconds * Math.max(0, state.playbackRate);
}
function computeDrift(localPosition, expected) {
    return localPosition - expected;
}
function shouldAcceptVersion(localVersion, incomingVersion) {
    return incomingVersion > localVersion;
}
/**
 * Decide la corrección a aplicar en el cliente.
 *
 * - Pausado: alinear si el desfase supera la tolerancia (seek exacto).
 * - |drift| >= 0.75 s: seek directo a la posición esperada.
 * - 0.3 s <= |drift| < 0.75 s: velocidad +5% / -5% durante 2 s.
 * - Resto: nada.
 *
 * `drift > 0` significa que el cliente va por delante del servidor.
 */
function decideCorrection(params) {
    const { drift, isPlaying, baseRate, expected } = params;
    const magnitude = Math.abs(drift);
    if (!isPlaying) {
        if (magnitude > constants_1.SYNC.pausedTolerance) {
            return { kind: 'seek', expected, drift, to: expected };
        }
        return { kind: 'none', expected, drift };
    }
    if (magnitude >= constants_1.SYNC.hardSeekThreshold) {
        return { kind: 'seek', expected, drift, to: expected };
    }
    if (magnitude >= constants_1.SYNC.softSyncThreshold) {
        const multiplier = drift > 0 ? constants_1.SYNC.softRateDown : constants_1.SYNC.softRateUp;
        const rate = clampRate(baseRate * multiplier);
        return {
            kind: 'rate',
            expected,
            drift,
            rate,
            baseRate,
            revertAfterMs: constants_1.SYNC.softSyncDurationMs,
        };
    }
    return { kind: 'none', expected, drift };
}
/** hls.js y HTMLMediaElement aceptan un rango amplio, pero limitamos por seguridad. */
function clampRate(rate) {
    if (!Number.isFinite(rate))
        return 1;
    return Math.min(4, Math.max(0.25, Math.round(rate * 1000) / 1000));
}
function clampPosition(position, duration) {
    if (!Number.isFinite(position) || position < 0)
        return 0;
    if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
        return Math.min(position, Math.max(0, duration - 0.05));
    }
    return position;
}
/** Distancia mínima entre dos posiciones para considerar un cambio real. */
function positionsDiffer(a, b, tolerance = 0.15) {
    return Math.abs(a - b) > tolerance;
}
//# sourceMappingURL=sync.js.map
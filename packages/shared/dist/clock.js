"use strict";
/**
 * Sincronización de reloj estilo NTP simplificado.
 *
 * t0 = reloj local al enviar
 * t1 = reloj del servidor al recibir/responder
 * t2 = reloj local al recibir la respuesta
 *
 * offset = t1 - (t0 + t2) / 2
 * rtt    = t2 - t0
 *
 * Se toman varias muestras y se usa la mediana de las de menor RTT para
 * reducir el impacto de picos de latencia.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleFromPong = sampleFromPong;
exports.median = median;
exports.estimateOffset = estimateOffset;
exports.keepRecentSamples = keepRecentSamples;
exports.serverNowFrom = serverNowFrom;
exports.localTimeFrom = localTimeFrom;
exports.formatTime = formatTime;
function sampleFromPong(clientSentAt, serverTime, receivedAt) {
    const rtt = Math.max(0, receivedAt - clientSentAt);
    const offset = serverTime - (clientSentAt + receivedAt) / 2;
    return { offset, rtt, at: receivedAt };
}
function median(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1)
        return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
}
/**
 * Selecciona las `keep` muestras con menor RTT y devuelve la mediana de sus
 * offsets. Filtrar por RTT bajo evita que una petición lenta contamine el reloj.
 */
function estimateOffset(samples, keep = 3) {
    if (samples.length === 0)
        return { offset: 0, rtt: 0, used: 0 };
    const best = [...samples].sort((a, b) => a.rtt - b.rtt).slice(0, Math.max(1, keep));
    return {
        offset: median(best.map((s) => s.offset)),
        rtt: median(best.map((s) => s.rtt)),
        used: best.length,
    };
}
function keepRecentSamples(samples, limit) {
    return samples.length <= limit ? samples : samples.slice(samples.length - limit);
}
function serverNowFrom(localNow, offset) {
    return localNow + offset;
}
function localTimeFrom(serverTime, offset) {
    return serverTime - offset;
}
/** Formatea segundos como m:ss (o h:mm:ss). */
function formatTime(totalSeconds) {
    const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const s = Math.floor(safe % 60);
    const m = Math.floor((safe / 60) % 60);
    const h = Math.floor(safe / 3600);
    const pad = (n) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
//# sourceMappingURL=clock.js.map
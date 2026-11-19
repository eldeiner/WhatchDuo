"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertHost = assertHost;
exports.play = play;
exports.pause = pause;
exports.seek = seek;
exports.setRate = setRate;
exports.setVideo = setVideo;
exports.applyHeartbeat = applyHeartbeat;
exports.snapshot = snapshot;
const shared_1 = require("@cineduo/shared");
const errors_1 = require("../lib/errors");
const roomService_1 = require("./roomService");
const mediaExtractor_1 = require("./mediaExtractor");
/** Verdad del servidor: solo el host puede mutar la reproducción. */
function assertHost(room, participantId) {
    if (!room.playback.hostId || room.playback.hostId !== participantId) {
        throw new errors_1.AppError('FORBIDDEN', 'Solo el host controla la reproducción', 403);
    }
}
function commit(room, patch, options = {}) {
    const { bumpVersion = true } = options;
    const now = Date.now();
    room.playback = {
        ...room.playback,
        ...patch,
        updatedAt: now,
        version: bumpVersion ? room.playback.version + 1 : room.playback.version,
    };
    room.lastActivityAt = now;
    (0, roomService_1.schedulePersist)(room);
    return { ...room.playback };
}
function play(room, participantId, position) {
    assertHost(room, participantId);
    const state = commit(room, { position: (0, shared_1.clampPosition)(position), isPlaying: true });
    (0, roomService_1.recordEvent)(room, 'player:play', participantId, {
        position: state.position,
        version: state.version,
    });
    return state;
}
function pause(room, participantId, position) {
    assertHost(room, participantId);
    const state = commit(room, { position: (0, shared_1.clampPosition)(position), isPlaying: false });
    (0, roomService_1.recordEvent)(room, 'player:pause', participantId, {
        position: state.position,
        version: state.version,
    });
    return state;
}
function seek(room, participantId, position) {
    assertHost(room, participantId);
    const state = commit(room, { position: (0, shared_1.clampPosition)(position) });
    (0, roomService_1.recordEvent)(room, 'player:seek', participantId, {
        position: state.position,
        version: state.version,
    });
    return state;
}
function setRate(room, participantId, rate, position) {
    assertHost(room, participantId);
    // Re-anclar: si el host no envía posición, usamos la esperada en este instante.
    const anchor = position ?? (0, shared_1.expectedPosition)(room.playback, Date.now());
    const state = commit(room, { position: (0, shared_1.clampPosition)(anchor), playbackRate: rate });
    (0, roomService_1.recordEvent)(room, 'player:rate', participantId, { rate, version: state.version });
    return state;
}
async function setVideo(room, participantId, videoUrl) {
    assertHost(room, participantId);
    let finalUrl = videoUrl;
    let finalType = (0, shared_1.detectVideoType)(videoUrl);
    const extracted = await (0, mediaExtractor_1.extractMediaSource)(videoUrl);
    if (extracted) {
        finalUrl = extracted.streamUrl;
        finalType = extracted.type;
    }
    // El tipo se deriva siempre de la URL en el servidor: el cliente no puede
    // forzar, por ejemplo, un `mp4` sobre un enlace de YouTube.
    const state = commit(room, {
        videoUrl: finalUrl,
        videoType: finalType,
        position: 0,
        isPlaying: false,
        playbackRate: 1,
    });
    (0, roomService_1.recordEvent)(room, 'player:video', participantId, {
        videoUrl: finalUrl,
        videoType: state.videoType,
        version: state.version,
    });
    return state;
}
/**
 * El host envía cada ~4 s su posición real. Si difiere de la predicción del
 * servidor más de `SYNC.heartbeatTolerance`, el servidor re-ancla el estado
 * (por ejemplo, tras un buffering largo) y emite un `player:sync`.
 * Si no, no se incrementa la versión para no inundar a los invitados.
 */
function applyHeartbeat(room, participantId, input) {
    if (room.playback.hostId !== participantId) {
        return { corrected: false, drift: 0, playback: { ...room.playback }, ignored: true };
    }
    const now = Date.now();
    const predicted = (0, shared_1.expectedPosition)(room.playback, now);
    const drift = (0, shared_1.computeDrift)((0, shared_1.clampPosition)(input.position), predicted);
    const stateMismatch = input.isPlaying !== room.playback.isPlaying;
    if (!stateMismatch && Math.abs(drift) <= shared_1.SYNC.heartbeatTolerance) {
        return { corrected: false, drift, playback: { ...room.playback }, ignored: false };
    }
    const state = commit(room, {
        position: (0, shared_1.clampPosition)(input.position),
        isPlaying: input.isPlaying,
    });
    (0, roomService_1.recordEvent)(room, 'player:heartbeat-correct', participantId, {
        drift: Number(drift.toFixed(3)),
        version: state.version,
    });
    return { corrected: true, drift, playback: state, ignored: false };
}
function snapshot(room) {
    return { ...room.playback };
}
//# sourceMappingURL=playbackService.js.map
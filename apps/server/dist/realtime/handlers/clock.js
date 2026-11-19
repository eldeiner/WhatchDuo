"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClockHandlers = registerClockHandlers;
exports.registerWebRtcHandlers = registerWebRtcHandlers;
const shared_1 = require("@cineduo/shared");
const rateLimits_1 = require("../../lib/rateLimits");
const context_1 = require("../context");
const emit_1 = require("../emit");
function registerClockHandlers(_io, socket) {
    socket.on('ping', (payload) => {
        // No respondemos si se supera el límite: el cliente simplemente descarta
        // esa muestra de reloj.
        if (!rateLimits_1.limiters.ping.consume(socket.id).allowed)
            return;
        const parsed = shared_1.pingPayloadSchema.safeParse(payload);
        if (!parsed.success)
            return;
        socket.emit('pong', {
            clientTime: parsed.data.clientTime,
            serverTime: Date.now(),
            protocol: shared_1.PROTOCOL_VERSION,
        });
    });
}
function registerWebRtcHandlers(_io, socket) {
    socket.on('webrtc:signal', (payload) => {
        try {
            const { room } = (0, context_1.socketContext)(socket);
            const data = (0, context_1.parsePayload)(shared_1.webrtcSignalSchema, payload);
            const target = room.participants.get(data.targetId);
            if (!target?.socketId)
                return;
            // Reenvío ciego entre participantes de la misma sala (compartir pantalla
            // es una extensión fuera del MVP; no hay lógica de señalización aquí).
            _io.to(target.socketId).emit('webrtc:signal', {
                fromId: socket.data.participantId ?? '',
                data: data.data,
            });
        }
        catch (error) {
            (0, emit_1.emitErrorToSocket)(socket, error, 'webrtc:signal');
        }
    });
}
//# sourceMappingURL=clock.js.map
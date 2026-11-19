"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRealtime = createRealtime;
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const handlers_1 = require("../realtime/handlers");
const presence_1 = require("../realtime/presence");
function createRealtime(httpServer) {
    const env = (0, env_1.getEnv)();
    const io = new socket_io_1.Server(httpServer, {
        path: '/socket.io',
        cors: {
            origin: (0, env_1.corsOrigins)(env),
            methods: ['GET', 'POST'],
            credentials: false,
        },
        transports: ['websocket', 'polling'],
        pingInterval: 25_000,
        pingTimeout: 20_000,
        maxHttpBufferSize: 64 * 1024,
        connectTimeout: 10_000,
    });
    io.on('connection', (socket) => {
        logger_1.logger.debug('socket_connected', {
            socketId: socket.id,
            transport: socket.conn.transport.name,
        });
        (0, handlers_1.registerHandlers)(io, socket);
        socket.on('disconnect', (reason) => {
            void (0, presence_1.detachParticipant)(io, socket, 'disconnect').catch((error) => {
                logger_1.logger.error('disconnect_handler_failed', { error: error.message });
            });
            logger_1.logger.debug('socket_disconnected', { socketId: socket.id, reason });
        });
    });
    return io;
}
//# sourceMappingURL=io.js.map
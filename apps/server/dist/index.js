"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const logger_1 = require("./lib/logger");
const prisma_1 = require("./lib/prisma");
const server_1 = require("./server");
const roomStore_1 = require("./services/roomStore");
const roomService_1 = require("./services/roomService");
async function main() {
    const env = (0, env_1.getEnv)();
    if (env.NODE_ENV === 'production' && env.TOKEN_SECRET.includes('dev-only')) {
        throw new Error('TOKEN_SECRET de desarrollo detectado en producción. Configura uno seguro.');
    }
    if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.includes('localhost')) {
        logger_1.logger.warn('cors_localhost_in_production', { origins: env.CORS_ORIGINS });
    }
    await (0, roomService_1.resetStalePresence)().catch((error) => {
        logger_1.logger.warn('presence_reset_failed', { error: error.message });
    });
    const { httpServer, io } = (0, server_1.createCineServer)();
    httpServer.listen(env.PORT, env.HOST, () => {
        logger_1.logger.info('server_started', {
            port: env.PORT,
            host: env.HOST,
            env: env.NODE_ENV,
            webOrigin: env.WEB_ORIGIN,
        });
    });
    const sweepTimer = setInterval(() => {
        void (0, roomService_1.sweepRooms)()
            .then((closed) => {
            if (closed > 0)
                logger_1.logger.info('rooms_swept', { closed });
        })
            .catch((error) => {
            logger_1.logger.warn('rooms_sweep_failed', { error: error.message });
        });
    }, 5 * 60_000);
    sweepTimer.unref();
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        logger_1.logger.info('shutdown_started', { signal });
        clearInterval(sweepTimer);
        await Promise.all((0, roomStore_1.allLiveRooms)().map((room) => (0, roomService_1.flushPlayback)(room).catch(() => undefined)));
        await new Promise((resolve) => {
            io.close(() => resolve());
        });
        await new Promise((resolve) => {
            httpServer.close(() => resolve());
        });
        await (0, prisma_1.disconnectPrisma)().catch(() => undefined);
        logger_1.logger.info('shutdown_complete');
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error('unhandled_rejection', { reason: String(reason) });
    });
}
main().catch((error) => {
    logger_1.logger.error('fatal_startup_error', { error: error.message });
    process.exit(1);
});
//# sourceMappingURL=index.js.map
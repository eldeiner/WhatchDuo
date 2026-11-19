"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.pingDatabase = pingDatabase;
exports.disconnectPrisma = disconnectPrisma;
const client_1 = require("@prisma/client");
const env_1 = require("../config/env");
const logger_1 = require("./logger");
const env = (0, env_1.getEnv)();
exports.prisma = new client_1.PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
async function pingDatabase() {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        logger_1.logger.error('database_ping_failed', { error: error.message });
        return false;
    }
}
async function disconnectPrisma() {
    await exports.prisma.$disconnect();
}
//# sourceMappingURL=prisma.js.map
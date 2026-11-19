"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = healthRouter;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
function healthRouter() {
    const router = (0, express_1.Router)();
    router.get('/health', (0, http_1.asyncHandler)(async (_req, res) => {
        const database = await (0, prisma_1.pingDatabase)();
        const body = {
            status: database ? 'ok' : 'degraded',
            uptimeSeconds: Math.round(process.uptime()),
            database: database ? 'up' : 'down',
            version: '0.1.0',
            serverTime: Date.now(),
        };
        res.status(database ? 200 : 503).json(body);
    }));
    return router;
}
//# sourceMappingURL=health.js.map
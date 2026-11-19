"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const node_crypto_1 = require("node:crypto");
const env_1 = require("./config/env");
const errors_1 = require("./lib/errors");
const logger_1 = require("./lib/logger");
const health_1 = require("./routes/health");
const proxy_1 = require("./routes/proxy");
const rooms_1 = require("./routes/rooms");
function createApp() {
    const env = (0, env_1.getEnv)();
    const app = (0, express_1.default)();
    const allowedOrigins = new Set((0, env_1.corsOrigins)(env));
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginEmbedderPolicy: false,
    }));
    app.use((0, cors_1.default)({
        origin(origin, callback) {
            // Sin Origin (curl, healthchecks, apps nativas) se permite.
            if (!origin || allowedOrigins.has(origin))
                return callback(null, true);
            return callback(new Error('Origen no permitido por CORS'));
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400,
    }));
    app.use(express_1.default.json({ limit: '32kb' }));
    app.use((req, res, next) => {
        const requestId = (0, node_crypto_1.randomUUID)();
        res.setHeader('x-request-id', requestId);
        const startedAt = Date.now();
        res.on('finish', () => {
            if (req.path === '/api/health')
                return;
            logger_1.logger.info('http_request', {
                requestId,
                method: req.method,
                path: req.path,
                status: res.statusCode,
                durationMs: Date.now() - startedAt,
            });
        });
        next();
    });
    app.use('/api', (0, health_1.healthRouter)());
    app.use('/api', (0, proxy_1.proxyRouter)());
    app.use('/api', (0, rooms_1.roomsRouter)());
    app.use((_req, res) => {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
    });
    app.use(errors_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map
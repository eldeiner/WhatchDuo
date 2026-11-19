"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = getEnv;
exports.corsOrigins = corsOrigins;
exports.isProd = isProd;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    HOST: zod_1.z.string().default('0.0.0.0'),
    DATABASE_URL: zod_1.z.string().min(1).default('file:./prisma/dev.db'),
    TOKEN_SECRET: zod_1.z.string().min(16).default('dev-only-secret-change-me-please-32ch'),
    WEB_ORIGIN: zod_1.z.string().url().default('http://localhost:3000'),
    CORS_ORIGINS: zod_1.z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
    LOG_LEVEL: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    HOST_DISCONNECT_GRACE_MS: zod_1.z.coerce.number().int().min(100).default(30_000),
    MAX_PARTICIPANTS: zod_1.z.coerce.number().int().min(2).max(10).default(4),
});
let cached = null;
function getEnv() {
    if (cached)
        return cached;
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new Error(`Configuración de entorno inválida: ${issues}`);
    }
    cached = parsed.data;
    return cached;
}
function corsOrigins(env) {
    return env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}
function isProd(env) {
    return env.NODE_ENV === 'production';
}
//# sourceMappingURL=env.js.map
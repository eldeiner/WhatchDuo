import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).default('file:./prisma/dev.db'),
  TOKEN_SECRET: z.string().min(16).default('dev-only-secret-change-me-please-32ch'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  HOST_DISCONNECT_GRACE_MS: z.coerce.number().int().min(100).default(30_000),
  MAX_PARTICIPANTS: z.coerce.number().int().min(2).max(10).default(4),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Configuración de entorno inválida: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isProd(env: Env): boolean {
  return env.NODE_ENV === 'production';
}

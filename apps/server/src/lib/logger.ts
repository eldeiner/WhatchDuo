import type { Env } from '../config/env';
import { getEnv } from '../config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const env: Env = getEnv();
const threshold = ORDER[env.LOG_LEVEL];

/** Log estructurado en una línea, sin secretos ni tokens. */
function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  if (ORDER[level] < threshold) return;
  const entry = {
    level,
    time: new Date().toISOString(),
    service: 'cineduo-server',
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => log('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => log('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => log('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => log('error', message, fields),
};

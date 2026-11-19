import { PrismaClient } from '@prisma/client';
import { getEnv } from '../config/env';
import { logger } from './logger';

const env = getEnv();

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('database_ping_failed', { error: (error as Error).message });
    return false;
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      TOKEN_SECRET: 'test-secret-with-enough-entropy-0123456789',
      WEB_ORIGIN: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:3000',
      LOG_LEVEL: 'error',
      HOST_DISCONNECT_GRACE_MS: '600',
      MAX_PARTICIPANTS: '4',
    },
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

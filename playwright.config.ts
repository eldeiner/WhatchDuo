import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: CI ? 2 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      // Los navegadores headless bloquean el autoplay; en un dispositivo real la
      // sala muestra el overlay de gesto. Para E2E desactivamos la restricción.
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:3000',
      reuseExistingServer: !CI,
      timeout: 240_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});

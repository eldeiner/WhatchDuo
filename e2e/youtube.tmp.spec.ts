import { expect, test } from '@playwright/test';

test('carga un video de Vimeo', async ({ page }) => {
  page.on('console', (msg) => {
    console.log('[console]', msg.type(), msg.text());
  });

  await page.goto('/');
  await page.getByLabel('Tu apodo').fill('Ana');
  await page.getByLabel('URL del video (opcional)').fill('https://vimeo.com/76979871');
  await page.getByRole('button', { name: 'Crear sala y entrar' }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 30_000 });

  const iframe = page.locator('iframe[src*="vimeo"]');
  await expect(iframe).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Reproducir (solo host)' }).click();
  await page.waitForTimeout(6000);

  console.log(
    'button:',
    await page
      .getByRole('button', { name: /solo host/ })
      .getAttribute('aria-label'),
  );
  for (const frame of page.frames()) {
    if (!frame.url().includes('vimeo')) continue;
    console.log('frame url:', frame.url());
    console.log(
      'video state:',
      await frame
        .evaluate(() => {
          const video = document.querySelector('video');
          return video
            ? { time: video.currentTime, paused: video.paused, ready: video.readyState }
            : 'no video';
        })
        .catch((error: Error) => `eval failed: ${error.message}`),
    );
  }
});

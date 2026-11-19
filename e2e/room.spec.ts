import { expect, test, type Browser, type Page } from '@playwright/test';

async function createRoom(host: Page, nickname = 'Ana'): Promise<string> {
  await host.goto('/');
  await host.getByLabel('Tu apodo').fill(nickname);
  await host.getByRole('button', { name: 'Usar el video de ejemplo' }).click();
  await host.getByRole('button', { name: 'Crear sala y entrar' }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 30_000 });
  const code = new URL(host.url()).pathname.split('/').pop();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  return code!;
}

async function joinRoom(guest: Page, code: string, nickname = 'Leo'): Promise<void> {
  await guest.goto(`/room/${code}`);
  await guest.getByLabel('Tu apodo').fill(nickname);
  await guest.getByRole('button', { name: 'Entrar en la sala' }).click();
  await expect(guest.getByRole('tab', { name: 'Chat' })).toBeVisible({ timeout: 30_000 });
}

async function sendChat(page: Page, text: string): Promise<void> {
  const input = page.getByLabel('Escribe un mensaje');
  await input.fill(text);
  await input.press('Enter');
}

async function mobileContext(browser: Browser) {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
}

test.describe('Sala sincronizada', () => {
  test('host en PC y guest en móvil comparten video, chat, control y reconexión', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const host = await hostContext.newPage();
    const guestContext = await mobileContext(browser);
    const guest = await guestContext.newPage();

    const code = await createRoom(host);

    // El host ve la sala y el video de ejemplo.
    await expect(host.getByRole('button', { name: 'Reproducir (solo host)' })).toBeEnabled({
      timeout: 30_000,
    });
    await expect(host.locator('video')).toBeVisible();

    await joinRoom(guest, code);

    // Presencia: el host ve al invitado en la lista de participantes.
    await host.getByRole('tab', { name: 'Participantes' }).click();
    await expect(host.getByText('Leo', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(host.getByText(/^Ana/).first()).toBeVisible();

    // Chat bidireccional.
    await host.getByRole('tab', { name: 'Chat' }).click();
    await sendChat(host, 'Hola desde la PC');
    await expect(guest.getByText('Hola desde la PC')).toBeVisible({ timeout: 20_000 });

    await sendChat(guest, 'Hola desde el móvil');
    await expect(host.getByText('Hola desde el móvil')).toBeVisible({ timeout: 20_000 });

    // Permisos: el invitado no puede controlar la reproducción.
    const guestSeek = guest.locator('input[type="range"]');
    await expect(guestSeek).toBeDisabled();
    await expect(guest.getByRole('button', { name: 'Reproducir (solo host)' })).toBeDisabled();
    await expect(guest.getByRole('button', { name: 'Pedir control' }).first()).toBeVisible();

    // El host da al play y el invitado se alinea.
    await host.getByRole('button', { name: 'Reproducir (solo host)' }).click();

    const unlock = guest.getByRole('button', { name: /Tocar para sincronizar/ });
    if (await unlock.isVisible().catch(() => false)) {
      await unlock.click();
    }

    await expect
      .poll(
        async () => {
          const times = await Promise.all([
            host.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime),
            guest.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime),
          ]);
          const [hostTime, guestTime] = times;
          if (!hostTime || !guestTime || hostTime < 0.5 || guestTime < 0.5) return 999;
          return Math.abs(hostTime - guestTime);
        },
        { timeout: 30_000, intervals: [1000, 1000, 1000] },
      )
      .toBeLessThan(1.2);

    // Cesión de control desde el host al invitado.
    await host.getByRole('tab', { name: 'Participantes' }).click();
    await host.getByRole('button', { name: 'Dar control' }).click();
    await host.getByRole('button', { name: 'Sí, ceder el control' }).click();

    await expect(
      guest.getByRole('button', { name: /Pausar \(solo host\)|Reproducir \(solo host\)/ }),
    ).toBeEnabled({ timeout: 20_000 });

    // Reconexión: al recargar el móvil conserva el token y el historial.
    await guest.reload();
    await expect(guest.getByRole('tab', { name: 'Chat' })).toBeVisible({ timeout: 30_000 });
    await expect(guest.getByText('Hola desde la PC')).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByLabel('Tu apodo')).toHaveCount(0);

    await hostContext.close();
    await guestContext.close();
  });

  test('un código inexistente muestra un error claro', async ({ page }) => {
    await page.goto('/room/ZZZZZZ');
    await expect(page.getByRole('alert').filter({ hasText: 'La sala no existe' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('link', { name: 'Volver al inicio' })).toBeVisible();
  });

  test('la portada permite crear y unirse sin recargar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /La misma escena/ })).toBeVisible();
    await page.getByRole('tab', { name: 'Unirme' }).click();
    await expect(page.getByLabel('Código de sala')).toBeVisible();
    await page.getByRole('tab', { name: 'Crear sala' }).click();
    await expect(page.getByLabel('Tu apodo')).toBeVisible();
  });
});

import { expect, test, type Page } from '@playwright/test';

const api = process.env.API_URL ?? 'http://localhost:3001';
const overlay = process.env.OVERLAY_URL ?? 'http://localhost:3003';

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > window.innerWidth + 1,
      )
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        right: Math.round(element.getBoundingClientRect().right),
      })),
    containers: [
      '.app-shell',
      '.dashboard',
      '.feature-page',
      '.live-control',
    ].map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      const rect = element?.getBoundingClientRect();
      return {
        selector,
        left: rect?.left,
        right: rect?.right,
        width: rect?.width,
      };
    }),
  }));
  expect(layout.documentWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
    layout.viewport + 1,
  );
}

test('autenticação e painel são responsivos', async ({ page }) => {
  page.on('pageerror', (error) =>
    console.error(`browser pageerror [${page.url()}]:`, error),
  );
  page.on('console', (message) => {
    if (message.type() === 'error')
      console.error(`browser console [${page.url()}]:`, message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 500)
      console.error(
        `browser response [${response.status()}]: ${response.url()}`,
      );
  });
  await page.goto('/entrar');
  await expect(
    page.getByRole('heading', { name: /entre no (streamos|seu painel)/i }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const response = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `browser-${suffix}@streamos.local`,
      password: 'StreamOS-Browser-123!',
      displayName: 'Browser E2E',
      acceptTerms: true,
    },
  });
  expect(response.ok()).toBeTruthy();

  await page.goto('/central-da-live');
  await expect(
    page.getByRole('heading', { name: 'Central da Live' }),
  ).toBeVisible();
  await expect(page.locator('aside,nav').first()).toBeAttached();
  await expectNoHorizontalOverflow(page);
  await page.goto('/saude');
  await expect(page.getByText('Gate do beta')).toBeVisible();
  await expect(page.getByText('Conciliação', { exact: true })).toBeVisible();
  await expect(page.getByText('Último backup', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('overlay ocioso permanece transparente e vazio', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `overlay-browser-${suffix}@streamos.local`,
      password: 'StreamOS-Overlay-123!',
      displayName: 'Overlay Browser E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();
  const tokenResponse = await page.request.post(
    `${api}/dashboard/overlay/rotate-token`,
  );
  expect(tokenResponse.ok()).toBeTruthy();
  const { token } = (await tokenResponse.json()) as { token: string };

  await page.goto(`${overlay}?token=${encodeURIComponent(token)}`);
  await expect(page.locator('.overlay-canvas')).toHaveClass(/overlay-empty/);
  await expect(
    page.locator('.alert-card,.video-widget,.song-widget'),
  ).toHaveCount(0);
  const backgrounds = await page.evaluate(() => [
    getComputedStyle(document.documentElement).backgroundColor,
    getComputedStyle(document.body).backgroundColor,
  ]);
  expect(
    backgrounds.every((value) => value === 'rgba(0, 0, 0, 0)'),
  ).toBeTruthy();
});

test('todas as telas administrativas preservam layout e responsividade', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `visual-${suffix}@streamos.local`,
      password: 'StreamOS-Visual-123!',
      displayName: 'Visual E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();
  const routes = [
    '/',
    '/central-da-live',
    '/contribuicoes',
    '/carteira',
    '/vaquinhas',
    '/assinaturas',
    '/alertas',
    '/widgets',
    '/widgets/create',
    '/songpix',
    '/videopix',
    '/metas',
    '/moderacao',
    '/onboarding',
    '/conta',
    '/plataforma',
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('main').first(), route).toBeVisible();
    await expect(page.locator('body'), route).not.toContainText(
      'Application error',
    );
    const visual = await page.evaluate(() => ({
      font: getComputedStyle(document.body).fontFamily,
      background: getComputedStyle(document.body).backgroundColor,
    }));
    expect(visual.font, route).not.toMatch(/Times New Roman/i);
    expect(visual.background, route).not.toBe('rgba(0, 0, 0, 0)');
    await expectNoHorizontalOverflow(page);
  }
});

test('alerta percorre a fila e desaparece automaticamente', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile');
  test.setTimeout(35_000);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `playback-browser-${suffix}@streamos.local`,
      password: 'StreamOS-Playback-123!',
      displayName: 'Playback Browser E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();
  const tokenResponse = await page.request.post(
    `${api}/dashboard/overlay/rotate-token`,
  );
  const { token } = (await tokenResponse.json()) as { token: string };
  await page.goto(`${overlay}?token=${encodeURIComponent(token)}`);
  await expect(page.locator('.overlay-canvas')).toHaveClass(/overlay-empty/);

  const alert = await page.request.post(`${api}/dashboard/alerts/test`, {
    data: { sequence: true },
  });
  expect(alert.ok()).toBeTruthy();
  await expect(page.locator('.alert-card')).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('.alert-card')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('.overlay-canvas')).toHaveClass(/overlay-empty/);
});

test('overlays de música e vídeo preservam layout e canal dedicado', async ({
  page,
}) => {
  test.setTimeout(35_000);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `media-overlay-${suffix}@streamos.local`,
      password: 'StreamOS-Media-123!',
      displayName: 'Media Overlay E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();

  const songResponse = await page.request.post(`${api}/dashboard/widgets`, {
    data: { type: 'SONG_PIX', name: 'SongPix visual' },
  });
  const song = (await songResponse.json()) as { id: string; token: string };
  await page.goto(`${overlay}?token=${encodeURIComponent(song.token)}`);
  const songTest = await page.request.post(
    `${api}/dashboard/widgets/${song.id}/test`,
    { data: {} },
  );
  expect(songTest.ok()).toBeTruthy();
  const intro = page.locator('.song-widget-intro');
  await expect(intro).toBeVisible({ timeout: 10_000 });
  const introBox = await intro.boundingBox();
  const viewport = page.viewportSize();
  expect(introBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(introBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(introBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(
    Math.abs(introBox!.x + introBox!.width / 2 - viewport!.width / 2),
  ).toBeLessThan(3);
  await expect(page.locator('.song-widget-compact')).toBeVisible({
    timeout: 7_000,
  });
  await expectNoHorizontalOverflow(page);

  const videoResponse = await page.request.post(`${api}/dashboard/widgets`, {
    data: { type: 'VIDEO_PIX', name: 'VideoPix visual' },
  });
  const video = (await videoResponse.json()) as { id: string; token: string };
  await page.goto(`${overlay}?token=${encodeURIComponent(video.token)}`);
  const videoTest = await page.request.post(
    `${api}/dashboard/widgets/${video.id}/test`,
    { data: {} },
  );
  expect(videoTest.ok()).toBeTruthy();
  await expect(page.locator('.video-widget')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.alert-card')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('history replay resumes a paused queue and renders again', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1366');
  test.setTimeout(45_000);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `history-replay-${suffix}@streamos.local`,
      password: 'StreamOS-History-123!',
      displayName: 'History Replay E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();
  const tokenResponse = await page.request.post(
    `${api}/dashboard/overlay/rotate-token`,
  );
  const { token } = (await tokenResponse.json()) as { token: string };
  await page.goto(`${overlay}?token=${encodeURIComponent(token)}`);

  const alert = await page.request.post(`${api}/dashboard/alerts/test`, {
    data: { sequence: false },
  });
  expect(alert.ok()).toBeTruthy();
  await expect(page.locator('.alert-card')).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('.alert-card')).toHaveCount(0, { timeout: 15_000 });

  const snapshotResponse = await page.request.get(
    `${api}/dashboard/live-control`,
  );
  const snapshot = (await snapshotResponse.json()) as {
    items: Array<{ id: string; status: string; kind: string }>;
  };
  const completed = snapshot.items.find(
    (item) => item.kind === 'ALERT' && item.status === 'COMPLETED',
  );
  expect(completed).toBeTruthy();
  const pause = await page.request.post(
    `${api}/dashboard/live-control/commands`,
    {
      data: {
        action: 'PAUSE_QUEUE',
        idempotencyKey: crypto.randomUUID(),
        origin: 'E2E',
      },
    },
  );
  expect(pause.ok()).toBeTruthy();
  const replay = await page.request.post(
    `${api}/dashboard/live-control/commands`,
    {
      data: {
        action: 'REPLAY',
        itemId: completed!.id,
        idempotencyKey: crypto.randomUUID(),
        origin: 'E2E',
      },
    },
  );
  expect(replay.ok()).toBeTruthy();
  const replaySnapshot = (await replay.json()) as {
    state: { paused: boolean };
    items: Array<{ id: string; status: string }>;
  };
  expect(replaySnapshot.state.paused).toBe(false);
  expect(
    replaySnapshot.items.find((item) => item.id === completed!.id)?.status,
  ).toBe('PLAYING');
  await expect(page.locator('.alert-card')).toBeVisible({ timeout: 12_000 });
});

test('widget activation toggle is functional in the catalog', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `widget-toggle-${suffix}@streamos.local`,
      password: 'StreamOS-Widget-123!',
      displayName: 'Widget Toggle E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();
  const name = `Alerta toggle ${suffix}`;
  const created = await page.request.post(`${api}/dashboard/widgets`, {
    data: { type: 'ALERT', name },
  });
  expect(created.ok()).toBeTruthy();

  await page.goto('/widgets');
  const disable = page.getByRole('button', { name: 'Desativar Alertas' });
  await expect(disable).toBeVisible();
  await disable.click();
  const enable = page.getByRole('button', { name: 'Ativar Alertas' });
  await expect(enable).toBeVisible();
  await enable.click();
  await expect(
    page.getByRole('button', { name: 'Desativar Alertas' }),
  ).toBeVisible();
});

test('template pronto aplica o preset completo e persiste após recarregar', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1366');
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `alert-template-${suffix}@streamos.local`,
      password: 'StreamOS-Template-123!',
      displayName: 'Template E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/alertas');
  const cardTemplate = page.getByRole('radio', { name: /Card clássico/i });
  await expect(cardTemplate).toBeVisible();
  await cardTemplate.click();
  await expect(cardTemplate).toHaveAttribute('aria-checked', 'true');

  const font = page.getByLabel('Fonte', { exact: true }).last();
  const size = page.getByLabel('Tamanho da fonte', { exact: true }).last();
  await expect(font).toHaveValue('DM Sans');
  await expect(size).toHaveValue('30');

  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/dashboard/alerts/variations/') &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Salvar variação' }).click();
  expect((await saved).ok()).toBeTruthy();
  await page.reload();
  await expect(cardTemplate).toHaveAttribute('aria-checked', 'true');
  await expect(font).toHaveValue('DM Sans');
  await expect(size).toHaveValue('30');
});

test('detalhes da contribuição abrem como modal central responsivo', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `contribution-modal-${suffix}@streamos.local`,
      password: 'StreamOS-Modal-123!',
      displayName: 'Modal E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();
  const account = (await registration.json()) as {
    memberships: Array<{
      organization: { creatorProfile: { slug: string } };
    }>;
  };
  const slug = account.memberships[0]?.organization.creatorProfile.slug;
  expect(slug).toBeTruthy();
  const onboarding = await page.request.put(`${api}/dashboard/onboarding`, {
    data: {
      displayName: 'Modal E2E',
      slug,
      bio: 'Conta para validar o modal de contribuições',
      minimumContributionInCents: 100,
      isPublished: true,
    },
  });
  expect(onboarding.ok()).toBeTruthy();
  const intent = await page.request.post(
    `${api}/public/creators/${slug}/payment-intents`,
    {
      data: {
        amountInCents: 2_000,
        supporterName: 'Apoiador do modal',
        message: 'Verificando rastreamento',
      },
    },
  );
  expect(intent.ok()).toBeTruthy();
  const paymentIntent = (await intent.json()) as { id: string };
  const confirmation = await page.request.post(
    `${api}/mock/payment-intents/${paymentIntent.id}/confirm`,
  );
  expect(confirmation.ok()).toBeTruthy();

  await page.goto('/contribuicoes');
  const trigger = page.getByRole('button', {
    name: 'Abrir contribuição de Apoiador do modal',
  });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'Apoiador do modal',
  });
  await expect(dialog).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(
    Math.abs(bounds!.x + bounds!.width / 2 - viewport!.width / 2),
  ).toBeLessThan(2);
  expect(
    Math.abs(bounds!.y + bounds!.height / 2 - viewport!.height / 2),
  ).toBeLessThan(2);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(trigger).toBeFocused();
});

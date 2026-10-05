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

  await page.goto('/');
  const performancePeriod = page.getByLabel('Período do gráfico');
  await performancePeriod.selectOption('7');
  await expect(page.getByText('Sem receita nos últimos 7 dias')).toBeVisible();
  await expectNoHorizontalOverflow(page);

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
    if (['/conta', '/plataforma'].includes(route)) {
      const alignment = await page.locator('main').evaluate((main) => {
        const elements = [...main.children].filter((element) =>
          element.matches('header, nav, section'),
        );
        const centers = elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left + rect.width / 2;
        });
        return {
          centers,
          spread: Math.max(...centers) - Math.min(...centers),
        };
      });
      expect(
        alignment.spread,
        `${route}: ${JSON.stringify(alignment)}`,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test('configurações executam os fluxos principais com retorno visível', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `settings-${suffix}@streamos.local`,
      password: 'StreamOS-Settings-123!',
      displayName: 'Configurações E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/conta');
  await page.getByLabel('Nome público').fill('Perfil atualizado E2E');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  const savedStatus = page.getByRole('status');
  await expect(savedStatus).toContainText('Perfil atualizado');
  const statusBounds = await savedStatus.boundingBox();
  expect(statusBounds).not.toBeNull();
  expect(statusBounds!.x).toBeGreaterThanOrEqual(0);
  expect(statusBounds!.x + statusBounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

  const browserSource = page.locator('#browser-source');
  const generateUrl = browserSource.getByRole('button', {
    name: 'Gerar URL',
    exact: true,
  });
  await expect(generateUrl).toBeEnabled();
  await generateUrl.click();
  await expect(
    browserSource.getByLabel('URL secreta do overlay'),
  ).toBeVisible();
  await expect(
    browserSource.getByRole('button', { name: 'Enviar teste' }),
  ).toBeEnabled();

  await page.goto('/plataforma');
  const team = page.locator('#equipe');
  await team.getByLabel('E-mail').fill(`invite-${suffix}@streamos.local`);
  await team.getByRole('button', { name: 'Gerar convite' }).click();
  await expect(
    team.getByRole('button', { name: 'Copiar convite' }),
  ).toBeVisible();

  const apiSection = page.locator('#api');
  await apiSection.getByLabel('Nome').fill('Teste E2E');
  await apiSection.getByRole('button', { name: 'Criar token' }).click();
  await expect(
    apiSection.getByRole('button', { name: 'Copiar token' }),
  ).toBeVisible();

  const webhooks = page.locator('#webhooks');
  await webhooks.getByLabel('URL').fill('http://localhost:4567/streamos');
  await webhooks.getByRole('button', { name: 'Adicionar endpoint' }).click();
  await expect(
    webhooks.getByRole('button', { name: 'Copiar segredo' }),
  ).toBeVisible();

  const twitch = page
    .locator('#integracoes article')
    .filter({ hasText: 'Twitch' });
  await twitch.getByRole('button', { name: 'Conectar', exact: true }).click();
  await expect(twitch.getByText('Conectado', { exact: true })).toBeVisible();
  await expect(twitch.getByRole('button', { name: 'Testar' })).toBeEnabled();

  await page.goto('/saude');
  await expect(page.getByText('Gate do beta')).toBeVisible();
});

test('assinaturas criam e publicam um plano com retorno visível', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `subscriptions-${suffix}@streamos.local`,
      password: 'StreamOS-Subscriptions-123!',
      displayName: 'Assinaturas E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/assinaturas');
  await page.getByLabel('Nome').fill('Clube E2E');
  await page.getByLabel('Preço mensal').fill('19,90');
  await page.getByLabel('Descrição').fill('Plano criado pelo teste funcional.');
  await page.getByRole('button', { name: 'Criar plano' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Plano criado como rascunho',
  );

  const plan = page.locator('article.feature-card').filter({
    has: page.getByText('Clube E2E', { exact: true }),
  });
  await expect(plan.getByText('Rascunho')).toBeVisible();
  await plan.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Plano publicado');
  await expect(plan.getByText('Publicado')).toBeVisible();
});

test('meta valida e salva as informações exibidas no progresso', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `goal-${suffix}@streamos.local`,
      password: 'StreamOS-Goal-123!',
      displayName: 'Meta E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/metas');
  await page.getByLabel('Título').fill('Setup novo');
  await page.getByLabel('Objetivo em R$').fill('2500');
  await page.getByLabel('Mensagem de conclusão').fill('Meta alcançada!');
  await page.getByRole('button', { name: 'Salvar meta' }).click();
  await expect(page.getByRole('status')).toContainText('Meta atualizada');
  await expect(page.getByText(/R\$ 0\.00 de R\$ 2500\.00/)).toBeVisible();

  await page.getByLabel('Objetivo em R$').fill('0');
  await expect(
    page.getByRole('button', { name: 'Salvar meta' }),
  ).toBeDisabled();
});

test('contribuições informam falha de carregamento e permitem tentar novamente', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/dashboard/contributions', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Serviço temporariamente indisponível.',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });

  await page.goto('/contribuicoes');
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar' }),
  ).toBeVisible();
  await expect(
    page.getByText('Serviço temporariamente indisponível.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nenhuma contribuição encontrada' }),
  ).toBeVisible();
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
  ).toBe('QUEUED');
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
  await expect(
    page.locator('.contribution-table-head').getByText('OBS', { exact: true }),
  ).toHaveCount(0);
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'Apoiador do modal',
  });
  await expect(dialog).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('.detail-backdrop')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0.72)',
  );
  await expect(page).toHaveURL(/\/contribuicoes$/);
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

test('agenda e extrato funcionam como menus expansíveis da carteira', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `wallet-menu-${suffix}@streamos.local`,
      password: 'StreamOS-Wallet-Menu-123!',
      displayName: 'Carteira Menu E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/carteira');
  const receivables = page.locator('#recebiveis');
  const statement = page.locator('#extrato');
  await expect(receivables).toHaveAttribute('open', '');
  await expect(statement).not.toHaveAttribute('open', '');
  await statement.getByText('Extrato', { exact: true }).click();
  await expect(statement).toHaveAttribute('open', '');
  await expect(receivables).not.toHaveAttribute('open', '');
  await expect(page.getByLabel('Tipo de movimentação')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('imagem de capa da vaquinha pode ser enviada e removida', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `campaign-cover-${suffix}@streamos.local`,
      password: 'StreamOS-Campaign-Cover-123!',
      displayName: 'Vaquinha Capa E2E',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto('/vaquinhas');
  await page
    .locator('.campaign-cover-upload input[type="file"]')
    .setInputFiles({
      name: 'capa.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
  await expect(page.getByText('Imagem de capa enviada.')).toBeVisible();
  await expect(page.locator('.campaign-cover-upload')).toHaveClass(/has-image/);

  await page.getByRole('button', { name: 'Remover imagem' }).click();
  await expect(page.locator('.campaign-cover-upload')).not.toHaveClass(
    /has-image/,
  );
  await expectNoHorizontalOverflow(page);
});

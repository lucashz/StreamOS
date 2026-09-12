import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const api = process.env.API_URL ?? 'http://localhost:3001';
const longName =
  'Comunidade de apoiadores da transmissão especial de aniversário';

async function capture(
  page: Page,
  viewport: string,
  state: string,
  fullPage = true,
) {
  await page.evaluate(() => document.fonts.ready);
  if (fullPage) {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.screenshot({
    path: `.runtime/design-review/${viewport}-${state}.png`,
    fullPage,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
}

test('revisão visual com widgets e recebíveis reais, conteúdo longo e modal', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await mkdir('.runtime/design-review', { recursive: true });
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `design-${Date.now()}-${info.project.name}@streamos.local`,
      password: 'StreamOS-Design-123!',
      displayName: 'Revisão visual',
      acceptTerms: true,
    },
  });
  expect(registration.ok()).toBeTruthy();
  const account = await registration.json();
  const slug = account.memberships[0].organization.creatorProfile.slug;
  expect(
    (
      await page.request.put(`${api}/dashboard/onboarding`, {
        data: {
          displayName: 'Revisão visual',
          slug,
          bio: 'Transmissão com conteúdo de teste para revisão de layout.',
          minimumContributionInCents: 100,
          isPublished: true,
        },
      })
    ).ok(),
  ).toBeTruthy();
  for (const type of ['RANKING', 'GOAL']) {
    expect(
      (
        await page.request.post(`${api}/dashboard/widgets`, {
          data: { type, name: `${type} — ${longName}` },
        })
      ).ok(),
    ).toBeTruthy();
  }
  const payment = await page.request.post(
    `${api}/public/creators/${slug}/payment-intents`,
    {
      data: {
        amountInCents: 20000,
        supporterName: longName,
        message: 'Muito obrigado pela transmissão! '.repeat(5),
      },
    },
  );
  expect(payment.ok()).toBeTruthy();
  expect(
    (
      await page.request.post(
        `${api}/mock/payment-intents/${(await payment.json()).id}/confirm`,
      )
    ).ok(),
  ).toBeTruthy();

  await page.goto('/widgets');
  await expect(page.locator('.managed-widget-card')).toHaveCount(2);
  await capture(page, info.project.name, 'widgets');
  await page
    .locator('.managed-widget-card')
    .first()
    .getByRole('button', { name: 'Configurar', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, info.project.name, 'widget-editor', false);
  await page.keyboard.press('Escape');

  await page.goto('/carteira');
  await expect(
    page
      .getByText('Comunidade de apoiadores da transmissão especial', {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await page.locator('#extrato summary').click();
  await capture(page, info.project.name, 'carteira');
  await page.goto('/conta');
  await expect(page.locator('#perfil input').first()).toHaveValue(
    'Revisão visual',
  );
  await expect(page.locator('#browser-source')).toBeVisible();
  await capture(page, info.project.name, 'configuracoes');
  await page.goto('/contribuicoes');
  await page
    .getByRole('button', {
      name: /Abrir contribuição de Comunidade de apoiadores da transmissão/,
    })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, info.project.name, 'contribuicao-modal', false);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${api}/dashboard/widgets`, async (route) => {
    await pending;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.goto('/widgets');
  await expect(page.getByLabel('Carregando widgets')).toBeVisible();
  await capture(page, info.project.name, 'widgets-carregando');
  release();
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar os widgets' }),
  ).toBeVisible();
  await capture(page, info.project.name, 'widgets-erro');
  await page.unroute(`${api}/dashboard/widgets`);
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('.managed-widget-card')).toHaveCount(2);
});

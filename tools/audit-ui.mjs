import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const web = process.env.APP_URL ?? 'http://localhost:3000';
const api = process.env.API_URL ?? 'http://localhost:3001';
const output = path.resolve('.runtime/ui-audit');
const viewports = [
  ['mobile-360', 360, 800],
  ['tablet-768', 768, 1024],
  ['desktop-1366', 1366, 768],
  ['wide-1920', 1920, 1080],
];
const routes = [
  '/',
  '/contribuicoes',
  '/carteira',
  '/vaquinhas',
  '/vaquinhas#recompensas',
  '/assinaturas',
  '/central-da-live',
  '/alertas',
  '/widgets',
  '/widgets/create',
  '/aparencia',
  '/moderacao',
  '/moderacao#tts',
  '/moderacao#bloqueios',
  '/conta#perfil',
  '/plataforma#equipe',
  '/plataforma#integracoes',
  '/plataforma#api',
  '/plataforma#webhooks',
  '/conta#seguranca',
  '/conta#organizacao',
  '/metas',
  '/onboarding',
  '/saude',
  '/central-da-live/dock',
];

await fs.mkdir(output, { recursive: true });
const systemChrome =
  process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : null;
const executablePath =
  process.env.PLAYWRIGHT_CHROME_PATH ??
  (systemChrome && existsSync(systemChrome) ? systemChrome : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const findings = [];
const coverage = [];

for (const [viewportName, width, height] of viewports) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const suffix = `${Date.now()}-${viewportName}`;
  const registration = await page.request.post(`${api}/auth/register`, {
    data: {
      email: `audit-${suffix}@streamos.local`,
      password: 'StreamOS-Audit-123!',
      displayName: `Auditoria ${viewportName}`,
      acceptTerms: true,
    },
  });
  if (!registration.ok())
    throw new Error(
      `Cadastro falhou em ${viewportName}: ${registration.status()}`,
    );

  const runtimeErrors = [];
  page.on('pageerror', (error) =>
    runtimeErrors.push(`pageerror: ${error.message}`),
  );
  page.on('console', (message) => {
    if (message.type() === 'error')
      runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500)
      runtimeErrors.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  for (const route of routes) {
    runtimeErrors.length = 0;
    const response = await page.goto(`${web}${route}`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    await page.waitForTimeout(250);
    const audit = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      const describe = (element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className:
          typeof element.className === 'string' ? element.className : '',
        text: (element.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 100),
      });
      const elements = [...document.querySelectorAll('body *')].filter(visible);
      const overflow = elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right > innerWidth + 1 || rect.left < -1;
        })
        .slice(0, 12)
        .map(describe);
      const clipped = elements
        .filter((element) => {
          const style = getComputedStyle(element);
          return (
            ['hidden', 'clip'].includes(style.overflow) &&
            (element.scrollWidth > element.clientWidth + 2 ||
              element.scrollHeight > element.clientHeight + 2)
          );
        })
        .slice(0, 12)
        .map(describe);
      const controls = [
        ...document.querySelectorAll('button, a, input, select, textarea'),
      ].filter(visible);
      const undersizedControls = controls
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 32 || rect.height < 32;
        })
        .slice(0, 12)
        .map((element) => ({
          ...describe(element),
          rect: element.getBoundingClientRect().toJSON(),
        }));
      const boxes = [
        ...document.querySelectorAll(
          '.feature-card, .panel-card, .metric-card, .settings-card, article, form',
        ),
      ]
        .filter(visible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            ...describe(element),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        });
      const hashTarget = location.hash
        ? document.querySelector(location.hash)
        : null;
      const activeMenu = [...document.querySelectorAll('.nav-item.active')]
        .filter(visible)
        .map(describe);
      return {
        title: document.title,
        heading: document.querySelector('h1')?.textContent?.trim() ?? '',
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        overflow,
        clipped,
        undersizedControls,
        boxes,
        activeMenu,
        hashTarget: hashTarget ? describe(hashTarget) : null,
        bodyText: document.body.innerText.slice(0, 500),
      };
    });
    const slug =
      route === '/' ? 'painel' : route.slice(1).replaceAll(/[^a-z0-9]+/gi, '-');
    await page.screenshot({
      path: path.join(output, `${viewportName}--${slug}.png`),
      fullPage: true,
    });
    coverage.push({
      viewport: viewportName,
      route,
      status: response?.status() ?? null,
      ...audit,
      runtimeErrors: [...new Set(runtimeErrors)],
    });
    if (response && response.status() >= 400)
      findings.push({
        severity: 'P1',
        viewport: viewportName,
        route,
        issue: `HTTP ${response?.status()}`,
      });
    if (audit.documentWidth > audit.viewportWidth + 1)
      findings.push({
        severity: 'P1',
        viewport: viewportName,
        route,
        issue: 'Overflow horizontal',
        evidence: audit.overflow,
      });
    if (runtimeErrors.length)
      findings.push({
        severity: 'P2',
        viewport: viewportName,
        route,
        issue: 'Erros em execução',
        evidence: [...new Set(runtimeErrors)],
      });
    if (route.includes('#') && !audit.hashTarget)
      findings.push({
        severity: 'P1',
        viewport: viewportName,
        route,
        issue: 'Âncora do menu não existe',
      });
    if (route.includes('#') && audit.activeMenu.length !== 1)
      findings.push({
        severity: 'P2',
        viewport: viewportName,
        route,
        issue: `Menu ativo ambíguo (${audit.activeMenu.length})`,
        evidence: audit.activeMenu,
      });
  }
  await context.close();
}

await browser.close();
await fs.writeFile(
  path.join(output, 'audit.json'),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), coverage, findings },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    { pages: coverage.length, findings: findings.length, output },
    null,
    2,
  ),
);

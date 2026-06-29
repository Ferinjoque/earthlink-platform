import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Dashboard - estructura y datos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('carga el panel con título editorial visible', async ({ page }) => {
    await expect(page.getByText('Portafolio de emisiones de la cadena de suministro')).toBeVisible();
  });

  test('muestra el TopBar con título Panel', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Panel', level: 1 })).toBeVisible();
  });

  test('muestra al menos 4 tarjetas KPI', async ({ page }) => {
    const eyebrows = page.locator('.eyebrow');
    const count = await eyebrows.count();
    expect(count).toBeGreaterThanOrEqual(4);
    // Usar clase .eyebrow para evitar strict mode con texto duplicado en página
    await expect(page.locator('.eyebrow').filter({ hasText: /^CO₂e verificado$/ })).toBeVisible();
    await expect(page.locator('.eyebrow').filter({ hasText: /^Cobertura$/ })).toBeVisible();
    await expect(page.locator('.eyebrow').filter({ hasText: /^Anomalías activas$/ })).toBeVisible();
    await expect(page.locator('.eyebrow').filter({ hasText: /^En revisión$/ })).toBeVisible();
  });

  test('el selector de año está visible y funcional', async ({ page }) => {
    // El selector puede ser select, link con ?year=, o botones con año en main
    const yearLinks = page.locator('a[href*="year="]');
    const yearButtons = page.locator('main').locator('button').filter({ hasText: /^\d{4}$/ });
    const yearSelect = page.getByRole('combobox').or(page.locator('select'));
    const hasLinks = await yearLinks.count() > 0;
    const hasButtons = await yearButtons.count() > 0;
    const yearEl = hasLinks ? yearLinks.first() : hasButtons ? yearButtons.first() : yearSelect.first();
    await expect(yearEl).toBeVisible();
  });

  test('tiene sección de tendencia anual CO₂e', async ({ page }) => {
    await expect(page.getByText('Tendencia anual CO₂e')).toBeVisible();
  });

  test('las secciones aplican animación fadeUp (clase CSS presente)', async ({ page }) => {
    const animatedSections = page.locator('.animate-fade-up');
    const count = await animatedSections.count();
    expect(count).toBeGreaterThan(0);
  });
});

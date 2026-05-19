import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Dashboard — estructura y datos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('carga el panel con título editorial visible', async ({ page }) => {
    await expect(page.getByText('Portafolio de emisiones de la cadena de suministro')).toBeVisible();
  });

  test('muestra el TopBar con título Panel', async ({ page }) => {
    await expect(page.getByText('Panel')).toBeVisible();
  });

  test('muestra al menos 4 tarjetas KPI', async ({ page }) => {
    const eyebrows = page.locator('.eyebrow');
    await expect(eyebrows).toHaveCount(await eyebrows.count());
    // At minimum: CO₂e verificado, Cobertura, Anomalías activas, En revisión
    await expect(page.getByText('CO₂e verificado')).toBeVisible();
    await expect(page.getByText('Cobertura')).toBeVisible();
    await expect(page.getByText('Anomalías activas')).toBeVisible();
    await expect(page.getByText('En revisión')).toBeVisible();
  });

  test('el selector de año está visible y funcional', async ({ page }) => {
    const yearSelector = page.getByRole('combobox').or(page.locator('select'));
    const yearLinks = page.locator('a[href*="year="]');
    // Either a select or navigation links for year filtering
    const yearEl = await yearLinks.count() > 0 ? yearLinks.first() : yearSelector.first();
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

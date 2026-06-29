import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Actividad - registro de consumo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/activity');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página con el título correcto en TopBar', async ({ page }) => {
    await expect(page.getByText('Registros de actividad')).toBeVisible();
  });

  test('muestra el panel de registro de consumo', async ({ page }) => {
    await expect(page.getByText('Registro de consumo')).toBeVisible();
  });

  test('muestra la sección de registros recientes', async ({ page }) => {
    // Timeout extendido: el h2 está dentro de sección con animación fadeUp (opacity:0 inicial)
    await expect(page.getByRole('heading', { name: 'Registros recientes' })).toBeVisible({ timeout: 10000 });
  });

  test('las secciones tienen animación de entrada', async ({ page }) => {
    const animated = page.locator('.animate-fade-up');
    const count = await animated.count();
    expect(count).toBeGreaterThan(0);
  });
});

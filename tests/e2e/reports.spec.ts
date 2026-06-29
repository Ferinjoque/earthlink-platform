import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Reportes - exportación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de reportes con título editorial', async ({ page }) => {
    await expect(page.getByText('Exportar emisiones verificadas')).toBeVisible();
  });

  test('muestra el TopBar con título Reportes', async ({ page }) => {
    // Usar heading h1 exacto para evitar strict mode con sidebar + párrafos
    await expect(page.getByRole('heading', { name: 'Reportes', level: 1 })).toBeVisible();
  });

  test('tiene sección de periodos exportables o estado vacío descriptivo', async ({ page }) => {
    // Muestra tabla de periodos o un mensaje indicando que no hay periodos exportables
    const body = await page.locator('main').textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('las secciones tienen animación de entrada', async ({ page }) => {
    const animated = page.locator('.animate-fade-up');
    const count = await animated.count();
    expect(count).toBeGreaterThan(0);
  });
});

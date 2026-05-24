import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Auditoría — consola principal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');
  });

  test('carga la consola de auditoría con el título correcto', async ({ page }) => {
    await expect(page.getByText('Consola de auditoría')).toBeVisible();
  });

  test('muestra chips de estado con conteos', async ({ page }) => {
    await expect(page.getByText('Abierto')).toBeVisible();
    await expect(page.getByText('En revisión')).toBeVisible();
    await expect(page.getByText('Bloqueado')).toBeVisible();
  });

  test('muestra filtros de año navegables', async ({ page }) => {
    const currentYear = new Date().getFullYear();
    await expect(page.getByText(String(currentYear))).toBeVisible();
  });

  test('muestra tabla de periodos o estado vacío', async ({ page }) => {
    // La tabla de auditoría es visible o se muestra un mensaje de estado vacío
    const table = page.locator('table').first();
    const isEmpty = page.getByText(/sin periodos/i).or(page.getByText(/no hay periodos/i));
    const hasTable = await table.count() > 0;
    if (!hasTable) {
      await expect(isEmpty).toBeVisible();
    } else {
      await expect(table).toBeVisible();
    }
  });

  test('las secciones tienen animación de entrada', async ({ page }) => {
    const animated = page.locator('.animate-fade-up');
    const count = await animated.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Auditoría — detalle de periodo', () => {
  test('navegar al detalle de un periodo desde la consola', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');
    const periodLink = page.locator('a[href^="/audit/"]').first();
    const count = await periodLink.count();
    if (count === 0) return; // omitir si no hay periodos vinculados
    await periodLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/audit\/.+/);
  });
});

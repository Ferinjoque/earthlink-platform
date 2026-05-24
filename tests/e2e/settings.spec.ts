import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Configuración — cuenta y organización', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de configuración con título correcto', async ({ page }) => {
    await expect(page.getByText('Configuración de la cuenta')).toBeVisible();
  });

  test('muestra las 3 secciones: Cuenta, Organización, Permisos', async ({ page }) => {
    await expect(page.getByText('Cuenta')).toBeVisible();
    await expect(page.getByText('Organización')).toBeVisible();
    await expect(page.getByText('Permisos y rol')).toBeVisible();
  });

  test('muestra el email del usuario demo', async ({ page }) => {
    await expect(page.getByText('admin@earthlink.test')).toBeVisible();
  });

  test('muestra el rol del usuario', async ({ page }) => {
    // Administrador, Consultor o Proveedor
    await expect(page.getByText(/Administrador|Consultor|Proveedor/)).toBeVisible();
  });

  test('las secciones tienen animación de entrada stagger', async ({ page }) => {
    const stagger2 = page.locator('.animate-fade-up.stagger-2');
    await expect(stagger2).toBeVisible();
  });
});

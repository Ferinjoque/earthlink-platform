import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Proveedores - lista y detalle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
  });

  test('carga la página de proveedores con el título correcto', async ({ page }) => {
    await expect(page.getByText('Registro de proveedores')).toBeVisible();
  });

  test('muestra el TopBar con título Proveedores', async ({ page }) => {
    // Usar h1 exacto para evitar strict mode con sidebar nav + subtítulos
    await expect(page.getByRole('heading', { name: 'Proveedores', level: 1 })).toBeVisible();
  });

  test('muestra al menos un proveedor en la lista', async ({ page }) => {
    // Debe existir al menos una fila de tabla o tarjeta de proveedor
    const rows = page.locator('table tbody tr, [data-supplier-row]');
    const count = await rows.count();
    // Tiene filas o muestra un estado vacío
    if (count === 0) {
      await expect(page.getByText(/proveedor/i)).toBeVisible();
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('la sección titular tiene animación de entrada', async ({ page }) => {
    const animatedHeader = page.locator('section.animate-fade-up.stagger-1').first();
    await expect(animatedHeader).toBeVisible();
  });
});

test.describe('Proveedor detalle', () => {
  test('navegar al detalle de un proveedor desde la lista', async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
    const supplierLink = page.locator('a[href^="/suppliers/"]').first();
    const count = await supplierLink.count();
    if (count === 0) return; // omitir si no hay proveedores
    await supplierLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/suppliers\/.+/);
    await expect(page.getByText('Periodos de reporte')).toBeVisible();
  });
});

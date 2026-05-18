import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('carga la página de inicio de sesión', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('EarthLink')).toBeVisible();
  });

  test('muestra el formulario de autenticación', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('tiene estructura de encabezado válida', async ({ page }) => {
    await page.goto('/login');
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });

  test('raíz redirige a login cuando no hay sesión', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });
});

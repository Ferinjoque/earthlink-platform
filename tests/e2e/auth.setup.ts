import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth', 'user.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill('admin@earthlink.test');
  await page.locator('input[name="password"]').fill('Earthlink2025!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: authFile });
});

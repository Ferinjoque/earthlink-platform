import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('renders EarthLink wordmark', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('EarthLink')).toBeVisible();
  });

  test('shows Phase 0 status badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Phase 0/i)).toBeVisible();
  });

  test('has no a11y violations on heading structure', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });
});

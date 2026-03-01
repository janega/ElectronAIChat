import { test, expect } from '@playwright/test';

test.describe('App bootstrap', () => {
  test('page title is ElectronAIChat', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ElectronAIChat/i);
  });

  test('username modal appears on first load when no username is set', async ({
    page,
  }) => {
    // Clear any stored username so the modal is shown
    await page.addInitScript(() => localStorage.removeItem('username'));
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /welcome/i })
        .or(page.locator('[data-testid="username-modal"]'))
        .or(page.getByPlaceholder(/username/i))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('username modal does not appear when username is already set', async ({
    page,
  }) => {
    // Pre-set a username so the modal is skipped
    await page.addInitScript(() =>
      localStorage.setItem('username', 'testuser')
    );
    await page.goto('/');

    await expect(
      page.getByPlaceholder(/username/i)
    ).not.toBeVisible({ timeout: 10_000 });
  });
});

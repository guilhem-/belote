import { test } from '@playwright/test';

test.describe('captures visuelles', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
  });

  test('état initial', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/01-initial.png', fullPage: true });
  });

  test('panneau paramètres ouvert', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.screenshot({ path: 'test-results/02-settings.png', fullPage: true });
  });

  test('debug + mains révélées', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Voir pensées IA/ }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/03-debug.png', fullPage: true });
  });

  test('après plusieurs secondes de jeu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: /Instant/ }).click();
    await page.getByRole('button', { name: /Appliquer/ }).click();
    await page.getByRole('button', { name: /Voir pensées IA/ }).click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-results/04-mid-game.png', fullPage: true });
  });
});

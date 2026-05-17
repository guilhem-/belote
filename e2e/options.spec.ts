import { test, expect } from '@playwright/test';
import { resetStorageWithoutAnim } from './_helpers';

test.describe('options de confort', () => {
  test.beforeEach(async ({ page }) => {
    await resetStorageWithoutAnim(page);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('options auto sont cochées par défaut dans Paramètres', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await expect(
      page.getByRole('checkbox', { name: /Jouer automatiquement la dernière carte/ }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: /Lancer automatiquement la donne suivante/ }),
    ).toBeChecked();
  });

  test('le footer expose la seed + boutons copier/charger', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.seed-block code')).toBeVisible();
    await expect(page.getByRole('button', { name: /Copier la seed/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Charger seed/ })).toBeVisible();
  });

  test('copier la seed met le presse-papier à jour + toast', async ({ page }) => {
    await page.goto('/');
    const expected = await page.locator('.seed-block code').textContent();
    await page.getByRole('button', { name: /Copier la seed/ }).click();
    await expect(page.getByRole('status')).toContainText(/copiée/);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(expected);
  });

  test('charger une seed depuis le presse-papier remplace la partie', async ({ page }) => {
    await page.goto('/');
    // Met une seed connue dans le presse-papier
    await page.evaluate(() => navigator.clipboard.writeText('0xdeadbeef'));
    await page.getByRole('button', { name: /Charger seed/ }).click();
    await expect(page.getByRole('status')).toContainText(/seed 0xdeadbeef/);
    await expect(page.locator('.seed-block code')).toContainText('0xdeadbeef');
  });

  test('seed invalide → toast d’erreur', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.clipboard.writeText('pas une seed'));
    await page.getByRole('button', { name: /Charger seed/ }).click();
    await expect(page.getByRole('status')).toContainText(/invalide/);
  });
});

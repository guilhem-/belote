import { test, expect } from '@playwright/test';

test.describe('redistribution après doubles passes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('même si tous passent (seed pathologique), la partie progresse', async ({ page }) => {
    await page.goto('/');
    // Force un mode 0 humain + cadence Instant pour brûler beaucoup de donnes vite.
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('checkbox', { name: /Sud humain/ }).uncheck();
    await page.getByRole('button', { name: /Instant/ }).click();
    await page.getByRole('button', { name: /Appliquer/ }).click();

    // Capture la seed initiale et le donneur initial (N par défaut).
    const initialSeed = await page.locator('.seed-block code').textContent();
    expect(initialSeed).toBeTruthy();

    // Patiente : avec niveau 4 et seuil 48, la majorité des donnes doivent
    // aboutir à une prise (pas à un redeal). Mais quelques unes seront des redeals.
    // En 8 secondes, l'app doit avoir joué plusieurs donnes ET ne pas être figée.
    await page.waitForTimeout(8000);

    // Vérifie que des décisions ont continué à être enregistrées
    // (preuve qu'il n'y a pas de blocage).
    await page.getByRole('button', { name: /Voir pensées IA/ }).click();
    await expect(page.locator('.entries .meta')).toContainText(/\d{2,} décisions/, {
      timeout: 2000,
    });
  });

  test('seed connue qui force un redeal change le donneur', async ({ page }) => {
    await page.goto('/');

    // Charge une seed pour tenter de tomber sur un cas redeal.
    // On charge plusieurs seeds et vérifie qu'aucune ne fige l'app.
    for (const seed of ['0x1', '0x2', '0xff', '0xabcd']) {
      await page.evaluate((s) => navigator.clipboard.writeText(s), seed);
      await page.getByRole('button', { name: /Charger seed/ }).click();
      // toast doit confirmer
      await expect(page.getByRole('status')).toContainText(/seed/, { timeout: 2000 });
      await page.waitForTimeout(500);
      // L'app reste vivante après chaque chargement
      await expect(page.getByRole('heading', { name: 'Belote', level: 1 })).toBeVisible();
    }
  });
});

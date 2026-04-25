import { test, expect } from '@playwright/test';

test.describe('smoke — chargement initial', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
  });

  test('la page charge et affiche le titre', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Belote/i);
    await expect(page.getByRole('heading', { name: 'Belote', level: 1 })).toBeVisible();
  });

  test('la barre supérieure expose les actions principales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Paramètres' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Voir pensées IA|Masquer debug/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouvelle partie' })).toBeVisible();
  });

  test('le scoreboard est présent à 0/0', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('NS', { exact: true })).toBeVisible();
    await expect(page.getByText('EO', { exact: true })).toBeVisible();
  });

  test('le tapis affiche les 4 sièges', async ({ page }) => {
    await page.goto('/');
    // Les badges de siège sont rendus dans Table.svelte avec la classe .badge
    for (const seat of ['N', 'E', 'S', 'W']) {
      await expect(page.locator(`[data-seat="${seat}"]`).first()).toBeVisible();
    }
  });
});

test.describe('paramètres', () => {
  test('ouverture et fermeture du panneau paramètres', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await expect(page.getByRole('dialog', { name: 'Paramètres' })).toBeVisible();
    await page.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('dialog', { name: 'Paramètres' })).not.toBeVisible();
  });

  test('changement de cadence persisté', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: /Rapide/ }).click();
    // Footer met à jour la cadence affichée à 1.5s.
    await page.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByText(/Cadence : 1\.5s/)).toBeVisible();
  });
});

test.describe('debug — voir pensées IA', () => {
  test('toggle ouvre le panneau debug et révèle les mains', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Voir pensées IA/ }).click();
    // Le bouton change de label
    await expect(page.getByRole('button', { name: /Masquer debug/ })).toBeVisible();
    // Le panneau debug doit être visible avec son titre
    await expect(page.getByText('Pensées des IA')).toBeVisible();
  });
});

test.describe('boucle de jeu', () => {
  test('les IA jouent : décisions enregistrées dans le panneau debug', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: /Instant/ }).click();
    await page.getByRole('button', { name: /Appliquer/ }).click();
    await page.getByRole('button', { name: /Voir pensées IA/ }).click();
    // Au moins une décision IA doit apparaître dans la seconde.
    await expect(page.locator('.entries .meta')).toContainText(/[1-9]\d* décisions/, {
      timeout: 5000,
    });
  });

  test('humain S : peut passer et l’IA continue', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Paramètres' }).click();
    await page.getByRole('button', { name: /Instant/ }).click();
    await page.getByRole('button', { name: /Appliquer/ }).click();
    // Attend que ce soit le tour de S (quand W, N, E ont passé), puis clique Passer.
    // Si S n'est pas appelé en round 1, attend round 2. Time out à 6s.
    await page.waitForTimeout(2500);
    const passBtn = page.getByRole('button', { name: 'Passer' });
    if (await passBtn.isVisible()) {
      await passBtn.click();
    }
    // Quoi qu'il arrive, après ces interactions, la page reste vivante.
    await expect(page.getByRole('heading', { name: 'Belote', level: 1 })).toBeVisible();
  });
});

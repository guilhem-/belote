import type { Page } from '@playwright/test';

/**
 * Init script à appeler dans chaque `beforeEach` : reset localStorage et
 * persiste des settings minimaux désactivant l'animation de distribution
 * (3s) pour ne pas ralentir / casser les e2e.
 *
 * Les settings écrits correspondent aux valeurs par défaut de la v1.
 */
export async function resetStorageWithoutAnim(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      const settings = {
        version: 1,
        humans: ['S'],
        aiLevels: { N: 4, E: 4, W: 4 },
        paceMs: 4000,
        bidPaceMs: 1000,
        endMode: 'points',
        targetPoints: 501,
        targetDeals: 4,
        beloteEnabled: true,
        trickLayout: 'cross',
        autoPlayLastCard: true,
        autoNextDeal: true,
        coachWarnings: false,
        dealAnimation: false,
        enforceTrumpAfterAnyCut: true,
      };
      localStorage.setItem('belote.settings.v1', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  });
}

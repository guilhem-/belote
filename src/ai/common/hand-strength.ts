import type { Card, Suit } from '@core/types';
import { TRUMP_RANK_VALUES } from '@core/rules/constants';

/** Évalue la force d'une main pour décider de prendre à `trump`. Échelle pratique 0-100. */
export function handStrength(hand: readonly Card[], trump: Suit, takerHasFaceUp: boolean): number {
  let score = 0;
  let trumps = 0;

  for (const c of hand) {
    if (c.suit === trump) {
      trumps++;
      score += TRUMP_RANK_VALUES[c.rank];
      // Bonus structurels.
      if (c.rank === 'J') score += 8;
      if (c.rank === '9') score += 5;
    } else {
      // As hors atout = appui solide.
      if (c.rank === 'A') score += 8;
      if (c.rank === '10') score += 3;
    }
  }
  // Bonus longueur atout.
  if (trumps >= 4) score += 8;
  if (trumps >= 5) score += 12;

  // Bonus prendre la retourne (1 atout supplémentaire connu).
  if (takerHasFaceUp) score += 6;

  return score;
}

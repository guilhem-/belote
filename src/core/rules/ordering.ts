import type { Card, Suit } from '../types';
import { PLAIN_RANK_ORDER, PLAIN_RANK_VALUES, TRUMP_RANK_ORDER, TRUMP_RANK_VALUES } from './constants';

export function cardStrength(card: Card, trump: Suit): number {
  const order = card.suit === trump ? TRUMP_RANK_ORDER : PLAIN_RANK_ORDER;
  const idx = order.indexOf(card.rank);
  if (idx === -1) throw new Error(`rang inconnu: ${card.rank}`);
  return idx;
}

export function cardPoints(card: Card, trump: Suit): number {
  return card.suit === trump ? TRUMP_RANK_VALUES[card.rank] : PLAIN_RANK_VALUES[card.rank];
}

/** Compare deux cartes de même couleur. */
export function compareSameSuit(a: Card, b: Card, trump: Suit): number {
  if (a.suit !== b.suit) throw new Error('compareSameSuit: couleurs differentes');
  return cardStrength(a, trump) - cardStrength(b, trump);
}

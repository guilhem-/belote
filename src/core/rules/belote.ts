import type { Card, Suit } from '../types';

/** Le joueur a-t-il R+D d'atout en main ? */
export function hasBeloteCombo(hand: readonly Card[], trump: Suit): boolean {
  const k = hand.some((c) => c.suit === trump && c.rank === 'K');
  const q = hand.some((c) => c.suit === trump && c.rank === 'Q');
  return k && q;
}

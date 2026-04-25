import type { Card, Seat, Suit, Trick } from '../types';
import { partner } from '../types';
import { cardStrength } from './ordering';
import { masterSeat } from './trick';

/**
 * Calcule les cartes légales pour `seat` étant donné le pli en cours et l'atout.
 * Implémente strictement les obligations de docs/rules-conventions.md §6.
 */
export function legalMoves(hand: readonly Card[], trick: Trick, trump: Suit, seat: Seat): Card[] {
  if (hand.length === 0) return [];

  // Cas 1 : seat entame le pli — tout est jouable.
  if (trick.cards.length === 0) {
    return hand.slice();
  }

  const lead = trick.cards[0]!;
  const ledSuit = lead.card.suit;

  const inLed = hand.filter((c) => c.suit === ledSuit);
  const partnerSeat = partner(seat);
  const currentMaster = masterSeat(trick, trump);
  const partnerMaster = currentMaster === partnerSeat;

  if (inLed.length > 0) {
    if (ledSuit === trump) {
      // Couleur demandée = atout.
      if (partnerMaster) {
        return inLed.slice();
      }
      // Doit monter à l'atout si possible.
      const highestPlayed = highestOfSuitInTrick(trick, trump, trump);
      const stronger = inLed.filter((c) => cardStrength(c, trump) > highestPlayed);
      return stronger.length > 0 ? stronger : inLed.slice();
    } else {
      // Couleur demandée non-atout : fournir, pas d'obligation de monter.
      return inLed.slice();
    }
  }

  // Pas la couleur demandée.
  if (partnerMaster) {
    return hand.slice();
  }

  const trumpsInHand = hand.filter((c) => c.suit === trump);
  if (trumpsInHand.length === 0) {
    // Doit défausser hors-atout.
    return hand.slice();
  }

  // Doit couper. Si déjà coupé adverse, sur-couper si possible.
  const highestTrumpInTrick = highestOfSuitInTrick(trick, trump, trump);
  if (highestTrumpInTrick >= 0) {
    const overcut = trumpsInHand.filter((c) => cardStrength(c, trump) > highestTrumpInTrick);
    return overcut.length > 0 ? overcut : trumpsInHand.slice();
  }
  return trumpsInHand.slice();
}

/** Renvoie la force de la plus haute carte de `suit` posée dans le pli, ou -1 si aucune. */
function highestOfSuitInTrick(trick: Trick, suit: Suit, trump: Suit): number {
  let best = -1;
  for (const pc of trick.cards) {
    if (pc.card.suit === suit) {
      const s = cardStrength(pc.card, trump);
      if (s > best) best = s;
    }
  }
  return best;
}

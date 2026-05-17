import type { Card, Seat, Suit, Trick } from '../types';
import { partner } from '../types';
import { cardStrength } from './ordering';
import { masterSeat } from './trick';

/** Options de variante de règles pour `legalMoves`. */
export interface LegalMovesOpts {
  /**
   * Si vrai : sur tour non-atout, quand le joueur n'a pas la couleur et qu'un
   * atout a déjà été joué dans le pli (même par le partenaire), il DOIT fournir
   * de l'atout (couper/sur-couper si possible). Supprime l'exception "partenaire
   * maître par coupe = défausse libre".
   *
   * Variante régionale FFB ("pisse obligatoire"). Default: false (règle FFB classique).
   */
  enforceTrumpAfterAnyCut?: boolean;
}

/**
 * Calcule les cartes légales pour `seat` étant donné le pli en cours et l'atout.
 * Implémente strictement les obligations de docs/rules-conventions.md §6.
 */
export function legalMoves(
  hand: readonly Card[],
  trick: Trick,
  trump: Suit,
  seat: Seat,
  opts: LegalMovesOpts = {},
): Card[] {
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
      // Couleur demandée = atout : obligation de monter si possible,
      // même si le partenaire est actuellement maître (règle FFB).
      const highestPlayed = highestOfSuitInTrick(trick, trump, trump);
      const stronger = inLed.filter((c) => cardStrength(c, trump) > highestPlayed);
      return stronger.length > 0 ? stronger : inLed.slice();
    } else {
      // Couleur demandée non-atout : fournir, pas d'obligation de monter.
      return inLed.slice();
    }
  }

  // Pas la couleur demandée.
  const highestTrumpInTrick = highestOfSuitInTrick(trick, trump, trump);
  const trumpHasBeenPlayed = highestTrumpInTrick >= 0;
  const forceTrump = opts.enforceTrumpAfterAnyCut === true && trumpHasBeenPlayed;

  if (partnerMaster && !forceTrump) {
    return hand.slice();
  }

  const trumpsInHand = hand.filter((c) => c.suit === trump);
  if (trumpsInHand.length === 0) {
    // Doit défausser hors-atout.
    return hand.slice();
  }

  // Doit couper. Si déjà coupé, sur-couper si possible (sauf si partenaire maître
  // via coupe sous option forceTrump : on doit fournir mais pas nécessairement monter
  // au-dessus du partenaire).
  if (trumpHasBeenPlayed) {
    if (forceTrump && partnerMaster) {
      // Partenaire maître par coupe : on doit fournir de l'atout mais sans obligation
      // de dépasser le partenaire. Si on a un atout > celui du partenaire, n'importe
      // quel atout reste légal.
      return trumpsInHand.slice();
    }
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

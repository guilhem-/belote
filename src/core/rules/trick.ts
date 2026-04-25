import type { CompletedTrick, PlayedCard, Seat, Suit, Trick } from '../types';
import { cardPoints, cardStrength } from './ordering';
import { DIX_DE_DER } from './constants';

/** Retourne l'index dans `trick.cards` du joueur actuellement maître du pli. */
export function masterIndex(trick: Trick, trump: Suit): number {
  if (trick.cards.length === 0) throw new Error('masterIndex: pli vide');
  const lead = trick.cards[0];
  if (!lead) throw new Error('masterIndex: pli vide');
  const ledSuit = lead.card.suit;

  let bestIdx = 0;
  let best: PlayedCard = lead;
  let bestIsTrump = best.card.suit === trump;

  for (let i = 1; i < trick.cards.length; i++) {
    const c = trick.cards[i];
    if (!c) continue;
    const isTrump = c.card.suit === trump;
    if (bestIsTrump) {
      if (isTrump && cardStrength(c.card, trump) > cardStrength(best.card, trump)) {
        best = c;
        bestIdx = i;
      }
    } else {
      if (isTrump) {
        best = c;
        bestIdx = i;
        bestIsTrump = true;
      } else if (c.card.suit === ledSuit && cardStrength(c.card, trump) > cardStrength(best.card, trump)) {
        best = c;
        bestIdx = i;
      }
    }
  }
  return bestIdx;
}

export function masterSeat(trick: Trick, trump: Suit): Seat {
  const idx = masterIndex(trick, trump);
  const c = trick.cards[idx];
  if (!c) throw new Error('masterSeat: index invalide');
  return c.seat;
}

export function resolveTrick(trick: Trick, trump: Suit, isLast: boolean): CompletedTrick {
  if (trick.cards.length !== 4) throw new Error('resolveTrick: pli incomplet');
  const winnerIdx = masterIndex(trick, trump);
  const winnerCard = trick.cards[winnerIdx];
  if (!winnerCard) throw new Error('resolveTrick: pli incoherent');
  const winner = winnerCard.seat;
  let points = 0;
  for (const c of trick.cards) {
    points += cardPoints(c.card, trump);
  }
  if (isLast) points += DIX_DE_DER;
  return {
    leader: trick.leader,
    cards: trick.cards,
    winner,
    points,
    isLast,
  };
}

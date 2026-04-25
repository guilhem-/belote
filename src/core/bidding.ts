import type { Bid, BidOutcome, BidPhase, Card, Seat } from './types';
import { SUITS, nextSeat } from './types';

export function createBidPhase(faceUp: Card, dealer: Seat): BidPhase {
  return {
    round: 1,
    toAct: nextSeat(dealer),
    bids: [],
    faceUp,
    dealer,
  };
}

/** Renvoie les bids légaux pour le siège qui doit parler. */
export function legalBids(phase: BidPhase): Bid[] {
  if (phase.round === 1) {
    return [{ kind: 'pass' }, { kind: 'take', trump: phase.faceUp.suit }];
  }
  const bids: Bid[] = [{ kind: 'pass' }];
  for (const s of SUITS) {
    if (s !== phase.faceUp.suit) bids.push({ kind: 'take', trump: s });
  }
  return bids;
}

export type BidApplyResult =
  | { kind: 'continue'; phase: BidPhase }
  | { kind: 'taken'; outcome: BidOutcome }
  | { kind: 'redeal' };

export function applyBid(phase: BidPhase, bid: Bid): BidApplyResult {
  // Validation.
  if (bid.kind === 'take') {
    if (phase.round === 1 && bid.trump !== phase.faceUp.suit) {
      throw new Error('round 1 : prise uniquement à la couleur de la retourne');
    }
    if (phase.round === 2 && bid.trump === phase.faceUp.suit) {
      throw new Error('round 2 : prise interdite à la couleur de la retourne');
    }
    return {
      kind: 'taken',
      outcome: { taker: phase.toAct, trump: bid.trump, tookFaceUp: phase.round === 1 },
    };
  }

  // Passe.
  const bids = [...phase.bids, { seat: phase.toAct, bid }];
  // Fin de tour ?
  const seatsActedThisRound = bids.length - (phase.round === 1 ? 0 : 4);
  if (seatsActedThisRound === 4) {
    if (phase.round === 1) {
      return {
        kind: 'continue',
        phase: { ...phase, round: 2, toAct: nextSeat(phase.dealer), bids },
      };
    }
    return { kind: 'redeal' };
  }
  return {
    kind: 'continue',
    phase: { ...phase, toAct: nextSeat(phase.toAct), bids },
  };
}

/** Vérifie qu'un bid est dans la liste légale. */
export function isLegalBid(phase: BidPhase, bid: Bid): boolean {
  const legals = legalBids(phase);
  return legals.some((b) => bidsEqual(b, bid));
}

export function bidsEqual(a: Bid, b: Bid): boolean {
  if (a.kind === 'pass' && b.kind === 'pass') return true;
  if (a.kind === 'take' && b.kind === 'take') return a.trump === b.trump;
  return false;
}

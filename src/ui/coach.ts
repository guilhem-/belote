// Logique d'évaluation Coach : compare le coup humain au top level4.
// Renvoie un message pédagogique si l'écart est significatif.

import type { Bid, Card, DealState, Seat, Suit, Trick } from '@core/types';
import { partner } from '@core/types';
import { masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
import { handStrength } from '@ai/common/hand-strength';
import type { AIPlayer, CandidatePlay } from '@ai/types';
import { RANK_LABEL, SUIT_GLYPH } from '@i18n/notation';

const DELTA_THRESHOLD = 25;

export interface CoachVerdict {
  recommended: Card;
  delta: number;
  rationale: string;
  explanation: string;
}

/** Compare le coup joué par l'humain à ce que recommanderait son coach (AI level4). */
export async function evaluateHumanPlay(
  coach: AIPlayer,
  state: DealState,
  seat: Seat,
  legal: readonly Card[],
  played: Card,
): Promise<CoachVerdict | null> {
  if (state.phase.kind !== 'playing') return null;
  const decision = await coach.chooseCard(state, legal);
  const reasoning = decision.reasoning;
  if (!('candidates' in reasoning) || reasoning.candidates.length === 0) return null;
  const candidates = reasoning.candidates as CandidatePlay[];
  const sorted = candidates.slice().sort((a, b) => b.score - a.score);
  const best = sorted[0]!;
  const playedCand = candidates.find(
    (c) => c.card.suit === played.suit && c.card.rank === played.rank,
  );
  if (!playedCand) return null;
  const delta = best.score - playedCand.score;
  if (delta < DELTA_THRESHOLD) return null;
  if (best.card.suit === played.suit && best.card.rank === played.rank) return null;

  const explanation = explain(state, seat, played, best.card, state.phase.current, delta);
  return { recommended: best.card, delta, rationale: best.rationale, explanation };
}

function lbl(c: Card): string {
  return `${RANK_LABEL[c.rank]}${SUIT_GLYPH[c.suit]}`;
}

export interface CoachBidVerdict {
  recommendation: Bid;
  /** Force de main estimée pour la meilleure option « take » envisagée. */
  bestStrength: number;
  threshold: number;
  explanation: string;
}

/** Compare l'enchère humaine à ce que le coach (level4) aurait fait. */
export function evaluateHumanBid(
  state: DealState,
  seat: Seat,
  allowed: readonly Bid[],
  played: Bid,
): CoachBidVerdict | null {
  if (state.phase.kind !== 'bidding') return null;
  const round = state.phase.phase.round;
  const threshold = round === 1 ? 48 : 56;
  const hand = state.hands[seat];
  // Calcule la force de main pour chaque take possible.
  let bestStrength = 0;
  let bestTake: Bid | null = null;
  for (const b of allowed) {
    if (b.kind !== 'take') continue;
    const wouldHaveFaceUp = round === 1;
    const augmented = wouldHaveFaceUp ? [...hand, state.faceUp] : hand;
    const s = handStrength(augmented, b.trump, wouldHaveFaceUp);
    if (s > bestStrength) {
      bestStrength = s;
      bestTake = b;
    }
  }
  const coachRec: Bid =
    bestStrength >= threshold && bestTake ? bestTake : { kind: 'pass' };

  if (bidsEqual(coachRec, played)) return null;

  const explanation = explainBid(played, coachRec, bestStrength, threshold, round);
  return { recommendation: coachRec, bestStrength, threshold, explanation };
}

function bidsEqual(a: Bid, b: Bid): boolean {
  if (a.kind === 'pass' && b.kind === 'pass') return true;
  if (a.kind === 'take' && b.kind === 'take') return a.trump === b.trump;
  return false;
}

function suitName(s: Suit): string {
  return SUIT_GLYPH[s];
}

function explainBid(played: Bid, rec: Bid, strength: number, threshold: number, round: 1 | 2): string {
  // Cas 1 : passe alors que coach aurait pris.
  if (played.kind === 'pass' && rec.kind === 'take') {
    return `Main estimée à ${strength.toFixed(0)} (seuil ${threshold} en tour ${round}). Prendre à ${suitName(rec.trump)} aurait été favorable.`;
  }
  // Cas 2 : prend alors que coach aurait passé.
  if (played.kind === 'take' && rec.kind === 'pass') {
    return `Main estimée à ${strength.toFixed(0)}, sous le seuil de ${threshold} en tour ${round}. Risque élevé de chuter — passer était plus sûr.`;
  }
  // Cas 3 : prend mais à la mauvaise couleur (ne devrait pas arriver souvent — coach prend la plus forte).
  if (played.kind === 'take' && rec.kind === 'take') {
    return `Prendre à ${suitName(rec.trump)} (force ${strength.toFixed(0)}) aurait été plus solide qu'à ${suitName(played.trump)}.`;
  }
  return '';
}

function explain(
  state: DealState,
  seat: Seat,
  played: Card,
  recommended: Card,
  trick: Trick,
  delta: number,
): string {
  if (state.phase.kind !== 'playing') return '';
  const trump = state.phase.trump;
  const partnerSeat = partner(seat);

  if (trick.cards.length > 0) {
    const masterIsPartner = masterSeat(trick, trump) === partnerSeat;
    const playedIsTrump = played.suit === trump;
    const playedPts = cardPoints(played, trump);
    const recPts = cardPoints(recommended, trump);

    if (!masterIsPartner && playedPts >= 10 && recPts < playedPts) {
      return `Tu donnes ${playedPts} points à l'adversaire qui maîtrise ce pli. Joue plutôt ${lbl(recommended)} (${recPts} pts) pour économiser.`;
    }

    if (masterIsPartner && playedIsTrump && (played.rank === 'J' || played.rank === '9')) {
      return `Le partenaire maîtrise déjà ce pli — pas besoin de gaspiller un atout aussi fort que ${lbl(played)}. ${lbl(recommended)} aurait suffi.`;
    }

    if (masterIsPartner && recPts > playedPts && (recommended.rank === '10' || recommended.rank === 'A')) {
      return `Le partenaire est maître. Tu peux lui donner ${recPts} points en posant ${lbl(recommended)} plutôt que ${lbl(played)}.`;
    }

    if (
      masterIsPartner &&
      playedIsTrump &&
      trick.cards[0]!.card.suit !== trump &&
      played.suit !== trick.cards[0]!.card.suit
    ) {
      return `Tu coupes ton propre partenaire qui maîtrise déjà le pli. ${lbl(recommended)} aurait préservé tes atouts.`;
    }

    if (
      !masterIsPartner &&
      cardStrength(recommended, trump) > cardStrength(played, trump) &&
      recommended.suit === played.suit
    ) {
      return `Tu pouvais prendre ce pli avec ${lbl(recommended)}. Avec ${lbl(played)} tu laisses la main à l'adversaire.`;
    }
  }

  if (trick.cards.length === 0) {
    if (recommended.suit !== trump && recommended.rank === 'A') {
      return `Entamer ${lbl(recommended)} (un as) sécurise un pli et appelle ton partenaire dans cette couleur.`;
    }
    if (played.suit === trump && cardPoints(played, trump) >= 10) {
      return `Sortir un atout fort en entame sans être preneur fort gaspille tes ressources. ${lbl(recommended)} ouvre mieux la donne.`;
    }
  }

  return `${lbl(recommended)} aurait été un meilleur choix dans cette situation (écart estimé : ${delta.toFixed(0)}).`;
}

// Logique d'évaluation Coach : compare le coup humain au top level4.
// Renvoie un message pédagogique si l'écart est significatif.

import type { Card, DealState, Seat, Trick } from '@core/types';
import { partner } from '@core/types';
import { masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
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

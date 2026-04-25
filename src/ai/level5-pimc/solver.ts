// Alpha-beta sur monde à information complète.
// Évalue la donne restante en supposant que tous les joueurs jouent rationnellement.
// Retourne l'espérance de score pour l'équipe de l'IA (ownTeam).

import type { Card, Hands, PlayedCard, Seat, Suit, Trick } from '@core/types';
import { SEAT_TEAM, nextSeat, sameCard } from '@core/types';
import { legalMoves } from '@core/rules/legal-moves';
import { masterIndex, masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
import { DIX_DE_DER } from '@core/rules/constants';

export interface SolverState {
  hands: Hands;
  currentTrick: Trick;
  trump: Suit;
  takerTeam: 'NS' | 'EW';
  /** Points cumulés pour chaque équipe (cartes des plis remportés jusqu'ici). */
  pointsNS: number;
  pointsEW: number;
  tricksRemaining: number;
}

export interface SolverResult {
  /** Score net du point de vue de l'équipe ownTeam à la fin de la donne (cartes seulement). */
  scoreOwn: number;
  bestCard: Card | null;
}

export function solve(state: SolverState, ownSeat: Seat, deadline: number, depth = 0): SolverResult {
  const ownTeam = SEAT_TEAM[ownSeat];

  // Cas terminal : plus de cartes.
  if (state.tricksRemaining === 0 && state.currentTrick.cards.length === 0) {
    const own = ownTeam === 'NS' ? state.pointsNS : state.pointsEW;
    return { scoreOwn: own, bestCard: null };
  }

  // Budget temps.
  if (Date.now() > deadline) {
    return { scoreOwn: heuristicEval(state, ownTeam), bestCard: null };
  }

  // Détermine le siège qui doit jouer.
  const seat = expectedSeat(state.currentTrick);
  const hand = state.hands[seat];
  const moves = legalMoves(hand, state.currentTrick, state.trump, seat);

  const isMaximizing = SEAT_TEAM[seat] === ownTeam;
  let best: SolverResult = isMaximizing
    ? { scoreOwn: -Infinity, bestCard: null }
    : { scoreOwn: Infinity, bestCard: null };

  // Move ordering : essaie en premier les coups les plus prometteurs (atouts forts, basses cartes).
  const ordered = orderMoves(moves, state, seat);

  for (const card of ordered) {
    const next = applyMove(state, seat, card);
    const r = solve(next, ownSeat, deadline, depth + 1);
    if (isMaximizing) {
      if (r.scoreOwn > best.scoreOwn) best = { scoreOwn: r.scoreOwn, bestCard: card };
    } else {
      if (r.scoreOwn < best.scoreOwn) best = { scoreOwn: r.scoreOwn, bestCard: card };
    }
    if (Date.now() > deadline) break;
  }

  if (!isFinite(best.scoreOwn)) {
    return { scoreOwn: heuristicEval(state, ownTeam), bestCard: ordered[0] ?? null };
  }
  return best;
}

function expectedSeat(trick: Trick): Seat {
  if (trick.cards.length === 0) return trick.leader;
  return nextSeat(trick.cards[trick.cards.length - 1]!.seat);
}

function applyMove(state: SolverState, seat: Seat, card: Card): SolverState {
  const newHand = state.hands[seat].filter((c) => !sameCard(c, card));
  const newHands: Hands = { ...state.hands, [seat]: Object.freeze(newHand) };
  const newCards: PlayedCard[] = [...state.currentTrick.cards, { seat, card }];
  if (newCards.length < 4) {
    return {
      ...state,
      hands: newHands,
      currentTrick: { leader: state.currentTrick.leader, cards: newCards },
    };
  }
  // Pli complet : résoudre.
  const trick: Trick = { leader: state.currentTrick.leader, cards: newCards };
  const winnerIdx = masterIndex(trick, state.trump);
  const winner = newCards[winnerIdx]!.seat;
  let pts = 0;
  for (const pc of newCards) pts += cardPoints(pc.card, state.trump);
  const isLast = state.tricksRemaining - 1 === 0;
  if (isLast) pts += DIX_DE_DER;
  const team = SEAT_TEAM[winner];
  return {
    hands: newHands,
    currentTrick: { leader: winner, cards: [] },
    trump: state.trump,
    takerTeam: state.takerTeam,
    pointsNS: state.pointsNS + (team === 'NS' ? pts : 0),
    pointsEW: state.pointsEW + (team === 'EW' ? pts : 0),
    tricksRemaining: state.tricksRemaining - 1,
  };
}

function orderMoves(moves: readonly Card[], state: SolverState, seat: Seat): Card[] {
  // Heuristique : si on entame, essayer cartes fortes en premier.
  // Si on doit fournir, essayer la plus basse qui gagne d'abord.
  const trick = state.currentTrick;
  if (trick.cards.length === 0) {
    return moves.slice().sort((a, b) => cardStrength(b, state.trump) - cardStrength(a, state.trump));
  }
  const partnerMaster = (() => {
    return masterSeat(trick, state.trump) === partner(seat);
  })();
  if (partnerMaster) {
    // Essaie les cartes les plus précieuses d'abord (donne points).
    return moves.slice().sort((a, b) => cardPoints(b, state.trump) - cardPoints(a, state.trump));
  }
  // Sinon : essaie cartes hautes d'abord (peut gagner).
  return moves.slice().sort((a, b) => cardStrength(b, state.trump) - cardStrength(a, state.trump));
}

function partner(s: Seat): Seat {
  return s === 'N' ? 'S' : s === 'S' ? 'N' : s === 'E' ? 'W' : 'E';
}

function heuristicEval(state: SolverState, ownTeam: 'NS' | 'EW'): number {
  // Estimation rapide : points actuels + part proportionnelle des points restants.
  const remainingPoints = 152 - state.pointsNS - state.pointsEW + DIX_DE_DER;
  const own = ownTeam === 'NS' ? state.pointsNS : state.pointsEW;
  // 50% par défaut.
  return own + remainingPoints * 0.5;
}

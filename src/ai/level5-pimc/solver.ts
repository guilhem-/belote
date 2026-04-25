// Alpha-beta véritable sur monde à information complète.
// Maximise les points de l'équipe `ownTeam` à la fin de la donne.
// - Vraies coupures alpha/beta propagées (pas min-max).
// - Transposition table par état (hands restantes encodées en bitmask).
// - Move ordering pour maximiser les coupures.

import type { Card, Hands, PlayedCard, Seat, Suit, Trick } from '@core/types';
import { SEAT_TEAM, nextSeat, sameCard } from '@core/types';
import { legalMoves } from '@core/rules/legal-moves';
import { masterIndex, masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
import { DIX_DE_DER, TOTAL_DEAL_POINTS } from '@core/rules/constants';

export interface SolverState {
  hands: Hands;
  currentTrick: Trick;
  trump: Suit;
  pointsNS: number;
  pointsEW: number;
  tricksRemaining: number; // plis encore à jouer (incluant le pli courant)
}

export interface SolverResult {
  /** Points cartes finaux pour l'équipe ownTeam (0..162). */
  scoreOwn: number;
  bestCard: Card | null;
}

interface Ctx {
  ownSeat: Seat;
  ownTeam: 'NS' | 'EW';
  deadline: number;
  trans: Map<string, number>;
  nodes: number;
}

export function solve(state: SolverState, ownSeat: Seat, deadline: number): SolverResult {
  const ctx: Ctx = {
    ownSeat,
    ownTeam: SEAT_TEAM[ownSeat],
    deadline,
    trans: new Map(),
    nodes: 0,
  };
  const { score, card } = alphabeta(state, -Infinity, Infinity, ctx);
  return { scoreOwn: score, bestCard: card };
}

function alphabeta(
  state: SolverState,
  alpha: number,
  beta: number,
  ctx: Ctx,
): { score: number; card: Card | null } {
  ctx.nodes++;

  const totalCardsLeft = state.hands.N.length + state.hands.E.length + state.hands.S.length + state.hands.W.length;
  if (totalCardsLeft === 0) {
    const own = ctx.ownTeam === 'NS' ? state.pointsNS : state.pointsEW;
    return { score: own, card: null };
  }

  // Budget temps : si dépassé, on retombe sur une heuristique plus fine que 50/50.
  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) {
    return { score: heuristicEval(state, ctx.ownTeam), card: null };
  }

  // Transposition table — uniquement quand le pli courant est vide (état "propre").
  let key: string | null = null;
  if (state.currentTrick.cards.length === 0) {
    key = encodeKey(state, ctx.ownSeat);
    const cached = ctx.trans.get(key);
    if (cached !== undefined) return { score: cached, card: null };
  }

  const seat = expectedSeat(state.currentTrick);
  const isMaximizing = SEAT_TEAM[seat] === ctx.ownTeam;
  const moves = orderMoves(legalMoves(state.hands[seat], state.currentTrick, state.trump, seat), state, isMaximizing);

  let bestCard: Card | null = moves[0] ?? null;
  let bestScore = isMaximizing ? -Infinity : Infinity;

  for (const card of moves) {
    const next = applyMove(state, seat, card);
    const r = alphabeta(next, alpha, beta, ctx);
    if (isMaximizing) {
      if (r.score > bestScore) {
        bestScore = r.score;
        bestCard = card;
      }
      if (bestScore > alpha) alpha = bestScore;
    } else {
      if (r.score < bestScore) {
        bestScore = r.score;
        bestCard = card;
      }
      if (bestScore < beta) beta = bestScore;
    }
    if (alpha >= beta) break; // coupure
    if (Date.now() > ctx.deadline) break;
  }

  if (!isFinite(bestScore)) {
    bestScore = heuristicEval(state, ctx.ownTeam);
  }
  if (key !== null) ctx.trans.set(key, bestScore);
  return { score: bestScore, card: bestCard };
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
    pointsNS: state.pointsNS + (team === 'NS' ? pts : 0),
    pointsEW: state.pointsEW + (team === 'EW' ? pts : 0),
    tricksRemaining: state.tricksRemaining - 1,
  };
}

function orderMoves(moves: readonly Card[], state: SolverState, isMaximizing: boolean): Card[] {
  // En max : essaye les coups les plus payants d'abord (+pts, +force atout).
  // En min : on inverse pour favoriser les coupures côté adverse.
  const trick = state.currentTrick;
  const sorted = moves.slice();

  if (trick.cards.length === 0) {
    sorted.sort((a, b) => cardStrength(b, state.trump) - cardStrength(a, state.trump));
  } else {
    const partnerSeat = partner(expectedSeat(trick));
    const pMaster = masterSeat(trick, state.trump) === partnerSeat;
    if (pMaster) {
      // Donner gros (max) ou éviter (min).
      sorted.sort((a, b) => cardPoints(b, state.trump) - cardPoints(a, state.trump));
    } else {
      sorted.sort((a, b) => cardStrength(b, state.trump) - cardStrength(a, state.trump));
    }
  }
  if (!isMaximizing) sorted.reverse();
  return sorted;
}

function partner(s: Seat): Seat {
  return s === 'N' ? 'S' : s === 'S' ? 'N' : s === 'E' ? 'W' : 'E';
}

/** Encodage déterministe pour la table de transposition.
 *  Dépend uniquement de : cartes restantes par siège (triées) + atout + leader courant + ownSeat. */
function encodeKey(state: SolverState, ownSeat: Seat): string {
  const enc = (cards: readonly Card[]): string =>
    cards
      .map((c) => `${c.rank}${c.suit}`)
      .sort()
      .join(',');
  return [
    state.trump,
    state.currentTrick.leader,
    ownSeat,
    enc(state.hands.N),
    enc(state.hands.E),
    enc(state.hands.S),
    enc(state.hands.W),
  ].join('|');
}

/** Heuristique d'éval à la coupure : points actuels + estimation des points restants
 *  pondérée par force des atouts en main de chaque équipe. */
function heuristicEval(state: SolverState, ownTeam: 'NS' | 'EW'): number {
  const own = ownTeam === 'NS' ? state.pointsNS : state.pointsEW;
  const remainingCards: Card[] = [
    ...state.hands.N,
    ...state.hands.E,
    ...state.hands.S,
    ...state.hands.W,
  ];
  let remainingPts = state.tricksRemaining > 0 ? DIX_DE_DER : 0;
  for (const c of remainingCards) remainingPts += cardPoints(c, state.trump);

  // Estime la part de l'équipe own : ratio (force atouts own / total force atouts).
  const ownSeats: Seat[] = ownTeam === 'NS' ? ['N', 'S'] : ['E', 'W'];
  const oppSeats: Seat[] = ownTeam === 'NS' ? ['E', 'W'] : ['N', 'S'];
  let ownTrumpStrength = 0;
  let oppTrumpStrength = 0;
  for (const s of ownSeats) {
    for (const c of state.hands[s]) {
      if (c.suit === state.trump) ownTrumpStrength += cardStrength(c, state.trump) + 1;
    }
  }
  for (const s of oppSeats) {
    for (const c of state.hands[s]) {
      if (c.suit === state.trump) oppTrumpStrength += cardStrength(c, state.trump) + 1;
    }
  }
  const totalTrump = ownTrumpStrength + oppTrumpStrength;
  const ratio = totalTrump > 0 ? ownTrumpStrength / totalTrump : 0.5;
  // Lissage vers 0.5 : on n'extrapole pas trop.
  const blended = 0.4 + 0.2 * (ratio - 0.5) * 2; // entre ~0.3 et ~0.5
  const estim = own + remainingPts * blended;
  // Borne supérieure : on ne peut jamais dépasser 162 points cartes.
  return Math.min(estim, TOTAL_DEAL_POINTS);
}

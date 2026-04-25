// Alpha-beta véritable sur monde à information complète.
// Maximise le score de donne (et non les points cartes bruts) du point de vue de ownTeam :
// la falaise à 82 (taker tient vs dedans) est le facteur dominant en Belote — un coup qui
// fait passer le preneur de 81 à 82 vaut bien plus qu'un point brut.
//
// - Vraies coupures alpha/beta propagées.
// - Transposition table par état (uniquement quand pli courant vide).
// - Move ordering différencié pour favoriser les cutoffs.
// - Belote/rebelote prise en compte si elle est connue (couple R+D atout chez un joueur).

import type { Card, Hands, PlayedCard, Seat, Suit, Trick } from '@core/types';
import { SEAT_TEAM, nextSeat, sameCard } from '@core/types';
import { legalMoves } from '@core/rules/legal-moves';
import { masterIndex, masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
import {
  BELOTE_BONUS,
  CAPOT_BONUS,
  DIX_DE_DER,
  TOTAL_DEAL_POINTS,
} from '@core/rules/constants';

export interface SolverState {
  hands: Hands;
  currentTrick: Trick;
  trump: Suit;
  takerTeam: 'NS' | 'EW';
  pointsNS: number;
  pointsEW: number;
  /** Plis remportés par chaque équipe (pour détecter capot). */
  tricksNS: number;
  tricksEW: number;
  tricksRemaining: number;
  /** Belote dans la donne : équipe ayant R+D atout (si connu côté ownSeat). */
  beloteTeam: 'NS' | 'EW' | null;
}

export interface SolverResult {
  /** Score de donne final pour l'équipe ownTeam (peut atteindre 282 si capot+belote). */
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

  const totalCardsLeft =
    state.hands.N.length + state.hands.E.length + state.hands.S.length + state.hands.W.length;

  if (totalCardsLeft === 0) {
    return { score: dealScoreOwn(state, ctx.ownTeam), card: null };
  }

  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) {
    return { score: heuristicEval(state, ctx.ownTeam), card: null };
  }

  let key: string | null = null;
  if (state.currentTrick.cards.length === 0) {
    key = encodeKey(state, ctx.ownSeat);
    const cached = ctx.trans.get(key);
    if (cached !== undefined) return { score: cached, card: null };
  }

  const seat = expectedSeat(state.currentTrick);
  const isMaximizing = SEAT_TEAM[seat] === ctx.ownTeam;
  const moves = orderMoves(
    legalMoves(state.hands[seat], state.currentTrick, state.trump, seat),
    state,
    isMaximizing,
  );

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
    if (alpha >= beta) break;
    if (Date.now() > ctx.deadline) break;
  }

  if (!isFinite(bestScore)) bestScore = heuristicEval(state, ctx.ownTeam);
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
    takerTeam: state.takerTeam,
    pointsNS: state.pointsNS + (team === 'NS' ? pts : 0),
    pointsEW: state.pointsEW + (team === 'EW' ? pts : 0),
    tricksNS: state.tricksNS + (team === 'NS' ? 1 : 0),
    tricksEW: state.tricksEW + (team === 'EW' ? 1 : 0),
    tricksRemaining: state.tricksRemaining - 1,
    beloteTeam: state.beloteTeam,
  };
}

function orderMoves(moves: readonly Card[], state: SolverState, isMaximizing: boolean): Card[] {
  const trick = state.currentTrick;
  const sorted = moves.slice();
  if (trick.cards.length === 0) {
    sorted.sort((a, b) => cardStrength(b, state.trump) - cardStrength(a, state.trump));
  } else {
    const partnerSeat = partner(expectedSeat(trick));
    const pMaster = masterSeat(trick, state.trump) === partnerSeat;
    if (pMaster) {
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
    state.takerTeam,
    enc(state.hands.N),
    enc(state.hands.E),
    enc(state.hands.S),
    enc(state.hands.W),
  ].join('|');
}

/** Score de donne final selon les règles FFB (cf docs/rules-conventions.md §11). */
function dealScoreOwn(state: SolverState, ownTeam: 'NS' | 'EW'): number {
  const takerTeam = state.takerTeam;
  const defTeam: 'NS' | 'EW' = takerTeam === 'NS' ? 'EW' : 'NS';
  const takerCard = takerTeam === 'NS' ? state.pointsNS : state.pointsEW;
  const defCard = takerTeam === 'NS' ? state.pointsEW : state.pointsNS;
  const takerBelote = state.beloteTeam === takerTeam ? BELOTE_BONUS : 0;
  const defBelote = state.beloteTeam === defTeam ? BELOTE_BONUS : 0;
  const takerTricks = takerTeam === 'NS' ? state.tricksNS : state.tricksEW;

  let takerScore = 0;
  let defScore = 0;
  if (takerTricks === 8) {
    takerScore = TOTAL_DEAL_POINTS + CAPOT_BONUS + takerBelote;
    defScore = defBelote;
  } else if (state.tricksNS + state.tricksEW === 8 && takerTricks === 0) {
    takerScore = takerBelote;
    defScore = TOTAL_DEAL_POINTS + CAPOT_BONUS + defBelote;
  } else {
    const takerTotal = takerCard + takerBelote;
    const defTotal = defCard + defBelote;
    if (takerTotal > defTotal) {
      takerScore = takerTotal;
      defScore = defTotal;
    } else {
      takerScore = takerBelote;
      defScore = TOTAL_DEAL_POINTS + defBelote;
    }
  }

  return ownTeam === takerTeam ? takerScore : defScore;
}

/** Heuristique d'éval à coupure : projection du score de donne basée sur les points
 *  déjà acquis + estimation de répartition des points restants pondérée par force atouts. */
function heuristicEval(state: SolverState, ownTeam: 'NS' | 'EW'): number {
  const remainingCards: Card[] = [
    ...state.hands.N,
    ...state.hands.E,
    ...state.hands.S,
    ...state.hands.W,
  ];
  let remainingPts = state.tricksRemaining > 0 ? DIX_DE_DER : 0;
  for (const c of remainingCards) remainingPts += cardPoints(c, state.trump);

  const takerSeats: Seat[] = state.takerTeam === 'NS' ? ['N', 'S'] : ['E', 'W'];
  let takerTrumpStrength = 0;
  let defTrumpStrength = 0;
  for (const s of takerSeats) {
    for (const c of state.hands[s]) {
      if (c.suit === state.trump) takerTrumpStrength += cardStrength(c, state.trump) + 1;
    }
  }
  for (const s of (['N', 'E', 'S', 'W'] as Seat[]).filter((x) => !takerSeats.includes(x))) {
    for (const c of state.hands[s]) {
      if (c.suit === state.trump) defTrumpStrength += cardStrength(c, state.trump) + 1;
    }
  }
  const totalTrump = takerTrumpStrength + defTrumpStrength;
  // Le preneur garde l'initiative à l'atout : biais 0.55 vers preneur si force égale.
  const takerRatio = totalTrump > 0 ? 0.55 + 0.4 * (takerTrumpStrength / totalTrump - 0.5) : 0.55;
  const takerEstimateCard =
    (state.takerTeam === 'NS' ? state.pointsNS : state.pointsEW) + remainingPts * takerRatio;

  // Projection du score de donne à partir de cette estim.
  const takerBelote = state.beloteTeam === state.takerTeam ? BELOTE_BONUS : 0;
  const defTeam: 'NS' | 'EW' = state.takerTeam === 'NS' ? 'EW' : 'NS';
  const defBelote = state.beloteTeam === defTeam ? BELOTE_BONUS : 0;
  const takerTotal = takerEstimateCard + takerBelote;
  const defTotal = TOTAL_DEAL_POINTS - takerEstimateCard + defBelote;

  let takerScore: number;
  let defScore: number;
  if (takerTotal > defTotal) {
    takerScore = takerTotal;
    defScore = defTotal;
  } else {
    takerScore = takerBelote;
    defScore = TOTAL_DEAL_POINTS + defBelote;
  }
  return ownTeam === state.takerTeam ? takerScore : defScore;
}

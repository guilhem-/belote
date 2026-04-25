// Reducer pur d'une donne complète : deal → bid → play 8 plis → score.
// Architecture : state immutable + apply(state, event) → state.

import type {
  Announcement,
  Bid,
  Card,
  CompletedTrick,
  DealResult,
  DealState,
  Hands,
  PlayedCard,
  Seat,
  Trick,
} from './types';
import { nextSeat, sameCard } from './types';
import { dealAfterTake, dealInitial } from './deck';
import { createRng } from './rng';
import { applyBid, createBidPhase, isLegalBid } from './bidding';
import { legalMoves } from './rules/legal-moves';
import { resolveTrick } from './rules/trick';
import { hasBeloteCombo } from './rules/belote';
import { scoreDeal } from './scoring';

export type GameEvent =
  | { type: 'bid'; seat: Seat; bid: Bid }
  | { type: 'play'; seat: Seat; card: Card; announceBelote?: boolean };

/** Crée la donne initiale (cartes distribuées 5+retourne, phase = bidding).
 *  Les 11 cartes restantes sont reconstruites à la demande via `reconstructRemaining`
 *  pour garder DealState 100% sérialisable. */
export function startDeal(seed: number, dealer: Seat): DealState {
  const rng = createRng(seed);
  const { hands, faceUp } = dealInitial(rng, dealer);
  const phase = createBidPhase(faceUp, dealer);
  return {
    dealer,
    hands,
    faceUp,
    phase: { kind: 'bidding', phase },
    announcements: [],
    seed,
  };
}

/** Recalcule deterministement les 8 dernières cartes (qui n'ont pas été distribuées
 *  initialement). On le refait depuis le seed pour rester pur. */
function reconstructRemaining(seed: number, dealer: Seat): Card[] {
  const rng = createRng(seed);
  const { remaining } = dealInitial(rng, dealer);
  return remaining;
}

export function apply(state: DealState, event: GameEvent): DealState {
  if (event.type === 'bid') {
    if (state.phase.kind !== 'bidding') throw new Error('apply bid: phase != bidding');
    if (event.seat !== state.phase.phase.toAct) {
      throw new Error(`apply bid: ${event.seat} ne doit pas parler (à ${state.phase.phase.toAct})`);
    }
    if (!isLegalBid(state.phase.phase, event.bid)) {
      throw new Error(`apply bid: bid illégal ${JSON.stringify(event.bid)}`);
    }
    const result = applyBid(state.phase.phase, event.bid);
    if (result.kind === 'continue') {
      return { ...state, phase: { kind: 'bidding', phase: result.phase } };
    }
    if (result.kind === 'redeal') {
      // Signal vers le caller : phase reste bidding mais on indique qu'il faut redistribuer.
      // Convention : on jette une exception spécifique. Plus propre : événement séparé.
      // Ici on retourne un état marqué via DealPhase.kind = 'scored' n'est pas adapté.
      // → On lève une erreur ; le caller (orchestrateur) gère le redeal.
      throw new RedealRequired();
    }
    // taken : passer en phase playing après distribution finale.
    const remaining = reconstructRemaining(state.seed, state.dealer);
    const fullHands = dealAfterTake(state.hands, state.faceUp, remaining, result.outcome.taker, state.dealer);
    const leader = nextSeat(state.dealer);
    return {
      ...state,
      hands: fullHands,
      phase: {
        kind: 'playing',
        trump: result.outcome.trump,
        taker: result.outcome.taker,
        current: { leader, cards: [] },
        tricks: [],
      },
    };
  }

  // event.type === 'play'
  if (state.phase.kind !== 'playing') throw new Error('apply play: phase != playing');
  const playing = state.phase;
  const expectedSeat = expectedToPlay(playing.current);
  if (event.seat !== expectedSeat) {
    throw new Error(`apply play: ${event.seat} ne doit pas jouer (attendu ${expectedSeat})`);
  }
  const hand = state.hands[event.seat];
  if (!hand.some((c) => sameCard(c, event.card))) {
    throw new Error(`apply play: ${event.seat} ne possède pas ${event.card.rank}${event.card.suit}`);
  }
  const legal = legalMoves(hand, playing.current, playing.trump, event.seat);
  if (!legal.some((c) => sameCard(c, event.card))) {
    throw new Error(`apply play: coup illégal ${event.card.rank}${event.card.suit}`);
  }

  // Annonce belote/rebelote.
  let announcements: readonly Announcement[] = state.announcements;
  if (event.announceBelote === true) {
    if (event.card.suit !== playing.trump || (event.card.rank !== 'K' && event.card.rank !== 'Q')) {
      throw new Error('belote uniquement sur R ou D atout');
    }
    if (!hasBeloteCombo(hand, playing.trump)) {
      throw new Error('belote impossible : pas R+D atout en main');
    }
    const already = state.announcements.find((a) => a.seat === event.seat);
    const kind: Announcement['kind'] = already ? 'rebelote' : 'belote';
    announcements = [...state.announcements, { kind, seat: event.seat }];
  }

  // Pose la carte.
  const newHand = hand.filter((c) => !sameCard(c, event.card));
  const newHands: Hands = { ...state.hands, [event.seat]: Object.freeze(newHand) };
  const playedCard: PlayedCard = { seat: event.seat, card: event.card };
  const updatedTrick: Trick = { leader: playing.current.leader, cards: [...playing.current.cards, playedCard] };

  // Pli incomplet ?
  if (updatedTrick.cards.length < 4) {
    return {
      ...state,
      hands: newHands,
      announcements,
      phase: { ...playing, current: updatedTrick },
    };
  }

  // Pli complet → résolution.
  const isLast = playing.tricks.length === 7;
  const completed: CompletedTrick = resolveTrick(updatedTrick, playing.trump, isLast);
  const allTricks = [...playing.tricks, completed];

  if (allTricks.length < 8) {
    return {
      ...state,
      hands: newHands,
      announcements,
      phase: {
        ...playing,
        current: { leader: completed.winner, cards: [] },
        tricks: allTricks,
      },
    };
  }

  // 8 plis joués : score.
  const result: DealResult = scoreDeal({
    tricks: allTricks,
    taker: playing.taker,
    trump: playing.trump,
    announcements,
  });
  return {
    ...state,
    hands: newHands,
    announcements,
    phase: { kind: 'scored', result },
  };
}

export function expectedToPlay(trick: Trick): Seat {
  if (trick.cards.length === 0) return trick.leader;
  const last = trick.cards[trick.cards.length - 1];
  if (!last) return trick.leader;
  return nextSeat(last.seat);
}

export class RedealRequired extends Error {
  constructor() {
    super('Tous les joueurs ont passé deux tours, redistribution requise.');
    this.name = 'RedealRequired';
  }
}

/** Helper : à qui le tour ? null si phase scored. */
export function whoActs(state: DealState): Seat | null {
  if (state.phase.kind === 'bidding') return state.phase.phase.toAct;
  if (state.phase.kind === 'playing') return expectedToPlay(state.phase.current);
  return null;
}

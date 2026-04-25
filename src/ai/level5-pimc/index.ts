// IA niveau 5 : PIMC (Perfect-Information Monte-Carlo).
// 1) Maintient BeliefState (sets de cartes possibles par siège).
// 2) Pour chaque coup légal : échantillonne K mondes compatibles, résout alpha-beta sur chaque,
//    moyenne les espérances, choisit la carte de meilleure espérance.
import type { Bid, Card, DealState, Seat, Suit } from '@core/types';
import { SEAT_TEAM, partner } from '@core/types';
import type { AIConfig, AIPlayer, BidDecision, ObservableEvent, PlayDecision } from '../types';
import { handStrength } from '../common/hand-strength';
import { hasBeloteCombo } from '@core/rules/belote';
import { createDeck } from '@core/deck';
import { createRng, type Rng } from '@core/rng';
import { BeliefState } from './belief';
import { sampleWorld } from './sampler';
import { solve, type SolverState } from './solver';

const DEFAULT_TIME_BUDGET_MS = 500;
const DEFAULT_K_MIN = 8;
const DEFAULT_K_MAX = 40;

export function createLevel5AI(seat: Seat, config: AIConfig): AIPlayer {
  const rng: Rng = createRng(config.seed);
  const belief = new BeliefState(seat);
  let beloteAnnouncedByMe = false;
  let trump: Suit | null = null;
  let currentLedSuit: Suit | null = null;
  const deck = createDeck();

  return {
    config,
    seat,

    async chooseBid(state: DealState, allowed: readonly Bid[]): Promise<BidDecision> {
      // Bid : fallback heuristique de force de main (le PIMC sur enchères est trop coûteux).
      const hand = state.hands[seat];
      let bestBid: Bid = { kind: 'pass' };
      let bestStrength = 0;
      const round = state.phase.kind === 'bidding' ? state.phase.phase.round : 1;
      const threshold = round === 1 ? 46 : 54;
      const candidateBids: Array<{ bid: Bid; expectedScore: number; stdev: number }> = [];
      for (const b of allowed) {
        if (b.kind !== 'take') continue;
        const wouldHaveFaceUp = round === 1;
        const augmented = wouldHaveFaceUp ? [...hand, state.faceUp] : hand;
        const s = handStrength(augmented, b.trump, wouldHaveFaceUp);
        candidateBids.push({ bid: b, expectedScore: s, stdev: 0 });
        if (s > bestStrength) {
          bestStrength = s;
          bestBid = b;
        }
      }
      if (bestStrength < threshold) bestBid = { kind: 'pass' };
      return {
        bid: bestBid,
        reasoning: {
          level: 5,
          kind: 'pimc-bid',
          worldsEvaluated: 0,
          candidateBids,
          explanation: `force main meilleure couleur=${bestStrength} seuil=${threshold}`,
        },
      };
    },

    async chooseCard(state: DealState, legal: readonly Card[]): Promise<PlayDecision> {
      if (state.phase.kind !== 'playing') {
        return {
          card: legal[0]!,
          reasoning: {
            level: 5,
            kind: 'pimc',
            worldsUsed: 0,
            worldsBudgetMs: { used: 0, budget: 0 },
            belief: { cards: [] },
            candidates: [],
            conventionsObserved: [],
            explanation: 'fallback',
          },
        };
      }

      // Cas trivial : un seul coup légal.
      if (legal.length === 1) {
        const card = legal[0]!;
        const announceBelote = decideAnnounceBelote(card, state.hands[seat], trump, beloteAnnouncedByMe);
        if (announceBelote) beloteAnnouncedByMe = true;
        return {
          card,
          ...(announceBelote ? { announceBelote: true } : {}),
          reasoning: {
            level: 5,
            kind: 'pimc',
            worldsUsed: 0,
            worldsBudgetMs: { used: 0, budget: 0 },
            belief: { cards: [] },
            candidates: [{ card, score: 0, rationale: 'forcé', expectedScore: 0, stdev: 0, winRateInWorlds: 1 }],
            conventionsObserved: [],
            explanation: 'coup forcé',
          },
        };
      }

      const trumpEff = state.phase.trump;
      const takerEff = state.phase.taker;
      const ownTeam = SEAT_TEAM[seat];

      // Initialise belief si pas encore fait.
      // (En cas d'incohérence entre observe et state, on resynchronise.)
      if (belief.getOwnHand().length !== state.hands[seat].length) {
        belief.initialize(state.hands[seat], deck);
      }

      const budget = config.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
      const kMin = config.worldsK?.min ?? DEFAULT_K_MIN;
      const kMax = config.worldsK?.max ?? DEFAULT_K_MAX;
      const start = Date.now();
      const deadline = start + budget;

      // Pour chaque carte légale : accumule scores sur K mondes.
      const stats = new Map<string, { card: Card; sum: number; sumSq: number; wins: number; n: number }>();
      for (const c of legal) {
        const k = `${c.rank}${c.suit}`;
        stats.set(k, { card: c, sum: 0, sumSq: 0, wins: 0, n: 0 });
      }

      let worldsUsed = 0;
      while (worldsUsed < kMin || (worldsUsed < kMax && Date.now() < deadline)) {
        const world = sampleWorld(belief, rng);
        if (!world) break;
        const handsWithMine = { ...world.hands, [seat]: state.hands[seat] };

        for (const card of legal) {
          if (Date.now() > deadline) break;
          const after = simulatePlay(handsWithMine, state.phase.current, trumpEff, seat, card);
          const remaining = countTricksRemaining(after.hands);
          const init: SolverState = {
            hands: after.hands,
            currentTrick: after.trick,
            trump: trumpEff,
            takerTeam: SEAT_TEAM[takerEff],
            pointsNS: after.pointsNS,
            pointsEW: after.pointsEW,
            tricksRemaining: remaining,
          };
          const r = solve(init, seat, deadline);
          const own = r.scoreOwn;
          const s = stats.get(`${card.rank}${card.suit}`)!;
          s.sum += own;
          s.sumSq += own * own;
          s.n += 1;
          if (own >= 82) s.wins += 1;
        }
        worldsUsed += 1;
      }

      // Aggregate.
      const candidates = legal.map((c) => {
        const s = stats.get(`${c.rank}${c.suit}`)!;
        const mean = s.n > 0 ? s.sum / s.n : 0;
        const variance = s.n > 0 ? Math.max(0, s.sumSq / s.n - mean * mean) : 0;
        const stdev = Math.sqrt(variance);
        const winRate = s.n > 0 ? s.wins / s.n : 0;
        return {
          card: c,
          score: mean,
          rationale: `E=${mean.toFixed(1)} σ=${stdev.toFixed(1)} win=${(winRate * 100).toFixed(0)}%`,
          expectedScore: mean,
          stdev,
          winRateInWorlds: winRate,
        };
      });
      candidates.sort((a, b) => b.expectedScore - a.expectedScore);
      const chosen = candidates[0]!;
      const announceBelote = decideAnnounceBelote(chosen.card, state.hands[seat], trumpEff, beloteAnnouncedByMe);
      if (announceBelote) beloteAnnouncedByMe = true;

      return {
        card: chosen.card,
        ...(announceBelote ? { announceBelote: true } : {}),
        reasoning: {
          level: 5,
          kind: 'pimc',
          worldsUsed,
          worldsBudgetMs: { used: Date.now() - start, budget },
          belief: {
            cards: belief.snapshot().cards.map((x) => ({
              card: x.card,
              probabilities: distributeUniform(x.possibleSeats),
            })),
          },
          candidates,
          conventionsObserved: [],
          explanation: `${worldsUsed} mondes, ${candidates[0]!.rationale}`,
        },
      };
      void ownTeam;
      void partner;
    },

    observe(event: ObservableEvent): void {
      switch (event.type) {
        case 'deal-start':
          if (event.ownSeat === seat) {
            // On n'a pas encore l'atout — on initialisera après bidding-end.
            belief.initialize(event.ownHand, deck);
          }
          beloteAnnouncedByMe = false;
          break;
        case 'bidding-end':
          trump = event.trump;
          break;
        case 'final-hand':
          if (event.ownSeat === seat) {
            belief.initialize(event.ownHand, deck);
          }
          break;
        case 'play':
          belief.notePlay(event.seat, event.card, currentLedSuit ?? null);
          if (currentLedSuit === null) currentLedSuit = event.card.suit;
          break;
        case 'trick-end':
          currentLedSuit = null;
          break;
        case 'deal-end':
          beloteAnnouncedByMe = false;
          currentLedSuit = null;
          trump = null;
          break;
      }
    },

    dispose(): void {},
  };

  function distributeUniform(seats: Seat[]): Record<Seat, number> {
    const out: Record<Seat, number> = { N: 0, E: 0, S: 0, W: 0 };
    if (seats.length === 0) return out;
    const p = 1 / seats.length;
    for (const s of seats) out[s] = p;
    return out;
  }
}

function decideAnnounceBelote(card: Card, hand: readonly Card[], trump: Suit | null, alreadyAnnounced: boolean): boolean {
  if (!trump) return false;
  if (card.suit !== trump) return false;
  if (card.rank !== 'K' && card.rank !== 'Q') return false;
  if (!alreadyAnnounced) return hasBeloteCombo(hand, trump);
  const other = card.rank === 'K' ? 'Q' : 'K';
  return !hand.some((c) => c.suit === trump && c.rank === other);
}

function simulatePlay(
  hands: { N: readonly Card[]; E: readonly Card[]; S: readonly Card[]; W: readonly Card[] },
  trick: { leader: Seat; cards: readonly { seat: Seat; card: Card }[] },
  trumpSuit: Suit,
  seat: Seat,
  card: Card,
): {
  hands: { N: readonly Card[]; E: readonly Card[]; S: readonly Card[]; W: readonly Card[] };
  trick: { leader: Seat; cards: readonly { seat: Seat; card: Card }[] };
  pointsNS: number;
  pointsEW: number;
} {
  const newHand = hands[seat].filter((c) => c.rank !== card.rank || c.suit !== card.suit);
  const newHands = { ...hands, [seat]: Object.freeze(newHand) };
  const newCards = [...trick.cards, { seat, card }];
  if (newCards.length < 4) {
    return {
      hands: newHands,
      trick: { leader: trick.leader, cards: newCards },
      pointsNS: 0,
      pointsEW: 0,
    };
  }
  // Pli complet → résoudre via solver helpers (réimporter trick logic).
  // Pour rester simple, on retourne un état avec pli vide et 0 points : le solver fera le reste.
  // Mieux : on réinjecte ces 4 cartes via solver.applyMove. Mais simpler : on laisse le solver
  // recevoir un pli complet et il le résoudra à la prochaine itération.
  // Pour que le solver fonctionne, on lui passe le pli avec 4 cartes : il détectera et résoudra.
  return {
    hands: newHands,
    trick: { leader: trick.leader, cards: newCards },
    pointsNS: 0,
    pointsEW: 0,
  };
}

function countTricksRemaining(hands: { N: readonly Card[]; E: readonly Card[]; S: readonly Card[]; W: readonly Card[] }): number {
  return Math.max(hands.N.length, hands.E.length, hands.S.length, hands.W.length);
}

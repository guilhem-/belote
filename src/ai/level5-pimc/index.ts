// IA niveau 5 : PIMC (Perfect-Information Monte-Carlo) sur top-N candidats du level4.
// Stratégie :
//   1. Demande à level4 le scoring complet des coups légaux.
//   2. Filtre top-N candidats (N=2..3) à l'écart < TIE_THRESHOLD du meilleur.
//   3. Si shortlist=1, joue le coup level4 directement (PIMC inutile).
//   4. Sinon, échantillonne K mondes compatibles avec le BeliefState et résout
//      par alpha-beta vrai sur chaque monde, agrège les espérances par carte.
//   5. Choisit la carte de meilleure espérance, fallback level4 si PIMC ne s'est
//      pas exécuté assez (worldsUsed < seuil).

import type { Bid, Card, DealState, Seat, Suit } from '@core/types';
import { SEAT_TEAM } from '@core/types';
import type { AIConfig, AIPlayer, BidDecision, ObservableEvent, PlayDecision } from '../types';
import { handStrength } from '../common/hand-strength';
import { hasBeloteCombo } from '@core/rules/belote';
import { createDeck } from '@core/deck';
import { createRng, type Rng } from '@core/rng';
import { BeliefState } from './belief';
import { sampleWorld } from './sampler';
import { solve, type SolverState } from './solver';
import { createLevel4AI } from '../level4-deductive';

const DEFAULT_TIME_BUDGET_MS = 1500;
const DEFAULT_K_MIN = 6;
const DEFAULT_K_MAX = 50;
const TIE_THRESHOLD = 12; // écart score level4 jugé "ex aequo"
const MIN_WORLDS_FOR_TRUST = 4;

export function createLevel5AI(seat: Seat, config: AIConfig): AIPlayer {
  const rng: Rng = createRng(config.seed);
  const belief = new BeliefState(seat);
  const fallback = createLevel4AI(seat, { ...config, level: 4 });
  let beloteAnnouncedByMe = false;
  let currentLedSuit: Suit | null = null;
  const deck = createDeck();

  return {
    config,
    seat,

    async chooseBid(state: DealState, allowed: readonly Bid[]): Promise<BidDecision> {
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
          reasoning: emptyReasoning(),
        };
      }
      const trumpEff = state.phase.trump;
      const takerTeam: 'NS' | 'EW' = SEAT_TEAM[state.phase.taker];
      // Belote connue côté nous : si on tient R+Q atout, c'est notre équipe.
      // Sinon on suppose null (information bayésienne — non implémenté ici).
      const ownHas =
        state.hands[seat].some((c) => c.suit === trumpEff && c.rank === 'K') &&
        state.hands[seat].some((c) => c.suit === trumpEff && c.rank === 'Q');
      const beloteTeam: 'NS' | 'EW' | null = ownHas ? SEAT_TEAM[seat] : null;
      // Plis déjà remportés.
      let tricksNS = 0;
      let tricksEW = 0;
      for (const t of state.phase.tricks) {
        if (SEAT_TEAM[t.winner] === 'NS') tricksNS++;
        else tricksEW++;
      }
      // Points cartes par équipe déjà accumulés.
      let pointsNS = 0;
      let pointsEW = 0;
      for (const t of state.phase.tricks) {
        if (SEAT_TEAM[t.winner] === 'NS') pointsNS += t.points;
        else pointsEW += t.points;
      }

      // 1) Décision level4 = baseline garantie.
      const baseDecision = await fallback.chooseCard(state, legal);
      const baseCandidates = ('candidates' in baseDecision.reasoning
        ? baseDecision.reasoning.candidates
        : []) as Array<{ card: Card; score: number; rationale: string }>;

      if (legal.length === 1 || baseCandidates.length === 0) {
        return baseDecision;
      }

      // 2) Shortlist : top candidats à <= TIE_THRESHOLD du meilleur (max 3).
      const sortedBase = baseCandidates.slice().sort((a, b) => b.score - a.score);
      const topScore = sortedBase[0]!.score;
      const shortlist = sortedBase
        .filter((c) => topScore - c.score <= TIE_THRESHOLD)
        .slice(0, 3);

      if (shortlist.length <= 1) {
        return baseDecision;
      }

      // 3) Initialise belief si désynchro.
      if (belief.getOwnHand().length !== state.hands[seat].length) {
        belief.initialize(state.hands[seat], deck);
      }

      const budget = config.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
      const kMin = config.worldsK?.min ?? DEFAULT_K_MIN;
      const kMax = config.worldsK?.max ?? DEFAULT_K_MAX;
      const start = Date.now();
      const deadline = start + budget;

      // 4) Stats par carte : sum (espérance), sumSq (variance), wins (≥82).
      const stats = new Map<string, { card: Card; sum: number; sumSq: number; wins: number; n: number }>();
      for (const c of shortlist) {
        const id = `${c.card.rank}${c.card.suit}`;
        stats.set(id, { card: c.card, sum: 0, sumSq: 0, wins: 0, n: 0 });
      }

      let worldsUsed = 0;
      let sampleFailures = 0;
      while (worldsUsed < kMax && Date.now() < deadline) {
        if (worldsUsed >= kMin && Date.now() > deadline - 50) break;
        const world = sampleWorld(belief, rng);
        if (!world) {
          sampleFailures++;
          if (sampleFailures > 5) break;
          continue;
        }
        const handsWithMine: typeof world.hands = { ...world.hands, [seat]: state.hands[seat] };

        for (const c of shortlist) {
          if (Date.now() > deadline) break;
          const after = simulatePlay(handsWithMine, state.phase.current, trumpEff, seat, c.card);
          const remaining = countTricksRemaining(after.hands);
          const init: SolverState = {
            hands: after.hands,
            currentTrick: after.trick,
            trump: trumpEff,
            takerTeam,
            pointsNS,
            pointsEW,
            tricksNS,
            tricksEW,
            tricksRemaining: remaining,
            beloteTeam,
          };
          // Budget par carte : reste équitablement réparti sur le reste des mondes×cartes.
          const remainingCards = shortlist.length;
          const remainingWorldsEstim = Math.max(1, kMax - worldsUsed);
          const perDecisionBudget = (deadline - Date.now()) / Math.max(1, remainingCards * remainingWorldsEstim);
          const localDeadline = Date.now() + Math.max(20, Math.min(perDecisionBudget, 100));
          const r = solve(init, seat, Math.min(deadline, localDeadline));
          const own = r.scoreOwn;
          const s = stats.get(`${c.card.rank}${c.card.suit}`)!;
          s.sum += own;
          s.sumSq += own * own;
          s.n += 1;
          if (own >= 82) s.wins += 1;
        }
        worldsUsed += 1;
      }

      // 5) Si on n'a pas eu assez de mondes, fait confiance à level4.
      if (worldsUsed < MIN_WORLDS_FOR_TRUST) {
        return {
          ...baseDecision,
          reasoning: {
            level: 5,
            kind: 'pimc',
            worldsUsed,
            worldsBudgetMs: { used: Date.now() - start, budget },
            belief: { cards: [] },
            candidates: shortlist.map((c) => ({
              card: c.card,
              score: c.score,
              rationale: `L4 baseline (PIMC trop court : ${worldsUsed} mondes)`,
              expectedScore: 0,
              stdev: 0,
              winRateInWorlds: 0,
            })),
            conventionsObserved: [],
            explanation: `worlds=${worldsUsed} < seuil ${MIN_WORLDS_FOR_TRUST}, fallback level4`,
          },
        };
      }

      // 6) Score combiné : level4 (poids 0.7) + PIMC (poids 0.3, normalisé).
      //    PIMC seul est trop bruité pour battre level4 systématiquement, donc on biaise
      //    fortement vers level4 mais on laisse PIMC corriger les vrais ties.
      // Normalisation : level4 score ~ 0-100, PIMC mean ~ 0-282 → on rescale PIMC sur 100
      // en divisant par 2.82 pour comparer à level4.
      const candidates = shortlist.map((c) => {
        const id = `${c.card.rank}${c.card.suit}`;
        const s = stats.get(id)!;
        const mean = s.n > 0 ? s.sum / s.n : 0;
        const variance = s.n > 0 ? Math.max(0, s.sumSq / s.n - mean * mean) : 0;
        const stdev = Math.sqrt(variance);
        const winRate = s.n > 0 ? s.wins / s.n : 0;
        const pimcNormalized = mean / 2.82;
        const blended = c.score * 0.7 + pimcNormalized * 0.3;
        return {
          card: c.card,
          score: blended,
          rationale: `L4=${c.score.toFixed(1)} | PIMC E=${mean.toFixed(1)} σ=${stdev.toFixed(1)} win=${(winRate * 100).toFixed(0)}%`,
          expectedScore: mean,
          stdev,
          winRateInWorlds: winRate,
        };
      });
      candidates.sort((a, b) => b.score - a.score);
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
          explanation: `PIMC sur ${shortlist.length} candidats × ${worldsUsed} mondes`,
        },
      };
    },

    observe(event: ObservableEvent): void {
      fallback.observe(event);
      switch (event.type) {
        case 'deal-start':
          if (event.ownSeat === seat) {
            belief.initialize(event.ownHand, deck);
          }
          beloteAnnouncedByMe = false;
          break;
        case 'bidding-end':
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
        case 'belote-announce':
          if (event.seat === seat) beloteAnnouncedByMe = true;
          break;
        case 'trick-end':
          currentLedSuit = null;
          break;
        case 'deal-end':
          beloteAnnouncedByMe = false;
          currentLedSuit = null;
          break;
      }
    },

    dispose(): void {
      fallback.dispose();
    },
  };
}

function decideAnnounceBelote(card: Card, hand: readonly Card[], trump: Suit | null, alreadyAnnounced: boolean): boolean {
  if (!trump) return false;
  if (card.suit !== trump) return false;
  if (card.rank !== 'K' && card.rank !== 'Q') return false;
  if (!alreadyAnnounced) return hasBeloteCombo(hand, trump);
  const other = card.rank === 'K' ? 'Q' : 'K';
  return !hand.some((c) => c.suit === trump && c.rank === other);
}

function distributeUniform(seats: Seat[]): Record<Seat, number> {
  const out: Record<Seat, number> = { N: 0, E: 0, S: 0, W: 0 };
  if (seats.length === 0) return out;
  const p = 1 / seats.length;
  for (const s of seats) out[s] = p;
  return out;
}

function simulatePlay(
  hands: { N: readonly Card[]; E: readonly Card[]; S: readonly Card[]; W: readonly Card[] },
  trick: { leader: Seat; cards: readonly { seat: Seat; card: Card }[] },
  _trumpSuit: Suit,
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
  return {
    hands: newHands,
    trick: { leader: trick.leader, cards: newCards },
    pointsNS: 0,
    pointsEW: 0,
  };
}

function countTricksRemaining(hands: {
  N: readonly Card[];
  E: readonly Card[];
  S: readonly Card[];
  W: readonly Card[];
}): number {
  return Math.max(hands.N.length, hands.E.length, hands.S.length, hands.W.length);
}

function emptyReasoning(): PlayDecision['reasoning'] {
  return {
    level: 5,
    kind: 'pimc',
    worldsUsed: 0,
    worldsBudgetMs: { used: 0, budget: 0 },
    belief: { cards: [] },
    candidates: [],
    conventionsObserved: [],
    explanation: 'fallback',
  };
}

void SEAT_TEAM;

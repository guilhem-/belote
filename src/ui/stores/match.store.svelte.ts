// Store global Svelte (runes) du match en cours.
// Pilote l'orchestrateur, expose l'état réactif au reste de l'UI.
import type { Bid, Card, DealResult, DealState, MatchState, Seat, Trick } from '@core/types';
import { nextSeat } from '@core/types';
import { createMatch, applyDealResult } from '@core/match';
import { startDeal } from '@core/game-state';
import { legalMoves } from '@core/rules/legal-moves';
import { createRng, randomSeed } from '@core/rng';
import type { AIConfig, AIPlayer } from '@ai/types';
import { createAI } from '@ai/registry';
import { createWorkerAI } from '@/workers/ai.client';
import { legalBids } from '@core/bidding';
import { Orchestrator } from '../orchestrator';
import { debugStore } from './debug.store.svelte';
import { settingsStore } from './settings.store.svelte';
import { coachStore } from './coach.store.svelte';
import { evaluateHumanPlay, evaluateHumanBid } from '../coach';

function useWorkerForLevel(level: AIConfig['level']): boolean {
  return level >= 4;
}

interface UiState {
  match: MatchState;
  deal: DealState;
  dealSeed: number;
  awaitingHuman: Seat | null;
  /** Si non-null, on affiche ce pli (4 cartes complétées) au lieu du pli courant
   *  pendant la pause "voir le pli" liée à la cadence. */
  displayedTrick: Trick | null;
  /** Carte pré-sélectionnée par l'humain (cliquée avant son tour) ; jouée auto quand
   *  son tour arrive si elle est légale. */
  pendingHumanCard: { seat: Seat; card: Card } | null;
  /** Animation de distribution en cours (orchestrateur en attente). */
  dealingAnimation: boolean;
}

function deriveDealSeed(matchSeed: number, dealIndex: number, attempt = 0): number {
  // L'attempt est mixé dans le seed pour qu'un redeal de la même donne tire de
  // nouvelles cartes (sinon : tous passeraient à nouveau → boucle infinie).
  const mix = ((dealIndex + 1) * 0x9e3779b1) ^ ((attempt + 1) * 0x85ebca6b);
  const r = createRng((matchSeed ^ mix) >>> 0);
  return Math.floor(r.next() * 0x100000000) >>> 0;
}

function makeStore() {
  let state = $state<UiState>(initial());
  let orch: Orchestrator | null = null;
  let aisDispose: AIPlayer[] = [];
  /** Compteur de redistributions consécutives sur la donne courante. */
  let redealAttempt = 0;
  /** Coachs IA level4 par siège humain (créés à chaque match) — observent en parallèle. */
  let coachAIs: Partial<Record<Seat, AIPlayer>> = {};

  function settingsToMatchSettings() {
    const s = settingsStore.value;
    return {
      endMode: s.endMode,
      targetPoints: s.targetPoints,
      targetDeals: s.targetDeals,
      beloteEnabled: s.beloteEnabled,
    } as const;
  }

  function initial(): UiState {
    const seed = randomSeed();
    const ms = settingsStore.value;
    const match = createMatch(
      {
        endMode: ms.endMode,
        targetPoints: ms.targetPoints,
        targetDeals: ms.targetDeals,
        beloteEnabled: ms.beloteEnabled,
      },
      seed,
    );
    const dealSeed = deriveDealSeed(seed, 0);
    const deal = startDeal(dealSeed, match.currentDealer);
    return {
      match,
      deal,
      dealSeed,
      awaitingHuman: null,
      displayedTrick: null,
      pendingHumanCard: null,
      dealingAnimation: false,
    };
  }

  function buildAis(baseSeed: number): Partial<Record<Seat, AIPlayer>> {
    const ais: Partial<Record<Seat, AIPlayer>> = {};
    aisDispose.forEach((a) => a.dispose());
    aisDispose = [];
    const settings = settingsStore.value;
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      if (settings.humans.includes(seat)) continue;
      const level = settings.aiLevels[seat] ?? 4;
      const cfg: AIConfig = { level, seed: baseSeed + seat.charCodeAt(0) };
      const ai = useWorkerForLevel(level) ? createWorkerAI(seat, cfg) : createAI(seat, cfg);
      ais[seat] = ai;
      aisDispose.push(ai);
    }
    return ais;
  }

  function buildCoachAIs(baseSeed: number): void {
    Object.values(coachAIs).forEach((c) => c?.dispose());
    coachAIs = {};
    if (!settingsStore.value.coachWarnings) return;
    for (const seat of settingsStore.value.humans) {
      // Coach toujours level4 (heuristique, déterministe, rapide).
      coachAIs[seat] = createAI(seat, { level: 4, seed: baseSeed + seat.charCodeAt(0) + 999 });
    }
  }

  function startOrchestrator(): void {
    orch?.abort();
    const ais = buildAis(state.dealSeed);
    buildCoachAIs(state.dealSeed);
    orch = new Orchestrator(state.deal, { ais }, {
      paceMs: settingsStore.value.paceMs,
      bidPaceMs: settingsStore.value.bidPaceMs,
      onEvent: (ev, _before, after) => {
        state.deal = after;
        // Forward bid/play à tous les coachs.
        for (const c of Object.values(coachAIs)) {
          if (ev.type === 'bid') c?.observe({ type: 'bid', seat: ev.seat, bid: ev.bid });
          else if (ev.type === 'play') c?.observe({ type: 'play', seat: ev.seat, card: ev.card });
        }
        // Si l'enchère vient de se terminer, notifie bidding-end + final-hand aux coachs.
        if (after.phase.kind === 'playing') {
          const ph = after.phase;
          const wasBidding = ev.type === 'bid';
          if (wasBidding) {
            for (const [s, c] of Object.entries(coachAIs)) {
              c?.observe({
                type: 'bidding-end',
                taker: ph.taker,
                trump: ph.trump,
                tookFaceUp: false,
              });
              c?.observe({ type: 'final-hand', ownSeat: s as Seat, ownHand: after.hands[s as Seat] });
            }
          }
        }
      },
      onTrickComplete: (trick) =>
        new Promise<void>((resolve) => {
          // Affiche le pli complet pendant ~60% de la cadence, clamp [400ms, 3000ms].
          const pace = settingsStore.value.paceMs;
          const ms = Math.min(3000, Math.max(400, Math.round(pace * 0.6)));
          state.displayedTrick = { leader: trick.leader, cards: trick.cards.slice() };
          setTimeout(() => {
            state.displayedTrick = null;
            resolve();
          }, ms);
        }),
      onAwaitHuman: (seat) => {
        state.awaitingHuman = seat;
        if (state.deal.phase.kind === 'playing') {
          const playing = state.deal.phase;
          const legal = legalMoves(state.deal.hands[seat], playing.current, playing.trump, seat);

          // Pré-clic : si l'humain a déjà choisi une carte légale, la joue.
          const pending = state.pendingHumanCard;
          if (
            pending &&
            pending.seat === seat &&
            legal.some((c) => c.suit === pending.card.suit && c.rank === pending.card.rank)
          ) {
            const card = pending.card;
            state.pendingHumanCard = null;
            setTimeout(() => {
              if (orch && state.awaitingHuman === seat) {
                state.awaitingHuman = null;
                try {
                  orch.submitHumanAction({ type: 'play', seat, card });
                } catch {
                  /* ignore */
                }
              }
            }, 80);
            return;
          }

          // Auto-joue la carte si une seule carte légale et option activée.
          if (settingsStore.value.autoPlayLastCard && legal.length === 1) {
            const card = legal[0]!;
            setTimeout(() => {
              if (orch && state.awaitingHuman === seat) {
                state.awaitingHuman = null;
                try {
                  orch.submitHumanAction({ type: 'play', seat, card });
                } catch {
                  /* ignore */
                }
              }
            }, 120);
          }
        }
      },
      onDealEnd: (final) => {
        state.awaitingHuman = null;
        redealAttempt = 0;
        if (final.phase.kind === 'scored') {
          const result: DealResult = final.phase.result;
          state.match = applyDealResult(state.match, result);
          if (settingsStore.value.autoNextDeal && !state.match.finished) {
            const ms = Math.min(4000, Math.max(1500, settingsStore.value.paceMs));
            setTimeout(() => {
              if (!state.match.finished) nextDeal();
            }, ms);
          }
        }
      },
      onRedeal: () => {
        redealNow();
      },
      onAiReasoning: (seat, kind, reasoning, card, bid) => {
        debugStore.push({
          ts: Date.now(),
          seat,
          kind,
          reasoning,
          ...(card ? { card } : {}),
          ...(bid ? { bid } : {}),
        });
      },
    });

    // Notifie les coachs du démarrage de la donne (les sièges humains observent leur main).
    for (const [seat, coach] of Object.entries(coachAIs)) {
      coach?.observe({
        type: 'deal-start',
        dealer: state.deal.dealer,
        ownSeat: seat as Seat,
        ownHand: state.deal.hands[seat as Seat],
        faceUp: state.deal.faceUp,
      });
    }
    // Animation de distribution (3s) avant de lancer l'orchestrateur.
    if (settingsStore.value.dealAnimation) {
      state.dealingAnimation = true;
      const myOrch = orch;
      setTimeout(() => {
        // Ne lance que si l'orchestrateur courant est toujours le même (pas remplacé par newMatch/nextDeal).
        if (orch === myOrch) {
          state.dealingAnimation = false;
          void myOrch.run();
        }
      }, 3000);
    } else {
      void orch.run();
    }
  }

  function newMatch(seed: number = randomSeed()): void {
    orch?.abort();
    redealAttempt = 0;
    const match = createMatch(settingsToMatchSettings(), seed);
    const dealSeed = deriveDealSeed(seed, 0);
    const deal = startDeal(dealSeed, match.currentDealer);
    state = {
      match,
      deal,
      dealSeed,
      awaitingHuman: null,
      displayedTrick: null,
      pendingHumanCard: null,
      dealingAnimation: false,
    };
    debugStore.clear();
    startOrchestrator();
  }

  function nextDeal(): void {
    orch?.abort();
    if (state.match.finished) return;
    redealAttempt = 0;
    const dealIndex = state.match.deals.length;
    const dealer = state.match.currentDealer;
    const dealSeed = deriveDealSeed(state.match.seed, dealIndex);
    state.deal = startDeal(dealSeed, dealer);
    state.dealSeed = dealSeed;
    state.awaitingHuman = null;
    state.displayedTrick = null;
    state.dealingAnimation = false;
    startOrchestrator();
  }

  /** Redistribution après que tous ont passé deux tours.
   *  - Le donneur tourne (antihoraire) — règle FFB §14
   *  - Une nouvelle seed est dérivée via attempt incrémenté → cartes différentes
   *  - Le score du match est inchangé (aucune donne n'a été marquée) */
  function redealNow(): void {
    orch?.abort();
    if (state.match.finished) return;
    redealAttempt += 1;
    const dealIndex = state.match.deals.length;
    const newDealer: Seat = nextSeat(state.match.currentDealer);
    state.match = { ...state.match, currentDealer: newDealer };
    const dealSeed = deriveDealSeed(state.match.seed, dealIndex, redealAttempt);
    state.deal = startDeal(dealSeed, newDealer);
    state.dealSeed = dealSeed;
    state.awaitingHuman = null;
    state.displayedTrick = null;
    state.dealingAnimation = false;
    startOrchestrator();
  }

  function submitHumanBid(seat: Seat, bid: Bid): void {
    if (!orch) return;
    state.awaitingHuman = null;
    // Évaluation coach sur l'enchère.
    if (settingsStore.value.coachWarnings && coachAIs[seat] && state.deal.phase.kind === 'bidding') {
      try {
        const allowed = legalBids(state.deal.phase.phase);
        const verdict = evaluateHumanBid(state.deal, seat, allowed, bid);
        if (verdict) {
          coachStore.push({
            kind: 'bid',
            ts: Date.now(),
            seat,
            played: bid,
            recommended: verdict.recommendation,
            bestStrength: verdict.bestStrength,
            threshold: verdict.threshold,
            explanation: verdict.explanation,
          });
        }
      } catch {
        /* coach silencieux */
      }
    }
    // Notifie les coachs.
    for (const c of Object.values(coachAIs)) c?.observe({ type: 'bid', seat, bid });
    orch.submitHumanAction({ type: 'bid', seat, bid });
  }

  async function submitHumanPlay(seat: Seat, card: Card): Promise<void> {
    if (!orch) return;
    state.awaitingHuman = null;
    state.pendingHumanCard = null;

    // Évaluation coach (avant de soumettre, sinon le state a déjà avancé).
    const coach = coachAIs[seat];
    if (coach && state.deal.phase.kind === 'playing') {
      const playing = state.deal.phase;
      const legal = legalMoves(state.deal.hands[seat], playing.current, playing.trump, seat);
      try {
        const verdict = await evaluateHumanPlay(coach, state.deal, seat, legal, card);
        if (verdict) {
          coachStore.push({
            kind: 'play',
            ts: Date.now(),
            seat,
            played: card,
            recommended: verdict.recommended,
            delta: verdict.delta,
            rationale: verdict.rationale,
            explanation: verdict.explanation,
          });
        }
      } catch {
        /* coach silencieux */
      }
    }

    orch.submitHumanAction({ type: 'play', seat, card });
  }

  function preselectHumanCard(seat: Seat, card: Card): void {
    state.pendingHumanCard = { seat, card };
  }

  function clearPreselection(): void {
    state.pendingHumanCard = null;
  }

  startOrchestrator();

  return {
    get value(): UiState {
      return state;
    },
    newMatch,
    nextDeal,
    submitHumanBid,
    submitHumanPlay,
    preselectHumanCard,
    clearPreselection,
  };
}

export const matchStore = makeStore();

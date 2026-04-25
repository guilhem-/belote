// Store global Svelte (runes) du match en cours.
// Pilote l'orchestrateur, expose l'état réactif au reste de l'UI.
import type { Bid, Card, DealResult, DealState, MatchState, Seat, Trick } from '@core/types';
import { createMatch, applyDealResult } from '@core/match';
import { startDeal } from '@core/game-state';
import { createRng, randomSeed } from '@core/rng';
import type { AIConfig, AIPlayer } from '@ai/types';
import { createAI } from '@ai/registry';
import { createWorkerAI } from '@/workers/ai.client';
import { Orchestrator } from '../orchestrator';
import { debugStore } from './debug.store.svelte';
import { settingsStore } from './settings.store.svelte';

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
}

function deriveDealSeed(matchSeed: number, dealIndex: number): number {
  const r = createRng(matchSeed ^ ((dealIndex * 0x9e3779b1) >>> 0));
  return Math.floor(r.next() * 0x100000000) >>> 0;
}

function makeStore() {
  let state = $state<UiState>(initial());
  let orch: Orchestrator | null = null;
  let aisDispose: AIPlayer[] = [];

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
    return { match, deal, dealSeed, awaitingHuman: null, displayedTrick: null };
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

  function startOrchestrator(): void {
    orch?.abort();
    const ais = buildAis(state.dealSeed);
    orch = new Orchestrator(state.deal, { ais }, {
      paceMs: settingsStore.value.paceMs,
      onEvent: (_ev, _before, after) => {
        state.deal = after;
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
      },
      onDealEnd: (final) => {
        state.awaitingHuman = null;
        if (final.phase.kind === 'scored') {
          const result: DealResult = final.phase.result;
          state.match = applyDealResult(state.match, result);
        }
      },
      onRedeal: () => {
        nextDeal();
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
    void orch.run();
  }

  function newMatch(seed: number = randomSeed()): void {
    orch?.abort();
    const match = createMatch(settingsToMatchSettings(), seed);
    const dealSeed = deriveDealSeed(seed, 0);
    const deal = startDeal(dealSeed, match.currentDealer);
    state = { match, deal, dealSeed, awaitingHuman: null, displayedTrick: null };
    debugStore.clear();
    startOrchestrator();
  }

  function nextDeal(): void {
    orch?.abort();
    if (state.match.finished) return;
    const dealIndex = state.match.deals.length;
    const dealer = state.match.currentDealer;
    const dealSeed = deriveDealSeed(state.match.seed, dealIndex);
    state.deal = startDeal(dealSeed, dealer);
    state.dealSeed = dealSeed;
    state.awaitingHuman = null;
    state.displayedTrick = null;
    startOrchestrator();
  }

  function submitHumanBid(seat: Seat, bid: Bid): void {
    if (!orch) return;
    state.awaitingHuman = null;
    orch.submitHumanAction({ type: 'bid', seat, bid });
  }

  function submitHumanPlay(seat: Seat, card: Card): void {
    if (!orch) return;
    state.awaitingHuman = null;
    orch.submitHumanAction({ type: 'play', seat, card });
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
  };
}

export const matchStore = makeStore();

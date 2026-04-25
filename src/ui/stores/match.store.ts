// Store global Svelte (runes) du match en cours.
// Pilote l'orchestrateur, expose l'état réactif au reste de l'UI.
import type { Bid, Card, DealResult, DealState, MatchState, Seat } from '@core/types';
import { createMatch, DEFAULT_SETTINGS, applyDealResult } from '@core/match';
import { startDeal } from '@core/game-state';
import { createRng, randomSeed } from '@core/rng';
import type { AIConfig, AIPlayer } from '@ai/types';
import { createAI } from '@ai/registry';
import { Orchestrator } from '../orchestrator';

interface PlayerSetup {
  /** Sièges humains (0 ou 1 en pratique). */
  humans: Seat[];
  /** Niveau d'IA pour chaque siège non-humain. */
  aiLevels: Partial<Record<Seat, AIConfig['level']>>;
}

const DEFAULT_SETUP: PlayerSetup = {
  humans: ['S'],
  aiLevels: { N: 2, E: 2, W: 2 },
};

interface UiState {
  match: MatchState;
  deal: DealState;
  dealSeed: number;
  setup: PlayerSetup;
  awaitingHuman: Seat | null;
  paceMs: number;
}

function deriveDealSeed(matchSeed: number, dealIndex: number): number {
  const r = createRng(matchSeed ^ ((dealIndex * 0x9e3779b1) >>> 0));
  return Math.floor(r.next() * 0x100000000) >>> 0;
}

function makeStore() {
  let state = $state<UiState>(initial());
  let orch: Orchestrator | null = null;
  let aisDispose: AIPlayer[] = [];

  function initial(): UiState {
    const seed = randomSeed();
    const match = createMatch(DEFAULT_SETTINGS, seed);
    const dealSeed = deriveDealSeed(seed, 0);
    const deal = startDeal(dealSeed, match.currentDealer);
    return {
      match,
      deal,
      dealSeed,
      setup: DEFAULT_SETUP,
      awaitingHuman: null,
      paceMs: 700,
    };
  }

  function buildAis(setup: PlayerSetup, baseSeed: number): Partial<Record<Seat, AIPlayer>> {
    const ais: Partial<Record<Seat, AIPlayer>> = {};
    aisDispose.forEach((a) => a.dispose());
    aisDispose = [];
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      if (setup.humans.includes(seat)) continue;
      const level = setup.aiLevels[seat] ?? 2;
      const ai = createAI(seat, { level, seed: baseSeed + seat.charCodeAt(0) });
      ais[seat] = ai;
      aisDispose.push(ai);
    }
    return ais;
  }

  function startOrchestrator(): void {
    orch?.abort();
    const ais = buildAis(state.setup, state.dealSeed);
    orch = new Orchestrator(state.deal, { ais }, {
      paceMs: state.paceMs,
      onEvent: (_ev, _before, after) => {
        state.deal = after;
      },
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
    });
    void orch.run();
  }

  function newMatch(seed: number = randomSeed()): void {
    orch?.abort();
    const match = createMatch(DEFAULT_SETTINGS, seed);
    const dealSeed = deriveDealSeed(seed, 0);
    const deal = startDeal(dealSeed, match.currentDealer);
    state = {
      match,
      deal,
      dealSeed,
      setup: state.setup,
      awaitingHuman: null,
      paceMs: state.paceMs,
    };
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

  function setSetup(setup: PlayerSetup): void {
    state.setup = setup;
    newMatch(state.match.seed);
  }

  function setPace(ms: number): void {
    state.paceMs = ms;
  }

  // Démarre l'orchestrateur sur l'état initial.
  startOrchestrator();

  return {
    get value(): UiState {
      return state;
    },
    newMatch,
    nextDeal,
    submitHumanBid,
    submitHumanPlay,
    setSetup,
    setPace,
  };
}

export const matchStore = makeStore();

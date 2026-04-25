// Store global Svelte (runes) du match en cours.
import type { DealResult, DealState, MatchState, Seat } from '@core/types';
import { createMatch, DEFAULT_SETTINGS, applyDealResult } from '@core/match';
import { startDeal, apply, RedealRequired, type GameEvent, whoActs } from '@core/game-state';
import { randomSeed, createRng } from '@core/rng';

interface UiState {
  match: MatchState;
  deal: DealState;
  /** Seed dérivée pour la donne courante (différente du seed match pour varier). */
  dealSeed: number;
}

function deriveDealSeed(matchSeed: number, dealIndex: number): number {
  const r = createRng(matchSeed ^ ((dealIndex * 0x9e3779b1) >>> 0));
  return Math.floor(r.next() * 0x100000000) >>> 0;
}

function createInitialDeal(
  matchSeed: number,
  dealIndex: number,
  dealer: Seat,
): { deal: DealState; seed: number } {
  const seed = deriveDealSeed(matchSeed, dealIndex);
  const deal = startDeal(seed, dealer);
  return { deal, seed };
}

function makeStore() {
  let state = $state<UiState>(initial());

  function initial(): UiState {
    const seed = randomSeed();
    const match = createMatch(DEFAULT_SETTINGS, seed);
    const { deal, seed: dealSeed } = createInitialDeal(seed, 0, match.currentDealer);
    return { match, deal, dealSeed };
  }

  function newMatch(seed: number = randomSeed()): void {
    const match = createMatch(DEFAULT_SETTINGS, seed);
    const { deal, seed: dealSeed } = createInitialDeal(seed, 0, match.currentDealer);
    state = { match, deal, dealSeed };
  }

  function dispatch(event: GameEvent): void {
    try {
      const next = apply(state.deal, event);
      state.deal = next;
      if (next.phase.kind === 'scored') {
        const result: DealResult = next.phase.result;
        const updatedMatch = applyDealResult(state.match, result);
        state.match = updatedMatch;
      }
    } catch (e) {
      if (e instanceof RedealRequired) {
        const dealIndex = state.match.deals.length;
        const newDealer = state.match.currentDealer;
        const { deal, seed } = createInitialDeal(state.match.seed, dealIndex + Date.now(), newDealer);
        state.deal = deal;
        state.dealSeed = seed;
      } else {
        throw e;
      }
    }
  }

  function nextDeal(): void {
    if (state.match.finished) return;
    const dealIndex = state.match.deals.length;
    const dealer = state.match.currentDealer;
    const { deal, seed } = createInitialDeal(state.match.seed, dealIndex, dealer);
    state.deal = deal;
    state.dealSeed = seed;
  }

  return {
    get value(): UiState {
      return state;
    },
    get whoActs(): Seat | null {
      return whoActs(state.deal);
    },
    newMatch,
    dispatch,
    nextDeal,
  };
}

export const matchStore = makeStore();

import type { DealResult, MatchSettings, MatchState, Seat, Team } from './types';
import { nextSeat } from './types';

export function createMatch(settings: MatchSettings, seed: number, firstDealer: Seat = 'N'): MatchState {
  return {
    settings,
    nsTotal: 0,
    ewTotal: 0,
    deals: [],
    currentDealer: firstDealer,
    seed,
    finished: false,
    winner: null,
  };
}

export function applyDealResult(match: MatchState, result: DealResult): MatchState {
  const nsTotal = match.nsTotal + result.nsScore;
  const ewTotal = match.ewTotal + result.ewScore;
  const deals = [...match.deals, result];

  let finished = false;
  let winner: Team | 'draw' | null = null;

  if (match.settings.endMode === 'points') {
    const target = match.settings.targetPoints;
    if (nsTotal >= target || ewTotal >= target) {
      finished = true;
      if (nsTotal > ewTotal) winner = 'NS';
      else if (ewTotal > nsTotal) winner = 'EW';
      else winner = 'draw';
    }
  } else {
    if (deals.length >= match.settings.targetDeals) {
      finished = true;
      if (nsTotal > ewTotal) winner = 'NS';
      else if (ewTotal > nsTotal) winner = 'EW';
      else winner = 'draw';
    }
  }

  return {
    ...match,
    nsTotal,
    ewTotal,
    deals,
    currentDealer: nextSeat(match.currentDealer),
    finished,
    winner,
  };
}

export const DEFAULT_SETTINGS: MatchSettings = {
  endMode: 'points',
  targetPoints: 501,
  targetDeals: 4,
  beloteEnabled: true,
};

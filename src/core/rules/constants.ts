import type { Rank } from '../types';

export const TRUMP_RANK_VALUES: Record<Rank, number> = {
  J: 20,
  '9': 14,
  A: 11,
  '10': 10,
  K: 4,
  Q: 3,
  '8': 0,
  '7': 0,
};

export const PLAIN_RANK_VALUES: Record<Rank, number> = {
  A: 11,
  '10': 10,
  K: 4,
  Q: 3,
  J: 2,
  '9': 0,
  '8': 0,
  '7': 0,
};

/** Force croissante à l'atout : 7 < 8 < D < R < 10 < A < 9 < V. */
export const TRUMP_RANK_ORDER: readonly Rank[] = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'] as const;

/** Force croissante hors atout : 7 < 8 < 9 < V < D < R < 10 < A. */
export const PLAIN_RANK_ORDER: readonly Rank[] = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'] as const;

export const BELOTE_BONUS = 20;
export const CAPOT_BONUS = 100;
export const DIX_DE_DER = 10;
export const TOTAL_DEAL_POINTS = 162;
/** Strict ≥. */
export const MIN_TAKER_TO_WIN = 82;

/** Belote = R+D d'atout. */
export const BELOTE_RANKS: readonly [Rank, Rank] = ['K', 'Q'] as const;

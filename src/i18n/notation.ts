// Notation française pour l'affichage. Les types internes restent
// 'N'|'E'|'S'|'W', 'H'|'D'|'C'|'S', '7'..'A','J','Q','K' pour ne pas casser
// le core et les tests existants ; on convertit uniquement à l'affichage.

import type { Rank, Seat, Suit } from '@core/types';

export const SUIT_GLYPH: Record<Suit, string> = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
};

export const SUIT_IS_RED: Record<Suit, boolean> = {
  H: true,
  D: true,
  C: false,
  S: false,
};

/** Étiquette française d'un rang : V (valet), D (dame), R (roi). */
export const RANK_LABEL: Record<Rank, string> = {
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'V',
  Q: 'D',
  K: 'R',
  A: 'A',
};

/** Étiquette FR courte d'un siège (un caractère). N reste N, W devient O. */
export const SEAT_SHORT: Record<Seat, string> = {
  N: 'N',
  E: 'E',
  S: 'S',
  W: 'O',
};

/** Nom complet français d'un siège. */
export const SEAT_FULL: Record<Seat, string> = {
  N: 'Nord',
  E: 'Est',
  S: 'Sud',
  W: 'Ouest',
};

export function cardLabel(rank: Rank, suit: Suit): string {
  return `${RANK_LABEL[rank]}${SUIT_GLYPH[suit]}`;
}

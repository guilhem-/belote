// Types fondamentaux — voir docs/rules-conventions.md.

export type Suit = 'H' | 'D' | 'C' | 'S';
export const SUITS: readonly Suit[] = ['H', 'D', 'C', 'S'] as const;

export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export const RANKS: readonly Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

export type Seat = 'N' | 'E' | 'S' | 'W';
export const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'] as const;

export type Team = 'NS' | 'EW';

export type Bid = { kind: 'pass' } | { kind: 'take'; trump: Suit };

/** Phase d'enchère.
 *  - round 1 : preneur potentiel parle, atout = retourne si prise
 *  - round 2 : preneur potentiel choisit n'importe quelle couleur sauf la retourne
 *  - done   : enchères terminées
 *  - redeal : tous ont passé deux tours, redistribuer
 */
export interface BidPhase {
  readonly round: 1 | 2;
  readonly toAct: Seat;
  readonly bids: readonly { seat: Seat; bid: Bid }[];
  readonly faceUp: Card;
  readonly dealer: Seat;
}

export interface BidOutcome {
  readonly taker: Seat;
  readonly trump: Suit;
  readonly tookFaceUp: boolean;
}

export interface PlayedCard {
  readonly seat: Seat;
  readonly card: Card;
}

export interface Trick {
  readonly leader: Seat;
  readonly cards: readonly PlayedCard[];
}

export interface CompletedTrick extends Trick {
  readonly winner: Seat;
  readonly points: number;
  readonly isLast: boolean;
}

export type AnnouncementKind = 'belote' | 'rebelote';
export interface Announcement {
  readonly kind: AnnouncementKind;
  readonly seat: Seat;
}

export interface Hands {
  readonly N: readonly Card[];
  readonly E: readonly Card[];
  readonly S: readonly Card[];
  readonly W: readonly Card[];
}

/** Phases globales d'une donne. */
export type DealPhase =
  | { kind: 'bidding'; phase: BidPhase }
  | { kind: 'playing'; trump: Suit; taker: Seat; current: Trick; tricks: readonly CompletedTrick[] }
  | { kind: 'scored'; result: DealResult };

export interface DealResult {
  readonly taker: Seat;
  readonly trump: Suit;
  readonly nsScore: number;
  readonly ewScore: number;
  readonly nsCardPoints: number;
  readonly ewCardPoints: number;
  readonly dedans: boolean;
  readonly capot: 'taker' | 'defense' | null;
  readonly tricks: readonly CompletedTrick[];
  readonly announcements: readonly Announcement[];
}

export interface DealState {
  readonly dealer: Seat;
  readonly hands: Hands;
  readonly faceUp: Card;
  readonly phase: DealPhase;
  readonly announcements: readonly Announcement[];
  readonly seed: number;
}

export interface MatchSettings {
  readonly endMode: 'points' | 'deals';
  /** Seuil de points si endMode === 'points'. */
  readonly targetPoints: 501 | 1000 | 1501;
  /** Nombre de donnes si endMode === 'deals'. */
  readonly targetDeals: number;
  readonly beloteEnabled: boolean;
}

export interface MatchState {
  readonly settings: MatchSettings;
  readonly nsTotal: number;
  readonly ewTotal: number;
  readonly deals: readonly DealResult[];
  readonly currentDealer: Seat;
  readonly seed: number;
  readonly finished: boolean;
  readonly winner: Team | 'draw' | null;
}

/** Helpers Team. */
export const SEAT_TEAM: Record<Seat, Team> = {
  N: 'NS',
  S: 'NS',
  E: 'EW',
  W: 'EW',
};

export function partner(seat: Seat): Seat {
  switch (seat) {
    case 'N':
      return 'S';
    case 'S':
      return 'N';
    case 'E':
      return 'W';
    case 'W':
      return 'E';
  }
}

/** Ordre antihoraire à la française : N → W → S → E → N. */
export function nextSeat(seat: Seat): Seat {
  switch (seat) {
    case 'N':
      return 'W';
    case 'W':
      return 'S';
    case 'S':
      return 'E';
    case 'E':
      return 'N';
  }
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function cardId(c: Card): string {
  return `${c.rank}${c.suit}`;
}

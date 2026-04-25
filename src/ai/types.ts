// Interface AIPlayer + types Reasoning. Conçue pour être stable depuis le niveau 5 PIMC.

import type { Bid, Card, DealState, Seat, Suit } from '@core/types';

export type AILevel = 1 | 2 | 3 | 4 | 5;

export interface AIConfig {
  level: AILevel;
  /** Seed dédié RNG IA — indépendant du seed de distribution. */
  seed: number;
  /** Niveau 5 only : budget temps par décision en ms. */
  timeBudgetMs?: number;
  /** Niveau 5 only : nb mondes échantillonnés. */
  worldsK?: { min: number; max: number };
  /** Niveau 3+ : conventions activées. */
  conventionsEnabled?: boolean;
}

export interface BidDecision {
  bid: Bid;
  reasoning: BidReasoning;
}

export interface PlayDecision {
  card: Card;
  /** Annonce belote/rebelote en jouant cette carte ? */
  announceBelote?: boolean;
  reasoning: PlayReasoning;
}

export type BidReasoning =
  | { level: 1; kind: 'random'; takeProb: number }
  | { level: 2; kind: 'heuristic'; handStrength: number; threshold: number }
  | { level: 3 | 4; kind: 'heuristic+'; handStrength: number; partnerSignals: string[] }
  | {
      level: 5;
      kind: 'pimc-bid';
      worldsEvaluated: number;
      candidateBids: Array<{ bid: Bid; expectedScore: number; stdev: number }>;
      explanation: string;
    };

export interface CandidatePlay {
  card: Card;
  /** Score attribué par l'IA (échelle libre, comparable entre candidats du même appel). */
  score: number;
  /** Texte court expliquant la décision. */
  rationale: string;
}

export type PlayReasoning =
  | { level: 1; kind: 'random'; pool: Card[] }
  | { level: 2; kind: 'simple-heuristic'; candidates: CandidatePlay[]; chosen: string }
  | {
      level: 3 | 4;
      kind: 'heuristic+';
      candidates: CandidatePlay[];
      conventionsApplied: string[];
      tracker: TrackerSnapshot;
    }
  | {
      level: 5;
      kind: 'pimc';
      worldsUsed: number;
      worldsBudgetMs: { used: number; budget: number };
      belief: BeliefSnapshot;
      candidates: Array<
        CandidatePlay & {
          expectedScore: number;
          stdev: number;
          winRateInWorlds: number;
        }
      >;
      conventionsObserved: string[];
      explanation: string;
    };

export interface TrackerSnapshot {
  remainingBySuit: Record<Suit, number>;
  voidsBySeat: Record<Seat, Suit[]>;
}

export interface BeliefSnapshot {
  cards: Array<{
    card: Card;
    probabilities: Record<Seat, number>;
  }>;
}

/** Événement observable par l'IA — pousse par l'orchestrateur AVANT chaque décision. */
export type ObservableEvent =
  | { type: 'deal-start'; dealer: Seat; ownSeat: Seat; ownHand: readonly Card[]; faceUp: Card }
  | { type: 'bid'; seat: Seat; bid: Bid }
  | { type: 'bidding-end'; taker: Seat; trump: Suit; tookFaceUp: boolean; ownHand: readonly Card[] }
  | { type: 'play'; seat: Seat; card: Card }
  | { type: 'belote-announce'; seat: Seat; kind: 'belote' | 'rebelote' }
  | { type: 'trick-end'; winner: Seat; points: number }
  | { type: 'deal-end' };

export interface AIPlayer {
  readonly config: AIConfig;
  readonly seat: Seat;

  /** Décision d'enchère. `state` est redacté côté orchestrateur (mains adverses vides). */
  chooseBid(state: DealState, allowed: readonly Bid[]): Promise<BidDecision>;

  /** Décision de jeu. `legal` pré-calculé par l'orchestrateur. */
  chooseCard(state: DealState, legal: readonly Card[]): Promise<PlayDecision>;

  /** Notification d'événement avant la prochaine décision. */
  observe(event: ObservableEvent): void;

  /** Cleanup (worker, état interne). */
  dispose(): void;
}

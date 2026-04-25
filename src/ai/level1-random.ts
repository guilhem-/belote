// IA niveau 1 — random pondéré, ne tient pas compte de l'historique.
import type { Bid, Card, DealState, Seat } from '@core/types';
import type { AIConfig, AIPlayer, BidDecision, ObservableEvent, PlayDecision } from './types';
import { createRng, type Rng } from '@core/rng';

const TAKE_PROB = 0.25;

export function createLevel1AI(seat: Seat, config: AIConfig): AIPlayer {
  const rng: Rng = createRng(config.seed);

  return {
    config,
    seat,
    async chooseBid(_state: DealState, allowed: readonly Bid[]): Promise<BidDecision> {
      const takes = allowed.filter((b) => b.kind === 'take');
      let bid: Bid;
      if (takes.length > 0 && rng.next() < TAKE_PROB) {
        const idx = Math.floor(rng.next() * takes.length);
        bid = takes[idx]!;
      } else {
        bid = { kind: 'pass' };
      }
      return { bid, reasoning: { level: 1, kind: 'random', takeProb: TAKE_PROB } };
    },
    async chooseCard(_state: DealState, legal: readonly Card[]): Promise<PlayDecision> {
      const idx = Math.floor(rng.next() * legal.length);
      const card = legal[idx]!;
      return { card, reasoning: { level: 1, kind: 'random', pool: legal.slice() } };
    },
    observe(_event: ObservableEvent): void {
      // niveau 1 : aucun état.
    },
    dispose(): void {},
  };
}

// Store debug : capte les Reasoning de chaque IA pour le panneau de visualisation.
import type { Bid, Card, Seat } from '@core/types';
import type { BidReasoning, PlayReasoning } from '@ai/types';

export interface ReasoningEntry {
  ts: number;
  seat: Seat;
  kind: 'bid' | 'play';
  card?: Card;
  bid?: Bid;
  reasoning: BidReasoning | PlayReasoning;
}

function makeStore() {
  let entries = $state<ReasoningEntry[]>([]);
  let visible = $state<boolean>(false);
  let stepMode = $state<boolean>(false);
  let revealHands = $state<boolean>(false);

  return {
    get entries(): readonly ReasoningEntry[] {
      return entries;
    },
    get visible(): boolean {
      return visible;
    },
    get stepMode(): boolean {
      return stepMode;
    },
    get revealHands(): boolean {
      return revealHands;
    },
    push(entry: ReasoningEntry): void {
      entries = [...entries.slice(-199), entry];
    },
    clear(): void {
      entries = [];
    },
    toggle(): void {
      visible = !visible;
      if (visible) revealHands = true;
    },
    setStepMode(v: boolean): void {
      stepMode = v;
    },
    setRevealHands(v: boolean): void {
      revealHands = v;
    },
    /** Dernier reasoning d'un siège (utile pour highlight). */
    lastBySeat(seat: Seat): ReasoningEntry | null {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i]!.seat === seat) return entries[i]!;
      }
      return null;
    },
  };
}

export const debugStore = makeStore();

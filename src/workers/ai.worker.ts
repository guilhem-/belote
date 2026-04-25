// Web Worker exposant l'IA via Comlink. Charge les implémentations IA pures (sans DOM).
import { expose } from 'comlink';
import type { Bid, Card, DealState, Seat } from '@core/types';
import type { AIConfig, BidDecision, ObservableEvent, PlayDecision } from '@ai/types';
import { createAI } from '@ai/registry';
import type { AIPlayer } from '@ai/types';

const players = new Map<string, AIPlayer>();

const api = {
  create(id: string, seat: Seat, config: AIConfig): void {
    players.get(id)?.dispose();
    players.set(id, createAI(seat, config));
  },
  async chooseBid(id: string, state: DealState, allowed: readonly Bid[]): Promise<BidDecision> {
    const ai = players.get(id);
    if (!ai) throw new Error(`AI ${id} non créée`);
    return ai.chooseBid(state, allowed);
  },
  async chooseCard(id: string, state: DealState, legal: readonly Card[]): Promise<PlayDecision> {
    const ai = players.get(id);
    if (!ai) throw new Error(`AI ${id} non créée`);
    return ai.chooseCard(state, legal);
  },
  observe(id: string, event: ObservableEvent): void {
    players.get(id)?.observe(event);
  },
  dispose(id: string): void {
    players.get(id)?.dispose();
    players.delete(id);
  },
  disposeAll(): void {
    for (const p of players.values()) p.dispose();
    players.clear();
  },
};

export type AIWorkerApi = typeof api;

expose(api);

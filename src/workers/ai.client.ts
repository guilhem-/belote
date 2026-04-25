// Wrapper côté main thread : présente une AIPlayer-compatible qui delegue au worker.
// Les états Svelte (`$state`) sont des Proxy non-clonables par structuredClone — on
// convertit en JSON pur avant d'envoyer.
import { wrap, type Remote } from 'comlink';
import type { Bid, Card, DealState, Seat } from '@core/types';
import type { AIConfig, AIPlayer, BidDecision, ObservableEvent, PlayDecision } from '@ai/types';
import type { AIWorkerApi } from './ai.worker';

let workerRef: Worker | null = null;
let api: Remote<AIWorkerApi> | null = null;

function ensureWorker(): Remote<AIWorkerApi> {
  if (!api) {
    workerRef = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    api = wrap<AIWorkerApi>(workerRef);
  }
  return api;
}

export function disposeWorker(): void {
  if (workerRef) {
    api?.disposeAll();
    workerRef.terminate();
    workerRef = null;
    api = null;
  }
}

let nextId = 0;

/** Convertit un objet (potentiellement réactif Svelte) en plain JSON, déproxifié.
 *  Notre core/ utilise des objets POJO + readonly arrays sans classes/Map/Set,
 *  donc JSON serialize est sûr et complet. */
function toPlain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Crée un AIPlayer qui exécute en Worker. Interface identique à un AIPlayer local. */
export function createWorkerAI(seat: Seat, config: AIConfig): AIPlayer {
  const id = `ai-${nextId++}`;
  const w = ensureWorker();
  void w.create(id, seat, toPlain(config));
  return {
    config,
    seat,
    async chooseBid(state: DealState, allowed: readonly Bid[]): Promise<BidDecision> {
      return w.chooseBid(id, toPlain(state), toPlain(allowed.slice()));
    },
    async chooseCard(state: DealState, legal: readonly Card[]): Promise<PlayDecision> {
      return w.chooseCard(id, toPlain(state), toPlain(legal.slice()));
    },
    observe(event: ObservableEvent): void {
      void w.observe(id, toPlain(event));
    },
    dispose(): void {
      void w.dispose(id);
    },
  };
}

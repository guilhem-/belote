// Orchestrateur : pilote une donne en alternant joueurs humains et IA.
// Ne touche pas au DOM — communique via callbacks.

import type { Bid, Card, DealState, Seat } from '@core/types';
import type { AIPlayer, BidReasoning, ObservableEvent, PlayReasoning } from '@ai/types';
import { apply, expectedToPlay, RedealRequired, type GameEvent, whoActs } from '@core/game-state';
import { legalBids } from '@core/bidding';
import { legalMoves } from '@core/rules/legal-moves';

export interface OrchestratorCallbacks {
  /** Appelée à chaque application d'event (UI peut update). */
  onEvent?: (event: GameEvent, before: DealState, after: DealState) => void;
  /** Appelé quand un humain doit jouer — à l'UI de capter et appeler `submitHumanAction`. */
  onAwaitHuman?: (seat: Seat) => void;
  /** Appelée à la fin de la donne (phase = scored). */
  onDealEnd?: (state: DealState) => void;
  /** Appelée si redeal nécessaire. */
  onRedeal?: () => void;
  /** Délai entre coups IA (cadence). */
  paceMs?: number;
  /** Capture le Reasoning de chaque décision IA pour le panneau debug. */
  onAiReasoning?: (seat: Seat, kind: 'bid' | 'play', reasoning: BidReasoning | PlayReasoning, card?: Card, bid?: Bid) => void;
  /** Appelé après que le 4e coup a été appliqué. Le callback peut retourner une promesse
   *  pour bloquer la résolution UI (laisse le pli visible le temps voulu). */
  onTrickComplete?: (completedTrick: { leader: Seat; cards: readonly { seat: Seat; card: Card }[]; winner: Seat; points: number }) => Promise<void>;
}

export interface PlayerSetup {
  /** Map siège → AIPlayer pour les sièges IA. Sièges absents = humains. */
  ais: Partial<Record<Seat, AIPlayer>>;
}

export class Orchestrator {
  private state: DealState;
  private cb: OrchestratorCallbacks;
  private setup: PlayerSetup;
  private pendingHuman: ((event: GameEvent) => void) | null = null;
  private aborted = false;

  constructor(initial: DealState, setup: PlayerSetup, callbacks: OrchestratorCallbacks = {}) {
    this.state = initial;
    this.setup = setup;
    this.cb = callbacks;
    // Notifier les IA du démarrage de la donne.
    for (const [seat, ai] of Object.entries(setup.ais)) {
      ai!.observe({
        type: 'deal-start',
        dealer: initial.dealer,
        ownSeat: seat as Seat,
        ownHand: initial.hands[seat as Seat],
        faceUp: initial.faceUp,
      });
    }
  }

  get currentState(): DealState {
    return this.state;
  }

  abort(): void {
    this.aborted = true;
    this.pendingHuman = null;
  }

  async run(): Promise<DealState> {
    while (!this.aborted && this.state.phase.kind !== 'scored') {
      const seat = whoActs(this.state);
      if (!seat) break;
      const isAi = !!this.setup.ais[seat];
      if (isAi) {
        await this.stepAi(seat);
      } else {
        await this.awaitHuman(seat);
      }
      // Si un pli vient d'être complété, on attend la fin de la pause UI avant de continuer.
      if (this.pendingTrickPause) {
        const p = this.pendingTrickPause;
        this.pendingTrickPause = null;
        await p;
      }
    }
    if (this.state.phase.kind === 'scored') {
      this.broadcast({ type: 'deal-end' });
      this.cb.onDealEnd?.(this.state);
    }
    return this.state;
  }

  private async stepAi(seat: Seat): Promise<void> {
    const ai = this.setup.ais[seat]!;
    if (this.state.phase.kind === 'bidding') {
      const beforePhase = this.state.phase;
      const allowed = legalBids(this.state.phase.phase);
      const decision = await ai.chooseBid(redactState(this.state, seat), allowed);
      this.cb.onAiReasoning?.(seat, 'bid', decision.reasoning, undefined, decision.bid);
      await this.delay();
      this.applyEvent({ type: 'bid', seat, bid: decision.bid });
      this.broadcast({ type: 'bid', seat, bid: decision.bid });
      const newPhase = this.state.phase as DealState['phase'];
      if (newPhase.kind === 'playing') {
        this.broadcast({
          type: 'bidding-end',
          taker: newPhase.taker,
          trump: newPhase.trump,
          tookFaceUp: beforePhase.phase.round === 1,
        });
        for (const [s, p] of Object.entries(this.setup.ais)) {
          p?.observe({ type: 'final-hand', ownSeat: s as Seat, ownHand: this.state.hands[s as Seat] });
        }
      }
    } else if (this.state.phase.kind === 'playing') {
      const legal = legalMoves(this.state.hands[seat], this.state.phase.current, this.state.phase.trump, seat);
      const decision = await ai.chooseCard(redactState(this.state, seat), legal);
      this.cb.onAiReasoning?.(seat, 'play', decision.reasoning, decision.card);
      await this.delay();
      const event: GameEvent =
        decision.announceBelote === true
          ? { type: 'play', seat, card: decision.card, announceBelote: true }
          : { type: 'play', seat, card: decision.card };
      this.applyEvent(event);
      this.broadcast({ type: 'play', seat, card: decision.card });
      if (decision.announceBelote === true) {
        // détecte si c'est belote ou rebelote en regardant les announcements après apply
        const ann = this.state.announcements;
        const last = ann[ann.length - 1];
        if (last) this.broadcast({ type: 'belote-announce', seat, kind: last.kind });
      }
    }
  }

  private awaitHuman(seat: Seat): Promise<void> {
    return new Promise((resolve) => {
      this.cb.onAwaitHuman?.(seat);
      this.pendingHuman = (event: GameEvent) => {
        this.pendingHuman = null;
        this.applyEvent(event);
        if (event.type === 'play') this.broadcast({ type: 'play', seat: event.seat, card: event.card });
        if (event.type === 'bid') this.broadcast({ type: 'bid', seat: event.seat, bid: event.bid });
        resolve();
      };
    });
  }

  /** Soumet une action humaine (depuis l'UI). */
  submitHumanAction(event: GameEvent): void {
    if (!this.pendingHuman) throw new Error('aucune action humaine attendue');
    this.pendingHuman(event);
  }

  private applyEvent(event: GameEvent): void {
    const before = this.state;
    try {
      const after = apply(before, event);
      this.state = after;
      this.cb.onEvent?.(event, before, after);
      // Détection fin de pli.
      let completedTrick: { winner: Seat; points: number; leader: Seat; cards: readonly { seat: Seat; card: Card }[] } | null = null;
      if (
        before.phase.kind === 'playing' &&
        after.phase.kind === 'playing' &&
        before.phase.current.cards.length === 3 &&
        after.phase.current.cards.length === 0
      ) {
        completedTrick = after.phase.tricks[after.phase.tricks.length - 1] ?? null;
      } else if (before.phase.kind === 'playing' && after.phase.kind === 'scored') {
        completedTrick = after.phase.result.tricks[7] ?? null;
      }
      if (completedTrick) {
        this.broadcast({ type: 'trick-end', winner: completedTrick.winner, points: completedTrick.points });
        this.pendingTrickPause = this.cb.onTrickComplete?.(completedTrick) ?? null;
      }
    } catch (e) {
      if (e instanceof RedealRequired) {
        this.cb.onRedeal?.();
        this.aborted = true;
      } else {
        throw e;
      }
    }
  }

  private pendingTrickPause: Promise<void> | null = null;

  private broadcast(event: ObservableEvent): void {
    for (const ai of Object.values(this.setup.ais)) {
      ai?.observe(event);
    }
  }

  private delay(): Promise<void> {
    const ms = this.cb.paceMs ?? 0;
    if (ms <= 0) return Promise.resolve();
    return new Promise((r) => setTimeout(r, ms));
  }
}

/** Redacte les mains adverses → IA ne voit que la sienne. */
function redactState(state: DealState, seat: Seat): DealState {
  const empty: readonly Card[] = Object.freeze([]);
  return {
    ...state,
    hands: {
      N: seat === 'N' ? state.hands.N : empty,
      E: seat === 'E' ? state.hands.E : empty,
      S: seat === 'S' ? state.hands.S : empty,
      W: seat === 'W' ? state.hands.W : empty,
    },
  };
}

void expectedToPlay;
void ({} as Bid);

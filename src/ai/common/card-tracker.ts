// Suit toutes les cartes vues, gère l'inférence "siège void d'une couleur".
import type { Card, Seat, Suit } from '@core/types';
import { RANKS, SEATS, SUITS, cardId, partner } from '@core/types';
import type { ObservableEvent } from '../types';

export interface TrackerView {
  /** Cartes restantes par couleur dans le pool global (somme tous adversaires + soi). */
  remainingBySuit: Record<Suit, number>;
  /** Sièges connus comme void d'une couleur (par déduction). */
  voidsBySeat: Record<Seat, Suit[]>;
  /** Cartes encore en main (toutes mains, mais privilégie les adverses). */
  remainingCards: Card[];
  /** Atout choisi (ou null si phase enchère). */
  trump: Suit | null;
  /** Preneur (ou null). */
  taker: Seat | null;
  /** Nb de cartes possédées par chaque adversaire (8 - cartes jouées par lui). */
  handSizes: Record<Seat, number>;
  /** Joueur ayant pris (round 1 = sait que la retourne fait partie de sa main initialement). */
  tookFaceUp: boolean;
  faceUp: Card | null;
}

export class CardTracker {
  private ownSeat: Seat;
  private ownHand: Card[] = [];
  private playedCards = new Set<string>();
  private playedBySeat: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] };
  private voids: Record<Seat, Set<Suit>> = { N: new Set(), E: new Set(), S: new Set(), W: new Set() };
  private trump: Suit | null = null;
  private taker: Seat | null = null;
  private faceUp: Card | null = null;
  private tookFaceUp = false;
  private currentTrickLed: Suit | null = null;

  /** Bids passés / take : utile pour inférer la non-possession (passe sur retourne ♥ → moins probable J♥). */
  private bidHistory: { seat: Seat; passed: boolean; trump: Suit | null }[] = [];

  constructor(ownSeat: Seat) {
    this.ownSeat = ownSeat;
  }

  observe(event: ObservableEvent): void {
    switch (event.type) {
      case 'deal-start':
        this.reset();
        if (event.ownSeat === this.ownSeat) {
          this.ownHand = event.ownHand.slice();
        }
        this.faceUp = event.faceUp;
        break;
      case 'bid':
        this.bidHistory.push({
          seat: event.seat,
          passed: event.bid.kind === 'pass',
          trump: event.bid.kind === 'take' ? event.bid.trump : null,
        });
        break;
      case 'bidding-end':
        this.trump = event.trump;
        this.taker = event.taker;
        this.tookFaceUp = event.tookFaceUp;
        break;
      case 'final-hand':
        if (event.ownSeat === this.ownSeat) {
          this.ownHand = event.ownHand.slice();
        }
        break;
      case 'play': {
        const id = cardId(event.card);
        this.playedCards.add(id);
        this.playedBySeat[event.seat].push(event.card);
        // Inférence : si on demande une couleur et le joueur n'en pose pas, il est void.
        if (this.currentTrickLed && event.card.suit !== this.currentTrickLed) {
          this.voids[event.seat].add(this.currentTrickLed);
          // Sur-coupe : si atout demandé et joueur défausse, void d'atout.
          // Si non-atout demandé et joueur défausse hors-atout (pas coupe), void couleur ET pas d'atout.
          if (this.trump && event.card.suit !== this.trump) {
            // défausse hors atout sans couper alors qu'il y avait au moins un adversaire pas maître
            // → on n'avait pas d'atout (ou le partenaire était maître).
            // Inférence partielle : marquons potentiellement void atout, conservatif :
            // Si partenaire pas maître (logique externe), on saurait. Ici on est conservatif et
            // on considère que défausse = peut-être void atout. On ne marque PAS void atout sauf si
            // on est sûr — la logique IA peut utiliser cette indication probabiliste plus tard.
          }
        }
        // Si entame, on note la couleur du pli courant.
        if (this.playedBySeat[event.seat].length > 0 && this.currentTrickLed === null) {
          this.currentTrickLed = event.card.suit;
        }
        // Si on retire de notre propre main.
        if (event.seat === this.ownSeat) {
          this.ownHand = this.ownHand.filter((c) => cardId(c) !== id);
        }
        break;
      }
      case 'trick-end':
        this.currentTrickLed = null;
        break;
      case 'belote-announce':
        // Information : ce siège a R et D d'atout (au moins R+D ensemble au moment d'annoncer).
        // Le tracker peut s'en servir : pour l'instant on ne fait rien d'explicite.
        break;
      case 'deal-end':
        // rien
        break;
    }
  }

  view(): TrackerView {
    const remainingBySuit: Record<Suit, number> = { H: 0, D: 0, C: 0, S: 0 };
    const remainingCards: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const id = `${rank}${suit}`;
        if (!this.playedCards.has(id)) {
          remainingBySuit[suit]++;
          remainingCards.push({ rank, suit });
        }
      }
    }
    const voidsBySeat: Record<Seat, Suit[]> = { N: [], E: [], S: [], W: [] };
    for (const s of SEATS) voidsBySeat[s] = [...this.voids[s]];
    const handSizes: Record<Seat, number> = { N: 0, E: 0, S: 0, W: 0 };
    for (const s of SEATS) handSizes[s] = 8 - this.playedBySeat[s].length;
    return {
      remainingBySuit,
      voidsBySeat,
      remainingCards,
      trump: this.trump,
      taker: this.taker,
      handSizes,
      tookFaceUp: this.tookFaceUp,
      faceUp: this.faceUp,
    };
  }

  ownHandSnapshot(): Card[] {
    return this.ownHand.slice();
  }

  /** Cartes que le joueur `seat` peut encore avoir (toutes les non-vues hors notre main propre). */
  possibleCardsFor(seat: Seat): Card[] {
    if (seat === this.ownSeat) return this.ownHand.slice();
    const ownIds = new Set(this.ownHand.map(cardId));
    const v = this.voids[seat];
    return this.view().remainingCards.filter((c) => !ownIds.has(cardId(c)) && !v.has(c.suit));
  }

  /** Nb de cartes restantes dans une couleur donnée chez les adversaires (= total - notre main). */
  opponentsRemainingInSuit(suit: Suit): number {
    const total = this.view().remainingBySuit[suit];
    const own = this.ownHand.filter((c) => c.suit === suit).length;
    return total - own;
  }

  bidInfo(): { seat: Seat; passed: boolean; trump: Suit | null }[] {
    return this.bidHistory.slice();
  }

  partnerOf(): Seat {
    return partner(this.ownSeat);
  }

  private reset(): void {
    this.ownHand = [];
    this.playedCards.clear();
    this.playedBySeat = { N: [], E: [], S: [], W: [] };
    this.voids = { N: new Set(), E: new Set(), S: new Set(), W: new Set() };
    this.trump = null;
    this.taker = null;
    this.faceUp = null;
    this.tookFaceUp = false;
    this.currentTrickLed = null;
    this.bidHistory = [];
  }
}

// BeliefState : pour chaque carte non-vue par l'IA, stocke un set de sièges adverses possibles.
// Implémente une représentation déterministe (set + voids) plutôt que probabiliste pure :
// le sampler tirera uniformément parmi les assignations compatibles.

import type { Card, Seat, Suit } from '@core/types';
import { SEATS, cardId, partner } from '@core/types';

export class BeliefState {
  private ownSeat: Seat;
  /** cardId → set des sièges où la carte peut encore être (jamais soi-même). */
  private possibleSeats = new Map<string, Set<Seat>>();
  /** Cartes encore non jouées (toutes mains confondues, sauf retournes/etc.). */
  private remaining = new Set<string>();
  /** Cardes par cardId (lookup rapide). */
  private cardLookup = new Map<string, Card>();
  /** Voids connus par siège. */
  private voids: Record<Seat, Set<Suit>> = { N: new Set(), E: new Set(), S: new Set(), W: new Set() };
  /** Tailles de mains restantes par siège. */
  private handSizes: Record<Seat, number> = { N: 8, E: 8, S: 8, W: 8 };
  /** Main propre observée. */
  private ownHand: Card[] = [];

  constructor(ownSeat: Seat) {
    this.ownSeat = ownSeat;
  }

  /** Initialise avec la main complète après distribution + retourne + atout. */
  initialize(ownHand: readonly Card[], allCards: readonly Card[]): void {
    this.ownHand = ownHand.slice();
    this.possibleSeats.clear();
    this.remaining.clear();
    this.cardLookup.clear();
    for (const s of SEATS) {
      this.voids[s] = new Set();
      this.handSizes[s] = 8;
    }
    const ownIds = new Set(ownHand.map(cardId));
    const opponents = SEATS.filter((s) => s !== this.ownSeat);
    for (const c of allCards) {
      const id = cardId(c);
      this.cardLookup.set(id, c);
      this.remaining.add(id);
      if (ownIds.has(id)) {
        this.possibleSeats.set(id, new Set([this.ownSeat]));
      } else {
        this.possibleSeats.set(id, new Set(opponents));
      }
    }
  }

  /** Propage qu'un joueur a joué cette carte → on l'enlève de remaining et de toutes les distributions. */
  notePlay(seat: Seat, card: Card, ledSuit: Suit | null): void {
    const id = cardId(card);
    this.remaining.delete(id);
    this.possibleSeats.delete(id);
    this.handSizes[seat] = Math.max(0, this.handSizes[seat] - 1);
    // Inférence void : si une couleur a été demandée et le joueur n'a pas fourni → il est void.
    if (ledSuit && card.suit !== ledSuit && seat !== this.ownSeat) {
      this.markVoid(seat, ledSuit);
    }
  }

  /** Marque un void et propage aux distributions de cartes. */
  markVoid(seat: Seat, suit: Suit): void {
    if (this.voids[seat].has(suit)) return;
    this.voids[seat].add(suit);
    for (const [id, set] of this.possibleSeats.entries()) {
      const card = this.cardLookup.get(id);
      if (card?.suit === suit && set.has(seat)) {
        set.delete(seat);
      }
    }
  }

  /** Inférence sur enchères (basique) : si seat passe sur retourne ♥, P(seat a J♥) baisse.
   *  Pour rester simple/déterministe, on n'enlève RIEN sur la base d'un pass — cela fausserait.
   *  On exporte un poids likelihoodTakeBidGivenCardCount qui pourra biaiser le sampling.
   *  Dans cette première version, on n'utilise pas cette information. */
  noteBid(_seat: Seat, _passed: boolean, _trump: Suit | null): void {
    // no-op pour v1
  }

  /** Snapshot pour debug. */
  snapshot(): {
    cards: { card: Card; possibleSeats: Seat[] }[];
    voidsBySeat: Record<Seat, Suit[]>;
    handSizes: Record<Seat, number>;
  } {
    const cards: { card: Card; possibleSeats: Seat[] }[] = [];
    for (const [id, set] of this.possibleSeats.entries()) {
      const card = this.cardLookup.get(id);
      if (!card) continue;
      cards.push({ card, possibleSeats: [...set] });
    }
    const voidsBySeat: Record<Seat, Suit[]> = { N: [], E: [], S: [], W: [] };
    for (const s of SEATS) voidsBySeat[s] = [...this.voids[s]];
    return { cards, voidsBySeat, handSizes: { ...this.handSizes } };
  }

  getOwnSeat(): Seat {
    return this.ownSeat;
  }

  getOwnHand(): readonly Card[] {
    return this.ownHand;
  }

  getHandSizes(): Record<Seat, number> {
    return { ...this.handSizes };
  }

  getRemainingCards(): Card[] {
    return [...this.remaining].map((id) => this.cardLookup.get(id)!);
  }

  getPossibleSeats(card: Card): Set<Seat> {
    return this.possibleSeats.get(cardId(card)) ?? new Set();
  }

  getVoids(seat: Seat): Set<Suit> {
    return new Set(this.voids[seat]);
  }

  /** Met à jour la main propre suite à observe. */
  setOwnHand(hand: readonly Card[]): void {
    this.ownHand = hand.slice();
  }

  partner(): Seat {
    return partner(this.ownSeat);
  }
}

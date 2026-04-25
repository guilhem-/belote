import type { Card, Hands, Seat } from './types';
import { RANKS, SEATS, SUITS, nextSeat } from './types';
import { shuffle, type Rng } from './rng';

export function createDeck(): Card[] {
  const out: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      out.push({ suit, rank });
    }
  }
  return out;
}

/** Distribution initiale 3-2 (5 cartes par joueur) + retourne face visible.
 *  Ordre : à partir du joueur à gauche du donneur, antihoraire.
 */
export function dealInitial(
  rng: Rng,
  dealer: Seat,
): { hands: Hands; faceUp: Card; remaining: Card[] } {
  const deck = shuffle(createDeck(), rng);
  const order = orderFromDealer(dealer);
  const hands: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] };

  let i = 0;
  // 3 cartes
  for (const seat of order) {
    hands[seat].push(...deck.slice(i, i + 3));
    i += 3;
  }
  // 2 cartes
  for (const seat of order) {
    hands[seat].push(...deck.slice(i, i + 2));
    i += 2;
  }
  // retourne
  const faceUp = deck[i];
  if (!faceUp) throw new Error('deck epuise prematurement');
  i += 1;
  const remaining = deck.slice(i);

  return {
    hands: freezeHands(hands),
    faceUp,
    remaining,
  };
}

/** Distribution finale : preneur ramasse retourne + 2 cartes ; autres reçoivent 3 cartes. */
export function dealAfterTake(
  initial: Hands,
  faceUp: Card,
  remaining: readonly Card[],
  taker: Seat,
  dealer: Seat,
): Hands {
  const hands: Record<Seat, Card[]> = {
    N: initial.N.slice(),
    E: initial.E.slice(),
    S: initial.S.slice(),
    W: initial.W.slice(),
  };
  hands[taker].push(faceUp);

  const order = orderFromDealer(dealer);
  let i = 0;
  for (const seat of order) {
    if (seat === taker) {
      hands[seat].push(...remaining.slice(i, i + 2));
      i += 2;
    } else {
      hands[seat].push(...remaining.slice(i, i + 3));
      i += 3;
    }
  }
  if (i !== remaining.length) {
    throw new Error(`distribution incomplete: ${i}/${remaining.length}`);
  }
  for (const seat of SEATS) {
    if (hands[seat].length !== 8) {
      throw new Error(`seat ${seat} a ${hands[seat].length} cartes au lieu de 8`);
    }
  }
  return freezeHands(hands);
}

/** Ordre antihoraire à partir du joueur à gauche du donneur. */
export function orderFromDealer(dealer: Seat): Seat[] {
  const out: Seat[] = [];
  let s = nextSeat(dealer);
  for (let i = 0; i < 4; i++) {
    out.push(s);
    s = nextSeat(s);
  }
  return out;
}

function freezeHands(h: Record<Seat, Card[]>): Hands {
  return {
    N: Object.freeze(h.N.slice()),
    E: Object.freeze(h.E.slice()),
    S: Object.freeze(h.S.slice()),
    W: Object.freeze(h.W.slice()),
  };
}

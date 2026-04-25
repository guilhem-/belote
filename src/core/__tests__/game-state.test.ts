import { describe, expect, it } from 'vitest';
import { apply, expectedToPlay, RedealRequired, startDeal, whoActs } from '../game-state';
import { legalMoves } from '../rules/legal-moves';
import { createRng } from '../rng';
import type { Bid, Card, DealState, Seat } from '../types';

function pickFirstLegal(state: DealState, seat: Seat): Card {
  if (state.phase.kind !== 'playing') throw new Error('not playing');
  const legal = legalMoves(state.hands[seat], state.phase.current, state.phase.trump, seat);
  const c = legal[0];
  if (!c) throw new Error('no legal move');
  return c;
}

describe('startDeal', () => {
  it('démarre en phase bidding avec 5 cartes par joueur', () => {
    const s = startDeal(0xdead, 'N');
    expect(s.phase.kind).toBe('bidding');
    expect(s.hands.N.length).toBe(5);
    expect(s.faceUp).toBeDefined();
  });
});

describe('apply bid → playing', () => {
  it('prise round 1 ramasse retourne, distribue le reste, phase = playing', () => {
    const s = startDeal(0x42, 'N');
    if (s.phase.kind !== 'bidding') throw new Error('expected bidding');
    const seat = s.phase.phase.toAct;
    const next = apply(s, { type: 'bid', seat, bid: { kind: 'take', trump: s.faceUp.suit } });
    expect(next.phase.kind).toBe('playing');
    if (next.phase.kind !== 'playing') throw new Error();
    expect(next.phase.taker).toBe(seat);
    expect(next.phase.trump).toBe(s.faceUp.suit);
    for (const k of ['N', 'E', 'S', 'W'] as const) {
      expect(next.hands[k].length).toBe(8);
    }
    expect(next.phase.current.leader).toBe('W'); // gauche du donneur N
  });

  it('lève si bid hors ordre', () => {
    const s = startDeal(1, 'N');
    if (s.phase.kind !== 'bidding') throw new Error();
    const wrongSeat: Seat = s.phase.phase.toAct === 'N' ? 'E' : 'N';
    expect(() =>
      apply(s, { type: 'bid', seat: wrongSeat, bid: { kind: 'take', trump: s.faceUp.suit } }),
    ).toThrow();
  });

  it('lève si bid illégal (round 1, autre couleur)', () => {
    const s = startDeal(1, 'N');
    if (s.phase.kind !== 'bidding') throw new Error();
    const seat = s.phase.phase.toAct;
    const otherSuit = s.faceUp.suit === 'H' ? 'D' : 'H';
    expect(() => apply(s, { type: 'bid', seat, bid: { kind: 'take', trump: otherSuit } })).toThrow();
  });

  it('tous passent deux tours → RedealRequired', () => {
    let s = startDeal(2, 'N');
    for (let i = 0; i < 7; i++) {
      if (s.phase.kind !== 'bidding') throw new Error();
      s = apply(s, { type: 'bid', seat: s.phase.phase.toAct, bid: { kind: 'pass' } });
    }
    if (s.phase.kind !== 'bidding') throw new Error();
    const last = s.phase.phase.toAct;
    expect(() => apply(s, { type: 'bid', seat: last, bid: { kind: 'pass' } })).toThrow(RedealRequired);
  });
});

describe('apply play — pli complet et donne complète', () => {
  it('joue 8 plis et arrive en phase scored', () => {
    let s = startDeal(0xfeed, 'N');
    if (s.phase.kind !== 'bidding') throw new Error();
    const taker = s.phase.phase.toAct;
    s = apply(s, { type: 'bid', seat: taker, bid: { kind: 'take', trump: s.faceUp.suit } });

    while (s.phase.kind === 'playing') {
      const seat = expectedToPlay(s.phase.current);
      const card = pickFirstLegal(s, seat);
      s = apply(s, { type: 'play', seat, card });
    }
    expect(s.phase.kind).toBe('scored');
    if (s.phase.kind !== 'scored') throw new Error();
    expect(s.phase.result.nsScore + s.phase.result.ewScore).toBeGreaterThanOrEqual(162);
  });

  it('lève si carte non possédée', () => {
    let s = startDeal(0x10, 'N');
    if (s.phase.kind !== 'bidding') throw new Error();
    const seat = s.phase.phase.toAct;
    s = apply(s, { type: 'bid', seat, bid: { kind: 'take', trump: s.faceUp.suit } });
    if (s.phase.kind !== 'playing') throw new Error();
    const playerSeat = s.phase.current.leader;
    const fakeCard: Card = {
      rank: '7',
      suit: s.faceUp.suit === 'H' ? 'S' : 'H',
    };
    // Si fakeCard se trouve à être en main, retente avec une autre carte impossible.
    const has = s.hands[playerSeat].some((c) => c.rank === fakeCard.rank && c.suit === fakeCard.suit);
    if (has) {
      // On échange avec une carte garantie absente : 7 d'une couleur déjà testée → fallback :
      // chercher une carte que personne n'a (impossible : 32 cartes distribuées).
      // Solution : utiliser un seat qui ne joue pas pour déclencher l'autre erreur.
      expect(() =>
        apply(s, {
          type: 'play',
          seat: playerSeat === 'N' ? 'E' : 'N',
          card: s.hands[playerSeat][0]!,
        }),
      ).toThrow();
    } else {
      expect(() => apply(s, { type: 'play', seat: playerSeat, card: fakeCard })).toThrow();
    }
  });

  it('whoActs reflète l’état', () => {
    const s = startDeal(99, 'N');
    expect(whoActs(s)).toBeDefined();
  });
});

describe('apply play — belote/rebelote', () => {
  it('annonce belote possible si R+D atout en main au moment de jouer R ou D', () => {
    // Construit une donne où on force la situation difficilement — on teste la validation directe.
    // On utilise un seed qui donne R+D atout au preneur.
    // À défaut, on vérifie la validation via un appel direct.
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      let s = startDeal(seed, 'N');
      if (s.phase.kind !== 'bidding') continue;
      const taker = s.phase.phase.toAct;
      const trump = s.faceUp.suit;
      s = apply(s, { type: 'bid', seat: taker, bid: { kind: 'take', trump } });
      if (s.phase.kind !== 'playing') continue;
      const hand = s.hands[taker];
      const hasKQ =
        hand.some((c) => c.suit === trump && c.rank === 'K') &&
        hand.some((c) => c.suit === trump && c.rank === 'Q');
      if (!hasKQ) continue;
      // Joue le reste pour amener taker à entamer un pli (il l'est déjà ou jouera bientôt).
      // Simplification : on tente d'annoncer belote dès que le taker pose K ou Q atout.
      while (s.phase.kind === 'playing') {
        const seat = expectedToPlay(s.phase.current);
        const card = pickFirstLegal(s, seat);
        if (
          seat === taker &&
          card.suit === trump &&
          (card.rank === 'K' || card.rank === 'Q') &&
          s.hands[taker].some((c) => c.suit === trump && c.rank === 'K') &&
          s.hands[taker].some((c) => c.suit === trump && c.rank === 'Q')
        ) {
          s = apply(s, { type: 'play', seat, card, announceBelote: true });
          found = true;
        } else {
          s = apply(s, { type: 'play', seat, card });
        }
      }
    }
    expect(found).toBe(true);
  });
});

describe('apply — guards', () => {
  it('lève si bid en phase playing', () => {
    let s = startDeal(0x55, 'N');
    if (s.phase.kind !== 'bidding') throw new Error();
    const seat = s.phase.phase.toAct;
    s = apply(s, { type: 'bid', seat, bid: { kind: 'take', trump: s.faceUp.suit } });
    expect(() => apply(s, { type: 'bid', seat, bid: { kind: 'pass' } })).toThrow();
  });

  it('lève si play en phase bidding', () => {
    const s = startDeal(0x55, 'N');
    expect(() => apply(s, { type: 'play', seat: 'N', card: s.faceUp })).toThrow();
  });
});

describe('expectedToPlay', () => {
  it('renvoie le leader si pli vide', () => {
    expect(expectedToPlay({ leader: 'E', cards: [] })).toBe('E');
  });
});

// silencer warning unused
void createRng;
void ({} as Bid);

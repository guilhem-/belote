import { describe, expect, it } from 'vitest';
import { createDeck, dealAfterTake, dealInitial, orderFromDealer } from '../deck';
import { createRng } from '../rng';
import { cardId, SEATS } from '../types';

describe('createDeck', () => {
  it('produit 32 cartes uniques', () => {
    const d = createDeck();
    expect(d.length).toBe(32);
    const ids = new Set(d.map(cardId));
    expect(ids.size).toBe(32);
  });
});

describe('orderFromDealer', () => {
  it('retourne 4 sièges antihoraires depuis la gauche du donneur', () => {
    expect(orderFromDealer('N')).toEqual(['W', 'S', 'E', 'N']);
    expect(orderFromDealer('E')).toEqual(['N', 'W', 'S', 'E']);
    expect(orderFromDealer('S')).toEqual(['E', 'N', 'W', 'S']);
    expect(orderFromDealer('W')).toEqual(['S', 'E', 'N', 'W']);
  });
});

describe('dealInitial', () => {
  it('distribue 5 cartes par joueur + 1 retourne + 11 restantes', () => {
    const r = createRng(1);
    const { hands, faceUp, remaining } = dealInitial(r, 'N');
    for (const s of SEATS) {
      expect(hands[s].length).toBe(5);
    }
    expect(faceUp).toBeDefined();
    expect(remaining.length).toBe(32 - 4 * 5 - 1);
  });

  it('aucune carte en double', () => {
    const r = createRng(42);
    const { hands, faceUp, remaining } = dealInitial(r, 'E');
    const all = [...hands.N, ...hands.E, ...hands.S, ...hands.W, faceUp, ...remaining];
    expect(all.length).toBe(32);
    expect(new Set(all.map(cardId)).size).toBe(32);
  });
});

describe('dealAfterTake', () => {
  it('preneur reçoit retourne + 2, autres reçoivent 3, total 8', () => {
    const r = createRng(99);
    const { hands, faceUp, remaining } = dealInitial(r, 'N');
    const final = dealAfterTake(hands, faceUp, remaining, 'S', 'N');
    for (const s of SEATS) {
      expect(final[s].length).toBe(8);
    }
    // S a bien reçu la retourne.
    expect(final.S.some((c) => c.suit === faceUp.suit && c.rank === faceUp.rank)).toBe(true);
  });

  it('aucune carte en double final', () => {
    const r = createRng(7);
    const { hands, faceUp, remaining } = dealInitial(r, 'W');
    const final = dealAfterTake(hands, faceUp, remaining, 'E', 'W');
    const all = [...final.N, ...final.E, ...final.S, ...final.W];
    expect(new Set(all.map(cardId)).size).toBe(32);
  });

  it('lève si remaining ne correspond pas à la distribution', () => {
    const r = createRng(7);
    const { hands, faceUp, remaining } = dealInitial(r, 'W');
    expect(() => dealAfterTake(hands, faceUp, remaining.slice(0, 5), 'E', 'W')).toThrow();
  });
});

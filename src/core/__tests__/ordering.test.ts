import { describe, expect, it } from 'vitest';
import { cardPoints, cardStrength, compareSameSuit } from '../rules/ordering';
import type { Card, Suit } from '../types';

const C = (rank: Card['rank'], suit: Suit): Card => ({ rank, suit });

describe('cardPoints', () => {
  it('atout : V=20 9=14 A=11 10=10 R=4 D=3 8=0 7=0', () => {
    expect(cardPoints(C('J', 'H'), 'H')).toBe(20);
    expect(cardPoints(C('9', 'H'), 'H')).toBe(14);
    expect(cardPoints(C('A', 'H'), 'H')).toBe(11);
    expect(cardPoints(C('10', 'H'), 'H')).toBe(10);
    expect(cardPoints(C('K', 'H'), 'H')).toBe(4);
    expect(cardPoints(C('Q', 'H'), 'H')).toBe(3);
    expect(cardPoints(C('8', 'H'), 'H')).toBe(0);
    expect(cardPoints(C('7', 'H'), 'H')).toBe(0);
  });

  it('hors atout : A=11 10=10 R=4 D=3 V=2 9=0', () => {
    expect(cardPoints(C('A', 'D'), 'H')).toBe(11);
    expect(cardPoints(C('10', 'D'), 'H')).toBe(10);
    expect(cardPoints(C('K', 'D'), 'H')).toBe(4);
    expect(cardPoints(C('Q', 'D'), 'H')).toBe(3);
    expect(cardPoints(C('J', 'D'), 'H')).toBe(2);
    expect(cardPoints(C('9', 'D'), 'H')).toBe(0);
  });

  it('total cartes hors annonces = 152', () => {
    let sum = 0;
    const ranks: Card['rank'][] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const suits: Suit[] = ['H', 'D', 'C', 'S'];
    for (const s of suits) for (const r of ranks) sum += cardPoints(C(r, s), 'H');
    expect(sum).toBe(152);
  });
});

describe('cardStrength', () => {
  it('atout : V > 9 > A > 10 > R > D > 8 > 7', () => {
    const ord: Card['rank'][] = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];
    for (let i = 0; i < ord.length - 1; i++) {
      const a = ord[i] as Card['rank'];
      const b = ord[i + 1] as Card['rank'];
      expect(cardStrength(C(a, 'H'), 'H')).toBeLessThan(cardStrength(C(b, 'H'), 'H'));
    }
  });

  it('hors atout : A > 10 > R > D > V > 9 > 8 > 7', () => {
    const ord: Card['rank'][] = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
    for (let i = 0; i < ord.length - 1; i++) {
      const a = ord[i] as Card['rank'];
      const b = ord[i + 1] as Card['rank'];
      expect(cardStrength(C(a, 'D'), 'H')).toBeLessThan(cardStrength(C(b, 'D'), 'H'));
    }
  });

  it('lève si rang inconnu', () => {
    expect(() => cardStrength({ rank: 'Z' as Card['rank'], suit: 'H' }, 'H')).toThrow();
  });
});

describe('compareSameSuit', () => {
  it('lève si couleurs différentes', () => {
    expect(() => compareSameSuit(C('A', 'H'), C('K', 'D'), 'H')).toThrow();
  });
  it('atout : J > 9', () => {
    expect(compareSameSuit(C('J', 'H'), C('9', 'H'), 'H')).toBeGreaterThan(0);
  });
});

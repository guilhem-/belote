import { describe, expect, it } from 'vitest';
import type { Card, PlayedCard, Suit, Trick } from '../types';
import { masterIndex, masterSeat, resolveTrick } from '../rules/trick';

const C = (rank: Card['rank'], suit: Suit): Card => ({ rank, suit });
const P = (seat: PlayedCard['seat'], rank: Card['rank'], suit: Suit): PlayedCard => ({
  seat,
  card: C(rank, suit),
});
const T = (cards: PlayedCard[]): Trick => ({
  leader: cards[0]!.seat,
  cards,
});

describe('masterIndex / masterSeat', () => {
  it('plus haute carte de la couleur demandée gagne (sans atout)', () => {
    const trick = T([P('N', 'A', 'D'), P('E', 'K', 'D'), P('S', '7', 'D'), P('W', '9', 'D')]);
    expect(masterIndex(trick, 'H')).toBe(0); // A♦ leader
    expect(masterSeat(trick, 'H')).toBe('N');
  });

  it('atout bat la couleur demandée', () => {
    const trick = T([P('N', 'A', 'D'), P('E', '7', 'H'), P('S', 'K', 'D'), P('W', '10', 'D')]);
    expect(masterSeat(trick, 'H')).toBe('E');
  });

  it('plus haut atout bat atout', () => {
    const trick = T([P('N', '9', 'D'), P('E', '7', 'H'), P('S', '8', 'H'), P('W', 'J', 'H')]);
    expect(masterSeat(trick, 'H')).toBe('W'); // V atout > 8 > 7
  });

  it('défausse hors couleur demandée et hors atout ne gagne jamais', () => {
    const trick = T([P('N', 'A', 'D'), P('E', 'A', 'C'), P('S', 'A', 'S'), P('W', 'K', 'D')]);
    expect(masterSeat(trick, 'H')).toBe('N');
  });

  it('lève si pli vide', () => {
    expect(() => masterIndex({ leader: 'N', cards: [] }, 'H')).toThrow();
  });
});

describe('resolveTrick', () => {
  it('agrège les points et désigne le gagnant', () => {
    const trick = T([P('N', 'A', 'D'), P('E', 'K', 'D'), P('S', '10', 'D'), P('W', '7', 'D')]);
    const r = resolveTrick(trick, 'H', false);
    // A♦ = force 7, 10♦ = 6, K♦ = 5, 7♦ = 0 hors atout → N gagne avec A.
    expect(r.winner).toBe('N');
    expect(r.points).toBe(11 + 4 + 10 + 0);
    expect(r.isLast).toBe(false);
  });

  it('ajoute 10 points sur le dernier pli', () => {
    const trick = T([P('N', '7', 'D'), P('E', '8', 'D'), P('S', '9', 'D'), P('W', 'J', 'D')]);
    const r = resolveTrick(trick, 'H', true);
    expect(r.points).toBe(0 + 0 + 0 + 2 + 10); // V♦ hors atout = 2
    expect(r.winner).toBe('W');
  });

  it('lève si pli incomplet', () => {
    expect(() => resolveTrick(T([P('N', 'A', 'D')]), 'H', false)).toThrow();
  });
});

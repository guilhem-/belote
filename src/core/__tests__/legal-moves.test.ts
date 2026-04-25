import { describe, expect, it } from 'vitest';
import type { Card, PlayedCard, Suit, Trick } from '../types';
import { legalMoves } from '../rules/legal-moves';

const C = (rank: Card['rank'], suit: Suit): Card => ({ rank, suit });
const P = (seat: PlayedCard['seat'], rank: Card['rank'], suit: Suit): PlayedCard => ({
  seat,
  card: C(rank, suit),
});
const T = (leader: PlayedCard['seat'], cards: PlayedCard[]): Trick => ({ leader, cards });

describe('legalMoves — leader', () => {
  it('peut jouer n’importe quelle carte de sa main', () => {
    const hand = [C('A', 'H'), C('7', 'D'), C('J', 'S')];
    const moves = legalMoves(hand, T('N', []), 'H', 'N');
    expect(moves).toHaveLength(3);
  });

  it('hand vide → []', () => {
    expect(legalMoves([], T('N', []), 'H', 'N')).toEqual([]);
  });
});

describe('legalMoves — couleur demandée non-atout, joueur a la couleur', () => {
  it('doit fournir, pas obligation de monter', () => {
    const hand = [C('7', 'D'), C('K', 'D'), C('A', 'H')];
    const trick = T('N', [P('N', '10', 'D')]);
    const moves = legalMoves(hand, trick, 'H', 'E');
    expect(moves.map((c) => c.rank).sort()).toEqual(['7', 'K']);
  });
});

describe('legalMoves — couleur demandée non-atout, joueur n’a pas la couleur', () => {
  it('partenaire pas maître, doit couper si possible', () => {
    const hand = [C('A', 'C'), C('8', 'H')];
    const trick = T('N', [P('N', '10', 'D')]); // adversaire leader
    const moves = legalMoves(hand, trick, 'H', 'E');
    expect(moves).toEqual([C('8', 'H')]);
  });

  it('partenaire maître, défausse libre permise (pas obligation couper)', () => {
    const hand = [C('A', 'C'), C('8', 'H')];
    // S = partenaire de N, leader = N
    const trick = T('N', [P('N', '10', 'D')]);
    const moves = legalMoves(hand, trick, 'H', 'S');
    // S doit fournir si possible, sinon défausse libre. S n'a pas ♦, partenaire (N) maître.
    expect(moves.length).toBe(2);
  });

  it('doit sur-couper si adversaire a déjà coupé', () => {
    const hand = [C('7', 'H'), C('J', 'H'), C('A', 'C')];
    // N pose 10♦, E coupe avec 8♥, S doit jouer
    const trick = T('N', [P('N', '10', 'D'), P('E', '8', 'H')]);
    const moves = legalMoves(hand, trick, 'H', 'S');
    // S = partenaire de N (leader). Mais E est maître (coupe). S n'a pas ♦.
    // Doit couper et sur-couper si possible. 7♥ ne sur-coupe pas 8♥ (force 1 vs 0).
    // Force atout : 7=0, 8=1, D=2, R=3, 10=4, A=5, 9=6, V=7. 8♥ force 1, V♥ force 7.
    // Donc seul V♥ sur-coupe.
    expect(moves).toEqual([C('J', 'H')]);
  });

  it('n’a pas d’atout assez fort pour sur-couper → peut "pisser à l’atout"', () => {
    const hand = [C('7', 'H'), C('A', 'C')];
    const trick = T('N', [P('N', '10', 'D'), P('E', 'J', 'H')]);
    const moves = legalMoves(hand, trick, 'H', 'S');
    expect(moves).toEqual([C('7', 'H')]);
  });

  it('pas d’atout du tout → défausse libre', () => {
    const hand = [C('7', 'C'), C('A', 'S')];
    const trick = T('N', [P('N', '10', 'D')]);
    const moves = legalMoves(hand, trick, 'H', 'E');
    expect(moves.length).toBe(2);
  });
});

describe('legalMoves — couleur demandée = atout', () => {
  it('doit fournir et monter si possible', () => {
    const hand = [C('7', 'H'), C('J', 'H'), C('A', 'C')];
    const trick = T('N', [P('N', '8', 'H')]);
    const moves = legalMoves(hand, trick, 'H', 'E');
    // 7 force 0 < 8 force 1 → ne monte pas. V force 7 > 8 force 1 → monte.
    expect(moves).toEqual([C('J', 'H')]);
  });

  it('partenaire maître à l’atout → fournir n’importe quel atout (pas obligation monter)', () => {
    const hand = [C('7', 'H'), C('J', 'H')];
    // N joue J atout (max), E joue 8, S = partenaire de N → S doit fournir mais pas monter.
    const trickWithE: Trick = { leader: 'N', cards: [P('N', 'J', 'H'), P('E', '8', 'H')] };
    const moves = legalMoves(hand, trickWithE, 'H', 'S');
    expect(moves.length).toBe(2);
  });

  it('aucun atout > carte la plus forte → fournit n’importe quel atout', () => {
    const hand = [C('7', 'H'), C('8', 'H'), C('A', 'C')];
    const trick = T('N', [P('N', 'J', 'H')]);
    const moves = legalMoves(hand, trick, 'H', 'E');
    expect(moves.map((c) => c.rank).sort()).toEqual(['7', '8']);
  });

  it('atout demandé, pas d’atout en main → défausse libre', () => {
    const hand = [C('A', 'C'), C('K', 'D')];
    const trick = T('N', [P('N', 'J', 'H')]);
    const moves = legalMoves(hand, trick, 'H', 'E');
    expect(moves.length).toBe(2);
  });
});

describe('legalMoves — partenaire maître + obligation couper', () => {
  it('partenaire maître hors atout → défausse libre, pas couper', () => {
    const hand = [C('7', 'H'), C('A', 'C')];
    // N entame ♦, E défausse ♣, S = partenaire de N → mais N est leader donc maître initial
    const trick = T('N', [P('N', 'A', 'D'), P('E', '7', 'C')]);
    const moves = legalMoves(hand, trick, 'H', 'S');
    expect(moves.length).toBe(2); // pas obligé de couper
  });
});

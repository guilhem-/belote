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

  it('partenaire maître à l’atout → doit monter quand même (règle FFB)', () => {
    // N joue 10♥ atout (force 4), E joue 8♥ (force 1). S = partenaire de N est maître.
    // Mais sur un tour d'atout, S doit monter au-dessus de 10♥ si possible.
    // Main : 7♥ (force 0), D♥ (force 2). Aucune ne monte → fournit n'importe quel atout.
    const hand = [C('7', 'H'), C('Q', 'H')];
    const trickNoOver: Trick = { leader: 'N', cards: [P('N', '10', 'H'), P('E', '8', 'H')] };
    expect(legalMoves(hand, trickNoOver, 'H', 'S').length).toBe(2);

    // Même situation mais S a V♥ (force 7) > 10♥ → DOIT jouer V♥.
    const handWithJack = [C('7', 'H'), C('J', 'H')];
    expect(legalMoves(handWithJack, trickNoOver, 'H', 'S')).toEqual([C('J', 'H')]);
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

describe('legalMoves — option enforceTrumpAfterAnyCut', () => {
  it('partenaire maître par coupe + option ON → doit fournir l\'atout', () => {
    // N entame ♦, E coupe avec 8♥, S = partenaire de N → mais ici E coupe, donc E maître,
    // pas N. Pour avoir partenaire-maître-par-coupe : N entame, E défausse hors couleur,
    // S coupe (N = leader, S = partenaire de N → S devient maître).
    // En fait pour ce cas il faut : adversaire entame, partenaire coupe, je joue.
    // Soit : E entame ♦, N (partenaire de S) coupe avec V♥, W joue ♦, S doit jouer.
    // Hmm... rotation joueurs N→W→S→E→N. Si E entame, ordre = E, N, W, S.
    // Donc : E pose 10♦, N pose V♥ (coupe), W pose 7♦, S doit jouer.
    // S n'a pas ♦. Partenaire (N) est maître par coupe.
    const hand = [C('7', 'H'), C('Q', 'H'), C('A', 'C')];
    const trick = T('E', [P('E', '10', 'D'), P('N', 'J', 'H'), P('W', '7', 'D')]);

    // Sans option : S peut défausser librement (partenaire maître).
    const movesDefault = legalMoves(hand, trick, 'H', 'S');
    expect(movesDefault.length).toBe(3);

    // Avec option : S doit fournir de l'atout (mais pas obligé de monter au-dessus du partenaire).
    const movesStrict = legalMoves(hand, trick, 'H', 'S', { enforceTrumpAfterAnyCut: true });
    expect(movesStrict.map((c) => c.rank).sort()).toEqual(['7', 'Q']);
  });

  it('option ON sans atout en main → défausse libre (rien à fournir)', () => {
    const hand = [C('A', 'C'), C('K', 'S')];
    const trick = T('E', [P('E', '10', 'D'), P('N', 'J', 'H'), P('W', '7', 'D')]);
    const moves = legalMoves(hand, trick, 'H', 'S', { enforceTrumpAfterAnyCut: true });
    expect(moves.length).toBe(2);
  });

  it('option ON sans coupe préalable → comportement standard (défausse libre)', () => {
    // Partenaire maître via la couleur entamée (pas par coupe) → option n'a pas d'effet.
    const hand = [C('7', 'H'), C('A', 'C')];
    const trick = T('N', [P('N', 'A', 'D'), P('E', '7', 'C')]);
    const moves = legalMoves(hand, trick, 'H', 'S', { enforceTrumpAfterAnyCut: true });
    expect(moves.length).toBe(2);
  });

  it('option ON, partenaire maître par coupe, sur-coupe adverse précédente → sur-coupe non requise', () => {
    // E entame ♦, N coupe avec V♥ (force 7), W sur-coupe pas (W joue ♦ → impossible),
    // hmm refaisons : E pose ♦, N coupe avec 9♥ (force 6), W pose D♥ (sous-coupe), S joue.
    // Actually for partner-master with the cut, we need partner to be currently master.
    // Suppose : E 10♦, N 9♥ (coupe, force 6), W 7♦ (joue couleur), S doit jouer.
    // S partenaire de N. N est maître (9♥ > 10♦). S n'a pas ♦.
    // Option ON : S doit fournir atout. Pas obligation monter au-dessus de N.
    const hand = [C('7', 'H'), C('K', 'H'), C('A', 'C')];
    const trick = T('E', [P('E', '10', 'D'), P('N', '9', 'H'), P('W', '7', 'D')]);
    const moves = legalMoves(hand, trick, 'H', 'S', { enforceTrumpAfterAnyCut: true });
    expect(moves.map((c) => c.rank).sort()).toEqual(['7', 'K']);
  });
});

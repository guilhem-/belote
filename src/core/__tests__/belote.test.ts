import { describe, expect, it } from 'vitest';
import { hasBeloteCombo } from '../rules/belote';
import type { Card, Suit } from '../types';

const C = (rank: Card['rank'], suit: Suit): Card => ({ rank, suit });

describe('hasBeloteCombo', () => {
  it('vrai si R+D atout présents', () => {
    expect(hasBeloteCombo([C('K', 'H'), C('Q', 'H'), C('7', 'D')], 'H')).toBe(true);
  });
  it('faux si seulement R atout', () => {
    expect(hasBeloteCombo([C('K', 'H'), C('Q', 'D')], 'H')).toBe(false);
  });
  it('faux si seulement D atout', () => {
    expect(hasBeloteCombo([C('Q', 'H'), C('K', 'D')], 'H')).toBe(false);
  });
  it('faux si R+D dans une autre couleur', () => {
    expect(hasBeloteCombo([C('K', 'D'), C('Q', 'D')], 'H')).toBe(false);
  });
  it('faux sur main vide', () => {
    expect(hasBeloteCombo([], 'H')).toBe(false);
  });
});

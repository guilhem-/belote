import { describe, expect, it } from 'vitest';
import { applyDealResult, createMatch, DEFAULT_SETTINGS } from '../match';
import type { DealResult } from '../types';

const makeResult = (ns: number, ew: number): DealResult => ({
  taker: 'S',
  trump: 'H',
  nsScore: ns,
  ewScore: ew,
  nsCardPoints: ns,
  ewCardPoints: ew,
  dedans: false,
  capot: null,
  tricks: [],
  announcements: [],
});

describe('createMatch', () => {
  it('initialise les totaux à 0 et donneur N par défaut', () => {
    const m = createMatch(DEFAULT_SETTINGS, 0xabcd);
    expect(m.nsTotal).toBe(0);
    expect(m.ewTotal).toBe(0);
    expect(m.currentDealer).toBe('N');
    expect(m.finished).toBe(false);
  });
});

describe('applyDealResult — mode points', () => {
  it('cumule, fait tourner le donneur (antihoraire), pas fini avant seuil', () => {
    let m = createMatch({ ...DEFAULT_SETTINGS, targetPoints: 501 }, 0);
    m = applyDealResult(m, makeResult(100, 62));
    expect(m.nsTotal).toBe(100);
    expect(m.ewTotal).toBe(62);
    expect(m.currentDealer).toBe('W'); // antihoraire
    expect(m.finished).toBe(false);
  });

  it('NS atteint 501 → finished, winner=NS', () => {
    let m = createMatch({ ...DEFAULT_SETTINGS, targetPoints: 501 }, 0);
    m = applyDealResult(m, makeResult(300, 0));
    m = applyDealResult(m, makeResult(250, 0));
    expect(m.finished).toBe(true);
    expect(m.winner).toBe('NS');
  });

  it('égalité au franchissement → draw', () => {
    let m = createMatch({ ...DEFAULT_SETTINGS, targetPoints: 501 }, 0);
    m = applyDealResult(m, makeResult(501, 501));
    expect(m.finished).toBe(true);
    expect(m.winner).toBe('draw');
  });

  it('EW atteint d’abord → winner=EW', () => {
    let m = createMatch({ ...DEFAULT_SETTINGS, targetPoints: 501 }, 0);
    m = applyDealResult(m, makeResult(0, 600));
    expect(m.winner).toBe('EW');
  });
});

describe('applyDealResult — mode deals', () => {
  it('s’arrête après N donnes, winner = team avec plus de points', () => {
    let m = createMatch({ ...DEFAULT_SETTINGS, endMode: 'deals', targetDeals: 2 }, 0);
    m = applyDealResult(m, makeResult(100, 62));
    expect(m.finished).toBe(false);
    m = applyDealResult(m, makeResult(50, 112));
    expect(m.finished).toBe(true);
    expect(m.winner).toBe('EW');
  });

  it('égalité totale → draw', () => {
    let m = createMatch({ ...DEFAULT_SETTINGS, endMode: 'deals', targetDeals: 1 }, 0);
    m = applyDealResult(m, makeResult(81, 81));
    expect(m.winner).toBe('draw');
  });
});

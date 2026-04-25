import { describe, expect, it } from 'vitest';
import { createRng, shuffle, randomSeed } from '../rng';

describe('Mulberry32 RNG', () => {
  it('est déterministe pour un même seed', () => {
    const a = createRng(0xdeadbeef);
    const b = createRng(0xdeadbeef);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produit des valeurs dans [0, 1)', () => {
    const r = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('expose son état courant', () => {
    const r = createRng(123);
    r.next();
    expect(r.state()).toBeTypeOf('number');
  });

  it('shuffle conserve les éléments', () => {
    const r = createRng(7);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(arr, r);
    expect(out.sort()).toEqual(arr.slice().sort());
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // input intact
  });

  it('shuffle est déterministe', () => {
    const out1 = shuffle([1, 2, 3, 4, 5], createRng(99));
    const out2 = shuffle([1, 2, 3, 4, 5], createRng(99));
    expect(out1).toEqual(out2);
  });

  it('randomSeed retourne un entier 32 bits', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSeed();
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(0x100000000);
      expect(Number.isInteger(s)).toBe(true);
    }
  });
});

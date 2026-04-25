// Mulberry32 — RNG déterministe minimal pour reproduire des donnes via seed.
// Algorithme : https://gist.github.com/tommyettinger/46a3a48d4b51d3b69cf2e0bc9d4b9a9b

export interface Rng {
  /** Retourne un float dans [0, 1). */
  next(): number;
  /** État interne actuel (sérialisable). */
  state(): number;
}

export function createRng(seed: number): Rng {
  let s = (seed | 0) >>> 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state(): number {
      return s >>> 0;
    },
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** Génère un seed aléatoire utilisable (32 bits). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

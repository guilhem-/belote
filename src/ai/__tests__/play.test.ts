import { describe, expect, it } from 'vitest';
import { Orchestrator } from '@ui/orchestrator';
import { startDeal } from '@core/game-state';
import { createAI } from '@ai/registry';
import type { Seat } from '@core/types';
import { createMatch, DEFAULT_SETTINGS, applyDealResult } from '@core/match';

async function playFullMatch(seedMatch: number, levelA: 1 | 2 | 3 | 4 | 5, levelB: 1 | 2 | 3 | 4 | 5, deals: number): Promise<{ ns: number; ew: number; nsWins: number; ewWins: number }> {
  let nsWins = 0;
  let ewWins = 0;
  let nsTotal = 0;
  let ewTotal = 0;
  let dealer: Seat = 'N';

  for (let i = 0; i < deals; i++) {
    // NS = levelA, EW = levelB
    const ais = {
      N: createAI('N', { level: levelA, seed: seedMatch + i * 31 + 1 }),
      S: createAI('S', { level: levelA, seed: seedMatch + i * 31 + 2 }),
      E: createAI('E', { level: levelB, seed: seedMatch + i * 31 + 3 }),
      W: createAI('W', { level: levelB, seed: seedMatch + i * 31 + 4 }),
    };
    let initial = startDeal(seedMatch + i * 1000, dealer);
    let attempts = 0;
    while (attempts < 5) {
      let redealNeeded = false;
      const orch = new Orchestrator(initial, { ais }, {
        onRedeal: () => {
          redealNeeded = true;
        },
      });
      const result = await orch.run();
      if (redealNeeded) {
        attempts++;
        initial = startDeal(seedMatch + i * 1000 + attempts * 7919, dealer);
        continue;
      }
      if (result.phase.kind === 'scored') {
        nsTotal += result.phase.result.nsScore;
        ewTotal += result.phase.result.ewScore;
        if (result.phase.result.nsScore > result.phase.result.ewScore) nsWins++;
        else if (result.phase.result.ewScore > result.phase.result.nsScore) ewWins++;
      }
      break;
    }
    // rotation donneur
    dealer = dealer === 'N' ? 'W' : dealer === 'W' ? 'S' : dealer === 'S' ? 'E' : 'N';
  }
  return { ns: nsTotal, ew: ewTotal, nsWins, ewWins };
}

describe('IA niveau 1 vs niveau 2 — tournoi rapide', () => {
  it('niveau 2 marque plus de points que niveau 1 sur 30 donnes', async () => {
    const r = await playFullMatch(0xabcd, 2, 1, 30);
    expect(r.ns).toBeGreaterThan(r.ew);
  }, 30000);
});

describe('IA niveau 4 vs niveau 2 — progression', () => {
  it('niveau 4 marque plus que niveau 2 sur 40 donnes', async () => {
    const r = await playFullMatch(0xbeef, 4, 2, 40);
    expect(r.ns).toBeGreaterThan(r.ew);
  }, 60000);
});

describe('IA niveau 5 — joue une donne sans crash', () => {
  it('partie 5 vs 3 sur 5 donnes (smoke test)', async () => {
    const r = await playFullMatch(0xc0de, 5, 3, 5);
    // pas d'assertion de victoire ici (peu de donnes) — juste no crash et points distribués
    expect(r.ns + r.ew).toBeGreaterThan(0);
  }, 90000);
});

describe('Orchestrator — partie complète sans erreur', () => {
  it('joue 5 donnes 4 IA niv 2 sans crash', async () => {
    let match = createMatch(DEFAULT_SETTINGS, 0x1234);
    let dealer: Seat = 'N';
    for (let i = 0; i < 5; i++) {
      const ais = {
        N: createAI('N', { level: 2, seed: 1 + i }),
        S: createAI('S', { level: 2, seed: 100 + i }),
        E: createAI('E', { level: 2, seed: 200 + i }),
        W: createAI('W', { level: 2, seed: 300 + i }),
      };
      let initial = startDeal(0x1234 + i * 17, dealer);
      let safety = 0;
      while (safety++ < 5) {
        let redealed = false;
        const orch = new Orchestrator(initial, { ais }, { onRedeal: () => (redealed = true) });
        const r = await orch.run();
        if (redealed) {
          initial = startDeal(0x1234 + i * 17 + safety * 13, dealer);
          continue;
        }
        if (r.phase.kind === 'scored') {
          match = applyDealResult(match, r.phase.result);
        }
        break;
      }
      dealer = dealer === 'N' ? 'W' : dealer === 'W' ? 'S' : dealer === 'S' ? 'E' : 'N';
    }
    expect(match.deals.length).toBeGreaterThan(0);
    expect(match.nsTotal + match.ewTotal).toBeGreaterThan(0);
  }, 15000);
});

// Benchmark latence IA niveau 5 : mesure p50/p95/p99 sur N coups.
import { startDeal, expectedToPlay } from '../src/core/game-state';
import { legalMoves } from '../src/core/rules/legal-moves';
import { createAI } from '../src/ai/registry';
import type { Seat } from '../src/core/types';

async function main(): Promise<void> {
  const N = Number(process.argv[2] ?? 100);
  const samples: number[] = [];
  let seed = 0x42;

  while (samples.length < N) {
    let s = startDeal(seed++, 'N');
    const ai = createAI('S', { level: 5, seed: 7, timeBudgetMs: 500 });
    if (s.phase.kind !== 'bidding') continue;
    // force prise rapide pour atteindre la phase playing
    try {
      s = (await import('../src/core/game-state')).apply(s, {
        type: 'bid',
        seat: s.phase.phase.toAct,
        bid: { kind: 'take', trump: s.faceUp.suit },
      });
    } catch {
      continue;
    }
    while (s.phase.kind === 'playing' && samples.length < N) {
      const seat: Seat = expectedToPlay(s.phase.current);
      if (seat === 'S') {
        const legal = legalMoves(s.hands.S, s.phase.current, s.phase.trump, 'S');
        const t0 = performance.now();
        const dec = await ai.chooseCard(s, legal);
        samples.push(performance.now() - t0);
        s = (await import('../src/core/game-state')).apply(s, { type: 'play', seat, card: dec.card });
      } else {
        const legal = legalMoves(s.hands[seat], s.phase.current, s.phase.trump, seat);
        s = (await import('../src/core/game-state')).apply(s, { type: 'play', seat, card: legal[0]! });
      }
    }
  }

  samples.sort((a, b) => a - b);
  const p = (q: number): number => samples[Math.floor(samples.length * q)] ?? 0;
  console.log(`N samples : ${samples.length}`);
  console.log(`mean : ${(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1)} ms`);
  console.log(`p50  : ${p(0.5).toFixed(1)} ms`);
  console.log(`p95  : ${p(0.95).toFixed(1)} ms`);
  console.log(`p99  : ${p(0.99).toFixed(1)} ms`);
  console.log(`max  : ${samples[samples.length - 1]?.toFixed(1)} ms`);

  if (p(0.95) > 600) {
    console.error('AVERTISSEMENT : p95 > 600ms');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

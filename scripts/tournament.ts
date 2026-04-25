// CLI : npx tsx scripts/tournament.ts --teamA 5 --teamB 4 --games 100 --seed 0xABCD
import { Orchestrator } from '../src/ui/orchestrator';
import { startDeal } from '../src/core/game-state';
import { createMatch, applyDealResult, DEFAULT_SETTINGS } from '../src/core/match';
import { createAI } from '../src/ai/registry';
import type { Seat } from '../src/core/types';
import type { AILevel } from '../src/ai/types';

interface Args {
  teamA: AILevel;
  teamB: AILevel;
  games: number;
  seed: number;
}

function parseArgs(): Args {
  const out: Partial<Args> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--teamA') out.teamA = Number(v) as AILevel;
    if (a === '--teamB') out.teamB = Number(v) as AILevel;
    if (a === '--games') out.games = Number(v);
    if (a === '--seed') out.seed = Number(v);
  }
  return {
    teamA: (out.teamA ?? 4) as AILevel,
    teamB: (out.teamB ?? 2) as AILevel,
    games: out.games ?? 50,
    seed: out.seed ?? 0xabcd,
  };
}

async function playOne(seed: number, levelA: AILevel, levelB: AILevel, deals: number): Promise<{ ns: number; ew: number }> {
  let match = createMatch(DEFAULT_SETTINGS, seed);
  let dealer: Seat = 'N';
  for (let i = 0; i < deals; i++) {
    const ais = {
      N: createAI('N', { level: levelA, seed: seed + i + 1 }),
      S: createAI('S', { level: levelA, seed: seed + i + 100 }),
      E: createAI('E', { level: levelB, seed: seed + i + 200 }),
      W: createAI('W', { level: levelB, seed: seed + i + 300 }),
    };
    let initial = startDeal(seed + i * 1000, dealer);
    let safety = 0;
    while (safety++ < 5) {
      let redealed = false;
      const orch = new Orchestrator(initial, { ais }, { onRedeal: () => (redealed = true) });
      const r = await orch.run();
      if (redealed) {
        initial = startDeal(seed + i * 1000 + safety * 7919, dealer);
        continue;
      }
      if (r.phase.kind === 'scored') match = applyDealResult(match, r.phase.result);
      break;
    }
    dealer = dealer === 'N' ? 'W' : dealer === 'W' ? 'S' : dealer === 'S' ? 'E' : 'N';
  }
  return { ns: match.nsTotal, ew: match.ewTotal };
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`Tournoi : team A (NS) niveau ${args.teamA} vs team B (EW) niveau ${args.teamB}`);
  console.log(`Games: ${args.games}, deals/game: 8, seed: 0x${args.seed.toString(16)}`);

  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  let totalNS = 0;
  let totalEW = 0;
  const start = Date.now();

  for (let g = 0; g < args.games; g++) {
    const r = await playOne(args.seed + g * 10007, args.teamA, args.teamB, 8);
    totalNS += r.ns;
    totalEW += r.ew;
    if (r.ns > r.ew) aWins++;
    else if (r.ew > r.ns) bWins++;
    else draws++;
    if ((g + 1) % 10 === 0) {
      process.stdout.write(`. ${g + 1}/${args.games} (A=${aWins} B=${bWins} D=${draws})\n`);
    }
  }

  const dt = (Date.now() - start) / 1000;
  console.log('\n--- Résultats ---');
  console.log(`A (niveau ${args.teamA}) victoires : ${aWins}/${args.games} (${((aWins / args.games) * 100).toFixed(1)}%)`);
  console.log(`B (niveau ${args.teamB}) victoires : ${bWins}/${args.games} (${((bWins / args.games) * 100).toFixed(1)}%)`);
  console.log(`Égalités : ${draws}`);
  console.log(`Score moyen — NS: ${(totalNS / args.games).toFixed(1)}, EW: ${(totalEW / args.games).toFixed(1)}`);
  console.log(`Durée : ${dt.toFixed(1)}s (${(dt / args.games).toFixed(2)}s/game)`);

  // Test binomial approximatif (heuristique pour CI).
  const expectedRatio = aWins / Math.max(1, aWins + bWins);
  console.log(`\nRatio A vs B (hors égalités) : ${(expectedRatio * 100).toFixed(1)}%`);
  if (args.teamA > args.teamB && expectedRatio < 0.55) {
    console.error(`AVERTISSEMENT : team A (niveau ${args.teamA}) ne domine pas team B (niveau ${args.teamB}) suffisamment.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

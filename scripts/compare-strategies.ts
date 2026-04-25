// Compare des variantes d'IA contre une baseline level4 sur N parties IA-vs-IA.
// Usage : npx tsx scripts/compare-strategies.ts [--games 100] [--deals 8] [--seed 0xC0DE]
//
// Sortie : tableau récap winrate par variante. Marque les variantes statistiquement
// meilleures que baseline (test binomial p < 0,05 → ~57% sur 100 essais).

import { startDeal, expectedToPlay, apply, RedealRequired } from '../src/core/game-state';
import { legalBids } from '../src/core/bidding';
import { legalMoves } from '../src/core/rules/legal-moves';
import { applyDealResult, createMatch, DEFAULT_SETTINGS } from '../src/core/match';
import type { DealState, Seat, Suit } from '../src/core/types';
import { nextSeat } from '../src/core/types';
import type { AIPlayer } from '../src/ai/types';
import { createLevel4AI } from '../src/ai/level4-deductive';
import { createLevel4Improved, ALL_IMPROVEMENTS } from '../src/ai/level4-improved';

interface Variant {
  name: string;
  factory: (seat: Seat, seed: number) => AIPlayer;
}

const variants: Variant[] = [
  {
    name: 'baseline (level4)',
    factory: (seat, seed) => createLevel4AI(seat, { level: 4, seed }),
  },
  {
    name: 'F1 receiveDirectCall',
    factory: (seat, seed) =>
      createLevel4Improved(seat, { level: 4, seed, improvements: { receiveDirectCall: true } }),
  },
  {
    name: 'F2 underAceTheJack',
    factory: (seat, seed) =>
      createLevel4Improved(seat, { level: 4, seed, improvements: { underAceTheJack: true } }),
  },
  {
    name: 'F3 takerPullsTrumpLong',
    factory: (seat, seed) =>
      createLevel4Improved(seat, { level: 4, seed, improvements: { takerPullsTrumpLong: true } }),
  },
  {
    name: 'F4 cutEconomical',
    factory: (seat, seed) =>
      createLevel4Improved(seat, { level: 4, seed, improvements: { cutEconomical: true } }),
  },
  {
    name: 'F5 cutGuard',
    factory: (seat, seed) =>
      createLevel4Improved(seat, { level: 4, seed, improvements: { cutGuard: true } }),
  },
  {
    name: 'ALL improvements',
    factory: (seat, seed) =>
      createLevel4Improved(seat, { level: 4, seed, improvements: ALL_IMPROVEMENTS }),
  },
];

const baseline = variants[0]!;

function parseArgs(): { games: number; deals: number; seed: number } {
  const argv = process.argv.slice(2);
  const get = (k: string, d: number): number => {
    const i = argv.indexOf(k);
    return i >= 0 ? Number(argv[i + 1]) : d;
  };
  return { games: get('--games', 100), deals: get('--deals', 8), seed: get('--seed', 0xc0de) };
}

/** Joue une donne complète sans worker, callbacks AI sync. */
async function playDeal(
  seedDeal: number,
  dealer: Seat,
  ais: Record<Seat, AIPlayer>,
): Promise<{ nsScore: number; ewScore: number } | 'redeal'> {
  let s: DealState = startDeal(seedDeal, dealer);
  // Notifie deal-start
  for (const seat of ['N', 'E', 'S', 'W'] as const) {
    ais[seat].observe({
      type: 'deal-start',
      dealer,
      ownSeat: seat,
      ownHand: s.hands[seat],
      faceUp: s.faceUp,
    });
  }
  let safety = 0;
  while (s.phase.kind === 'bidding') {
    const ph = s.phase.phase;
    const allowed = legalBids(ph);
    const decision = await ais[ph.toAct].chooseBid(s, allowed);
    try {
      s = apply(s, { type: 'bid', seat: ph.toAct, bid: decision.bid });
    } catch (e) {
      if (e instanceof RedealRequired) return 'redeal';
      throw e;
    }
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      ais[seat].observe({ type: 'bid', seat: ph.toAct, bid: decision.bid });
    }
    safety++;
    if (safety > 20) throw new Error('bid loop');
  }
  if (s.phase.kind !== 'playing') throw new Error('expected playing phase');
  const playing = s.phase;
  for (const seat of ['N', 'E', 'S', 'W'] as const) {
    ais[seat].observe({
      type: 'bidding-end',
      taker: playing.taker,
      trump: playing.trump,
      tookFaceUp: false, // approx
    });
    ais[seat].observe({ type: 'final-hand', ownSeat: seat, ownHand: s.hands[seat] });
  }
  while (s.phase.kind === 'playing') {
    const seat = expectedToPlay(s.phase.current);
    const legal = legalMoves(s.hands[seat], s.phase.current, s.phase.trump, seat);
    const decision = await ais[seat].chooseCard(s, legal);
    const before = s;
    s = apply(s, {
      type: 'play',
      seat,
      card: decision.card,
      ...(decision.announceBelote ? { announceBelote: true } : {}),
    });
    for (const a of ['N', 'E', 'S', 'W'] as const) {
      ais[a].observe({ type: 'play', seat, card: decision.card });
    }
    // trick-end
    if (
      before.phase.kind === 'playing' &&
      s.phase.kind === 'playing' &&
      before.phase.current.cards.length === 3
    ) {
      const completed = s.phase.tricks[s.phase.tricks.length - 1]!;
      for (const a of ['N', 'E', 'S', 'W'] as const) {
        ais[a].observe({ type: 'trick-end', winner: completed.winner, points: completed.points });
      }
    }
  }
  if (s.phase.kind !== 'scored') throw new Error('expected scored');
  for (const a of ['N', 'E', 'S', 'W'] as const) ais[a].observe({ type: 'deal-end' });
  return { nsScore: s.phase.result.nsScore, ewScore: s.phase.result.ewScore };
}

async function playMatch(
  seedMatch: number,
  deals: number,
  teamA: Variant,
  teamB: Variant,
): Promise<{ ns: number; ew: number; aWins: boolean }> {
  let match = createMatch(DEFAULT_SETTINGS, seedMatch);
  let dealer: Seat = 'N';
  for (let i = 0; i < deals; i++) {
    // NS = teamA, EW = teamB
    const ais: Record<Seat, AIPlayer> = {
      N: teamA.factory('N', seedMatch + i + 1),
      S: teamA.factory('S', seedMatch + i + 100),
      E: teamB.factory('E', seedMatch + i + 200),
      W: teamB.factory('W', seedMatch + i + 300),
    };
    let attempts = 0;
    let result: { nsScore: number; ewScore: number } | 'redeal' = 'redeal';
    const dealSeed = seedMatch + i * 1000;
    while (result === 'redeal' && attempts < 10) {
      result = await playDeal(dealSeed + attempts * 7919, dealer, ais);
      if (result === 'redeal') {
        dealer = nextSeat(dealer);
        attempts++;
      }
    }
    if (result === 'redeal') continue;
    match = applyDealResult(match, {
      taker: 'S',
      trump: 'H' as Suit,
      nsScore: result.nsScore,
      ewScore: result.ewScore,
      nsCardPoints: result.nsScore,
      ewCardPoints: result.ewScore,
      dedans: false,
      capot: null,
      tricks: [],
      announcements: [],
    });
    for (const a of Object.values(ais)) a.dispose();
    dealer = nextSeat(dealer);
  }
  return { ns: match.nsTotal, ew: match.ewTotal, aWins: match.nsTotal > match.ewTotal };
}

async function runComparison(variant: Variant, args: { games: number; deals: number; seed: number }): Promise<{ name: string; aWins: number; aTies: number; bWins: number; nsAvg: number; ewAvg: number }> {
  let aWins = 0;
  let bWins = 0;
  let aTies = 0;
  let nsTotal = 0;
  let ewTotal = 0;
  for (let g = 0; g < args.games; g++) {
    // Alterne : la moitié des parties variant joue NS, l'autre moitié EW (équilibre).
    const playA = variant;
    const playB = baseline;
    const flip = g % 2 === 1;
    const teamA = flip ? playB : playA;
    const teamB = flip ? playA : playB;
    const r = await playMatch(args.seed + g * 10007, args.deals, teamA, teamB);
    nsTotal += r.ns;
    ewTotal += r.ew;
    // Compter du point de vue du variant
    const variantWon = flip ? !r.aWins && r.ns !== r.ew : r.aWins;
    const tied = r.ns === r.ew;
    if (tied) aTies++;
    else if (variantWon) aWins++;
    else bWins++;
  }
  return { name: variant.name, aWins, aTies, bWins, nsAvg: nsTotal / args.games, ewAvg: ewTotal / args.games };
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`# Tournoi : variantes vs baseline level4`);
  console.log(`# games=${args.games} deals=${args.deals} seed=0x${args.seed.toString(16)}`);
  console.log(``);
  const start = Date.now();
  const results: Awaited<ReturnType<typeof runComparison>>[] = [];
  for (const v of variants) {
    if (v === baseline) continue;
    process.stdout.write(`Testing ${v.name}... `);
    const t0 = Date.now();
    const r = await runComparison(v, args);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${dt}s`);
    results.push(r);
  }
  console.log(`\nTotal : ${((Date.now() - start) / 1000).toFixed(1)}s\n`);

  // Résultats
  console.log(`| Variante                 | V/T/D     | %V    | NS avg | EW avg |`);
  console.log(`|--------------------------|-----------|-------|--------|--------|`);
  for (const r of results) {
    const winrate = ((r.aWins / Math.max(1, r.aWins + r.bWins)) * 100).toFixed(1);
    const significant = r.aWins / Math.max(1, r.aWins + r.bWins) >= 0.55;
    console.log(
      `| ${r.name.padEnd(24)} | ${String(r.aWins).padStart(3)}/${String(r.aTies).padStart(2)}/${String(r.bWins).padStart(3)} | ${winrate.padStart(4)}%${significant ? ' ★' : '  '} | ${r.nsAvg.toFixed(0).padStart(6)} | ${r.ewAvg.toFixed(0).padStart(6)} |`,
    );
  }
  console.log(`\n★ = winrate ≥ 55% (probable gain net)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

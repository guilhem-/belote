// Tournoi level5 (PIMC) vs level4 (heuristique déductive).
// Usage : npx tsx scripts/level5-vs-level4.ts [--games 1000] [--deals 8] [--budget 100]
//
// Budget = ms par décision PIMC. Les décisions où le shortlist level4 ne contient
// qu'un candidat retombent immédiatement sur level4 (pas de coût PIMC).
//
// Estimation temps : ~ games × deals × 16 (décisions PIMC moyennes) × budget × 1.2 (overhead)
//   1000 × 8 × 16 × 100ms = 12 800s = ~3h30 (lourd)
//   1000 × 8 × 16 × 30ms  = 3 840s  = ~64 min
//   200  × 8 × 16 × 200ms = 5 120s  = ~85 min
//   100  × 8 × 16 × 500ms = 6 400s  = ~107 min

import { startDeal, expectedToPlay, apply, RedealRequired } from '../src/core/game-state';
import { legalBids } from '../src/core/bidding';
import { legalMoves } from '../src/core/rules/legal-moves';
import { applyDealResult, createMatch, DEFAULT_SETTINGS } from '../src/core/match';
import type { DealState, Seat } from '../src/core/types';
import { nextSeat } from '../src/core/types';
import type { AIConfig, AIPlayer } from '../src/ai/types';
import { createLevel4AI } from '../src/ai/level4-deductive';
import { createLevel5AI } from '../src/ai/level5-pimc';

interface Args {
  games: number;
  deals: number;
  budget: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d: number): number => {
    const i = argv.indexOf(k);
    return i >= 0 ? Number(argv[i + 1]) : d;
  };
  return { games: get('--games', 1000), deals: get('--deals', 8), budget: get('--budget', 100) };
}

async function playDeal(
  seedDeal: number,
  dealer: Seat,
  ais: Record<Seat, AIPlayer>,
): Promise<{ nsScore: number; ewScore: number } | 'redeal'> {
  let s: DealState = startDeal(seedDeal, dealer);
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
      tookFaceUp: false,
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

type Builder = (seat: Seat, seed: number) => AIPlayer;

async function playMatch(
  seedMatch: number,
  deals: number,
  buildA: Builder,
  buildB: Builder,
): Promise<{ ns: number; ew: number; aWins: boolean; tied: boolean }> {
  let match = createMatch(DEFAULT_SETTINGS, seedMatch);
  let dealer: Seat = 'N';
  for (let i = 0; i < deals; i++) {
    const ais: Record<Seat, AIPlayer> = {
      N: buildA('N', seedMatch + i + 1),
      S: buildA('S', seedMatch + i + 100),
      E: buildB('E', seedMatch + i + 200),
      W: buildB('W', seedMatch + i + 300),
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
      trump: 'H',
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
  return {
    ns: match.nsTotal,
    ew: match.ewTotal,
    aWins: match.nsTotal > match.ewTotal,
    tied: match.nsTotal === match.ewTotal,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const buildLevel4: Builder = (seat, seed) => createLevel4AI(seat, { level: 4, seed });
  const buildLevel5: Builder = (seat, seed): AIPlayer => {
    const cfg: AIConfig = { level: 5, seed, timeBudgetMs: args.budget };
    return createLevel5AI(seat, cfg);
  };

  console.log(
    `# Tournoi level5 (PIMC budget ${args.budget}ms) vs level4 (baseline)\n# games=${args.games} deals=${args.deals}\n`,
  );
  let l5Wins = 0;
  let l4Wins = 0;
  let ties = 0;
  let l5Total = 0;
  let l4Total = 0;
  const start = Date.now();
  let lastReport = start;
  for (let g = 0; g < args.games; g++) {
    const flip = g % 2 === 1;
    const teamA = flip ? buildLevel4 : buildLevel5;
    const teamB = flip ? buildLevel5 : buildLevel4;
    const r = await playMatch(0xb0a7 + g * 10007, args.deals, teamA, teamB);
    const l5Score = flip ? r.ew : r.ns;
    const l4Score = flip ? r.ns : r.ew;
    l5Total += l5Score;
    l4Total += l4Score;
    if (r.tied) ties++;
    else if (l5Score > l4Score) l5Wins++;
    else l4Wins++;
    if (Date.now() - lastReport > 30000) {
      const winrate = ((l5Wins / Math.max(1, l5Wins + l4Wins)) * 100).toFixed(1);
      const elapsed = ((Date.now() - start) / 1000).toFixed(0);
      console.log(
        `  [${g + 1}/${args.games}] ${elapsed}s · L5 ${l5Wins} - L4 ${l4Wins} - T ${ties} (L5 ${winrate}%)`,
      );
      lastReport = Date.now();
    }
  }
  const dt = (Date.now() - start) / 1000;
  const total = l5Wins + l4Wins;
  const winrate = ((l5Wins / Math.max(1, total)) * 100).toFixed(1);
  console.log(`\n--- Résultats finaux ---`);
  console.log(`Level 5 (PIMC ${args.budget}ms) : ${l5Wins}/${args.games} (${winrate}%)`);
  console.log(
    `Level 4 (baseline)            : ${l4Wins}/${args.games} (${((l4Wins / args.games) * 100).toFixed(1)}%)`,
  );
  console.log(`Égalités                       : ${ties}`);
  console.log(`Score moyen — L5: ${(l5Total / args.games).toFixed(1)}, L4: ${(l4Total / args.games).toFixed(1)}`);
  console.log(`Durée : ${dt.toFixed(0)}s (${(dt / args.games).toFixed(2)}s/game)`);
  // IC à 95% pour winrate (approx normale)
  const p = l5Wins / Math.max(1, total);
  const se = Math.sqrt((p * (1 - p)) / Math.max(1, total));
  const ci = 1.96 * se * 100;
  console.log(`Intervalle 95% : ${(p * 100).toFixed(1)}% ± ${ci.toFixed(1)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

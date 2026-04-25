import type { Announcement, CompletedTrick, DealResult, Seat, Suit } from './types';
import { SEAT_TEAM } from './types';
import { BELOTE_BONUS, CAPOT_BONUS, TOTAL_DEAL_POINTS } from './rules/constants';

export interface ScoreInput {
  readonly tricks: readonly CompletedTrick[];
  readonly taker: Seat;
  readonly trump: Suit;
  readonly announcements: readonly Announcement[];
}

/** Score d'une donne. Implémente docs/rules-conventions.md §11. */
export function scoreDeal(input: ScoreInput): DealResult {
  const { tricks, taker, trump, announcements } = input;
  if (tricks.length !== 8) throw new Error('scoreDeal: 8 plis requis');

  const takerTeam = SEAT_TEAM[taker];

  let nsCard = 0;
  let ewCard = 0;
  let nsTricksCount = 0;
  let ewTricksCount = 0;
  for (const t of tricks) {
    const team = SEAT_TEAM[t.winner];
    if (team === 'NS') {
      nsCard += t.points;
      nsTricksCount++;
    } else {
      ewCard += t.points;
      ewTricksCount++;
    }
  }

  if (nsCard + ewCard !== TOTAL_DEAL_POINTS) {
    throw new Error(`somme points cartes invalide: ${nsCard} + ${ewCard} != ${TOTAL_DEAL_POINTS}`);
  }

  // Belote/Rebelote : un seul bonus 20 par équipe possesseur ; on déduplique par seat.
  let nsBelote = 0;
  let ewBelote = 0;
  const seen = new Set<string>();
  for (const a of announcements) {
    const key = `${a.seat}:${a.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (a.kind !== 'belote') continue; // seul 'belote' déclenche le bonus, 'rebelote' confirme
    const team = SEAT_TEAM[a.seat];
    if (team === 'NS') nsBelote = BELOTE_BONUS;
    else ewBelote = BELOTE_BONUS;
  }

  const takerCardPts = takerTeam === 'NS' ? nsCard : ewCard;
  const defCardPts = takerTeam === 'NS' ? ewCard : nsCard;
  const takerBelote = takerTeam === 'NS' ? nsBelote : ewBelote;
  const defBelote = takerTeam === 'NS' ? ewBelote : nsBelote;

  const takerTricksCount = takerTeam === 'NS' ? nsTricksCount : ewTricksCount;
  const defTricksCount = 8 - takerTricksCount;

  let capot: 'taker' | 'defense' | null = null;
  if (takerTricksCount === 8) capot = 'taker';
  else if (defTricksCount === 8) capot = 'defense';

  let takerScore = 0;
  let defScore = 0;
  let dedans = false;

  if (capot === 'taker') {
    takerScore = TOTAL_DEAL_POINTS + CAPOT_BONUS + takerBelote;
    defScore = defBelote;
  } else if (capot === 'defense') {
    takerScore = takerBelote;
    defScore = TOTAL_DEAL_POINTS + CAPOT_BONUS + defBelote;
    dedans = true;
  } else {
    const takerTotal = takerCardPts + takerBelote;
    const defTotal = defCardPts + defBelote;
    if (takerTotal > defTotal) {
      takerScore = takerTotal;
      defScore = defTotal;
    } else {
      // dedans (incl. égalité parfaite).
      takerScore = takerBelote;
      defScore = TOTAL_DEAL_POINTS + defBelote;
      dedans = true;
    }
  }

  const nsScore = takerTeam === 'NS' ? takerScore : defScore;
  const ewScore = takerTeam === 'NS' ? defScore : takerScore;

  const result: DealResult = {
    taker,
    trump,
    nsScore,
    ewScore,
    nsCardPoints: nsCard,
    ewCardPoints: ewCard,
    dedans,
    capot,
    tricks,
    announcements,
  };
  return result;
}

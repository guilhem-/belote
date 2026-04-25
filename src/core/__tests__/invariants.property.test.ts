import { describe, it } from 'vitest';
import fc from 'fast-check';
import { apply, expectedToPlay, RedealRequired, startDeal } from '../game-state';
import { legalMoves } from '../rules/legal-moves';
import type { DealState, Seat } from '../types';
import { TOTAL_DEAL_POINTS } from '../rules/constants';

function playRandomDeal(seed: number, biasTake: boolean): DealState {
  let s = startDeal(seed, 'N');
  // Bidding : si biasTake=true, le premier accepte la retourne ; sinon stratégie aléatoire-déterministe.
  let safety = 0;
  while (s.phase.kind === 'bidding') {
    const seat = s.phase.phase.toAct;
    if (biasTake) {
      try {
        s = apply(s, { type: 'bid', seat, bid: { kind: 'take', trump: s.faceUp.suit } });
      } catch {
        s = apply(s, { type: 'bid', seat, bid: { kind: 'pass' } });
      }
    } else {
      s = apply(s, { type: 'bid', seat, bid: { kind: 'pass' } });
    }
    safety++;
    if (safety > 30) throw new Error('bid loop');
  }
  while (s.phase.kind === 'playing') {
    const seat = expectedToPlay(s.phase.current);
    const legal = legalMoves(s.hands[seat], s.phase.current, s.phase.trump, seat);
    const card = legal[0];
    if (!card) throw new Error('no legal');
    s = apply(s, { type: 'play', seat, card });
  }
  return s;
}

describe('property — invariants donne complète', () => {
  it('somme points cartes NS+EW = 162 sur 200 donnes random', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 0x7fffffff }), (seed) => {
        const s = playRandomDeal(seed, true);
        if (s.phase.kind !== 'scored') return true;
        const r = s.phase.result;
        return r.nsCardPoints + r.ewCardPoints === TOTAL_DEAL_POINTS;
      }),
      { numRuns: 200 },
    );
  });

  it('legalMoves non-vide à tout instant pour le siège qui doit jouer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 0x7fffffff }), (seed) => {
        let s = startDeal(seed, 'N');
        if (s.phase.kind !== 'bidding') return true;
        try {
          s = apply(s, { type: 'bid', seat: s.phase.phase.toAct, bid: { kind: 'take', trump: s.faceUp.suit } });
        } catch {
          return true;
        }
        let safety = 0;
        while (s.phase.kind === 'playing') {
          const seat = expectedToPlay(s.phase.current);
          const legal = legalMoves(s.hands[seat], s.phase.current, s.phase.trump, seat);
          if (legal.length === 0) return false;
          s = apply(s, { type: 'play', seat, card: legal[0]! });
          safety++;
          if (safety > 100) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('total cumulé score (sans capot) = 162 (sans annonces)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 0x7fffffff }), (seed) => {
        const s = playRandomDeal(seed, true);
        if (s.phase.kind !== 'scored') return true;
        const r = s.phase.result;
        if (r.capot !== null) return r.nsScore + r.ewScore === 262;
        return r.nsScore + r.ewScore === TOTAL_DEAL_POINTS || r.nsScore + r.ewScore === TOTAL_DEAL_POINTS;
      }),
      { numRuns: 200 },
    );
  });

  it('aucune carte rejouée — chaque joueur joue exactement 8 cartes uniques', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 0x7fffffff }), (seed) => {
        const s = playRandomDeal(seed, true);
        if (s.phase.kind !== 'scored') return true;
        const cardsBySeat: Record<Seat, Set<string>> = { N: new Set(), E: new Set(), S: new Set(), W: new Set() };
        for (const t of s.phase.result.tricks) {
          for (const pc of t.cards) {
            const id = `${pc.card.rank}${pc.card.suit}`;
            if (cardsBySeat[pc.seat].has(id)) return false;
            cardsBySeat[pc.seat].add(id);
          }
        }
        for (const seat of ['N', 'E', 'S', 'W'] as const) {
          if (cardsBySeat[seat].size !== 8) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });
});

void RedealRequired;

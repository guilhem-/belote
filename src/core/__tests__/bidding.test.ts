import { describe, expect, it } from 'vitest';
import { applyBid, bidsEqual, createBidPhase, isLegalBid, legalBids } from '../bidding';
import type { Card, Suit } from '../types';

const faceUp: Card = { rank: '9', suit: 'H' };

describe('createBidPhase', () => {
  it('round 1, premier à parler = gauche du donneur (antihoraire : N → W)', () => {
    const p = createBidPhase(faceUp, 'N');
    expect(p.round).toBe(1);
    expect(p.toAct).toBe('W');
    expect(p.bids).toEqual([]);
  });
});

describe('legalBids', () => {
  it('round 1 : pass + take(retourne)', () => {
    const p = createBidPhase(faceUp, 'N');
    const bids = legalBids(p);
    expect(bids).toHaveLength(2);
    expect(bids.some((b) => b.kind === 'take' && b.trump === 'H')).toBe(true);
  });

  it('round 2 : pass + 3 couleurs (sauf retourne)', () => {
    const round2 = applyAllPassRound1();
    const bids = legalBids(round2);
    expect(bids.length).toBe(4); // pass + 3 suits
    const trumps = bids.filter((b) => b.kind === 'take').map((b) => (b as { trump: Suit }).trump);
    expect(trumps).toContain('D');
    expect(trumps).toContain('C');
    expect(trumps).toContain('S');
    expect(trumps).not.toContain('H');
  });
});

describe('applyBid', () => {
  it('prise round 1 → outcome avec tookFaceUp=true', () => {
    const p = createBidPhase(faceUp, 'N');
    const r = applyBid(p, { kind: 'take', trump: 'H' });
    expect(r.kind).toBe('taken');
    if (r.kind === 'taken') {
      expect(r.outcome.taker).toBe('W');
      expect(r.outcome.trump).toBe('H');
      expect(r.outcome.tookFaceUp).toBe(true);
    }
  });

  it('prise round 2 → outcome avec tookFaceUp=false', () => {
    const round2 = applyAllPassRound1();
    const r = applyBid(round2, { kind: 'take', trump: 'D' });
    expect(r.kind).toBe('taken');
    if (r.kind === 'taken') expect(r.outcome.tookFaceUp).toBe(false);
  });

  it('passes → continue jusqu’à round 2', () => {
    let p = createBidPhase(faceUp, 'N');
    for (let i = 0; i < 3; i++) {
      const r = applyBid(p, { kind: 'pass' });
      expect(r.kind).toBe('continue');
      if (r.kind === 'continue') p = r.phase;
    }
    const r = applyBid(p, { kind: 'pass' });
    expect(r.kind).toBe('continue');
    if (r.kind === 'continue') {
      expect(r.phase.round).toBe(2);
      expect(r.phase.toAct).toBe('W');
    }
  });

  it('tous passent les deux tours → redeal', () => {
    let p = createBidPhase(faceUp, 'N');
    for (let i = 0; i < 4; i++) {
      const r = applyBid(p, { kind: 'pass' });
      if (r.kind === 'continue') p = r.phase;
    }
    let lastResult: ReturnType<typeof applyBid> | null = null;
    for (let i = 0; i < 4; i++) {
      lastResult = applyBid(p, { kind: 'pass' });
      if (lastResult.kind === 'continue') p = lastResult.phase;
    }
    expect(lastResult?.kind).toBe('redeal');
  });

  it('lève si prise round 1 sur autre couleur', () => {
    const p = createBidPhase(faceUp, 'N');
    expect(() => applyBid(p, { kind: 'take', trump: 'D' })).toThrow();
  });

  it('lève si prise round 2 sur la couleur de la retourne', () => {
    const p = applyAllPassRound1();
    expect(() => applyBid(p, { kind: 'take', trump: 'H' })).toThrow();
  });
});

describe('isLegalBid / bidsEqual', () => {
  it('isLegalBid valide', () => {
    const p = createBidPhase(faceUp, 'N');
    expect(isLegalBid(p, { kind: 'pass' })).toBe(true);
    expect(isLegalBid(p, { kind: 'take', trump: 'H' })).toBe(true);
    expect(isLegalBid(p, { kind: 'take', trump: 'D' })).toBe(false);
  });

  it('bidsEqual', () => {
    expect(bidsEqual({ kind: 'pass' }, { kind: 'pass' })).toBe(true);
    expect(bidsEqual({ kind: 'pass' }, { kind: 'take', trump: 'H' })).toBe(false);
    expect(bidsEqual({ kind: 'take', trump: 'H' }, { kind: 'take', trump: 'H' })).toBe(true);
    expect(bidsEqual({ kind: 'take', trump: 'H' }, { kind: 'take', trump: 'D' })).toBe(false);
  });
});

function applyAllPassRound1() {
  let p = createBidPhase(faceUp, 'N');
  for (let i = 0; i < 4; i++) {
    const r = applyBid(p, { kind: 'pass' });
    if (r.kind === 'continue') p = r.phase;
  }
  return p;
}

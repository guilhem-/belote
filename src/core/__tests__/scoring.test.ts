import { describe, expect, it } from 'vitest';
import { scoreDeal } from '../scoring';
import type { Announcement, CompletedTrick, PlayedCard, Seat, Suit } from '../types';

const trick = (winner: Seat, points: number, isLast = false): CompletedTrick => ({
  leader: 'N',
  cards: [],
  winner,
  points,
  isLast,
});

// Construit 8 plis dont 7 normaux + 1 dernier, avec totaux contrôlés.
function makeTricks(takerCardPts: number, defCardPts: number, takerWinsLast: boolean): CompletedTrick[] {
  const tricks: CompletedTrick[] = [];
  // 7 plis : on alloue les points cartes hors dix de der.
  // takerCardPts + defCardPts = 152 (cartes) + 10 (dix de der gagné par qqn).
  // Le pli "dernier" porte ses points cartes + 10. On met 0 cartes au dernier pli pour simplifier.
  // → 7 plis = 152 points cartes.
  // Distribution : taker récupère takerCardPts (hors dix de der), def récupère defCardPts (hors dix de der).
  const takerHors = takerCardPts - (takerWinsLast ? 10 : 0);
  const defHors = defCardPts - (takerWinsLast ? 0 : 10);
  // 7 plis non-last
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) tricks.push(trick('S', i === 0 ? takerHors : 0));
    else tricks.push(trick('E', i === 1 ? defHors : 0));
  }
  // 7e pli (non last) : padding 0
  tricks.push(trick('S', 0));
  // 8e pli = last, 10 points obligatoires
  tricks.push(trick(takerWinsLast ? 'S' : 'E', 10, true));
  return tricks;
}

describe('scoreDeal — invariant', () => {
  it('lève si moins de 8 plis', () => {
    expect(() => scoreDeal({ tricks: [], taker: 'S', trump: 'H', announcements: [] })).toThrow();
  });

  it('lève si somme cartes != 162', () => {
    const bad = makeTricks(80, 70, true); // 150 ≠ 162
    expect(() => scoreDeal({ tricks: bad, taker: 'S', trump: 'H', announcements: [] })).toThrow();
  });
});

describe('scoreDeal — preneur tient', () => {
  it('preneur 90 / défense 72 → preneur tient', () => {
    const t = makeTricks(90, 72, true);
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: [] });
    expect(r.dedans).toBe(false);
    expect(r.capot).toBe(null);
    expect(r.nsScore).toBe(90); // S est NS
    expect(r.ewScore).toBe(72);
  });
});

describe('scoreDeal — dedans', () => {
  it('preneur 70 / défense 92 → dedans', () => {
    const t = makeTricks(70, 92, false);
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: [] });
    expect(r.dedans).toBe(true);
    expect(r.capot).toBe(null);
    expect(r.nsScore).toBe(0);
    expect(r.ewScore).toBe(162);
  });

  it('égalité 81-81 → dedans', () => {
    const t = makeTricks(81, 81, true);
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: [] });
    expect(r.dedans).toBe(true);
    expect(r.nsScore).toBe(0);
    expect(r.ewScore).toBe(162);
  });
});

describe('scoreDeal — capot', () => {
  it('preneur capot → 162 + 100', () => {
    const tricks: CompletedTrick[] = [];
    for (let i = 0; i < 7; i++) tricks.push(trick('S', i === 0 ? 152 : 0));
    tricks.push(trick('S', 10, true));
    const r = scoreDeal({ tricks, taker: 'S', trump: 'H', announcements: [] });
    expect(r.capot).toBe('taker');
    expect(r.nsScore).toBe(262);
    expect(r.ewScore).toBe(0);
  });

  it('défense capot → défense 262, preneur 0, dedans=true', () => {
    const tricks: CompletedTrick[] = [];
    for (let i = 0; i < 7; i++) tricks.push(trick('E', i === 0 ? 152 : 0));
    tricks.push(trick('E', 10, true));
    const r = scoreDeal({ tricks, taker: 'S', trump: 'H', announcements: [] });
    expect(r.capot).toBe('defense');
    expect(r.dedans).toBe(true);
    expect(r.ewScore).toBe(262);
    expect(r.nsScore).toBe(0);
  });
});

describe('scoreDeal — belote', () => {
  it('belote preneur ajoute 20', () => {
    const t = makeTricks(90, 72, true);
    const ann: Announcement[] = [{ kind: 'belote', seat: 'S' }];
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: ann });
    expect(r.nsScore).toBe(110);
    expect(r.ewScore).toBe(72);
  });

  it('belote défense conservée même si défense bat preneur', () => {
    const t = makeTricks(70, 92, false);
    const ann: Announcement[] = [{ kind: 'belote', seat: 'E' }];
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: ann });
    expect(r.dedans).toBe(true);
    expect(r.ewScore).toBe(162 + 20);
  });

  it('belote preneur dedans → conserve quand même les 20 (variante FFB)', () => {
    const t = makeTricks(70, 92, false);
    const ann: Announcement[] = [{ kind: 'belote', seat: 'S' }];
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: ann });
    expect(r.dedans).toBe(true);
    expect(r.nsScore).toBe(20);
  });

  it('81-81 + belote preneur → tient (la belote fait basculer le contrat)', () => {
    const t = makeTricks(81, 81, true);
    const ann: Announcement[] = [{ kind: 'belote', seat: 'S' }];
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: ann });
    expect(r.dedans).toBe(false);
    expect(r.nsScore).toBe(101); // 81 + 20
    expect(r.ewScore).toBe(81);
  });

  it('81-81 + belote défense → dedans (la belote scelle la chute du preneur)', () => {
    const t = makeTricks(81, 81, true);
    const ann: Announcement[] = [{ kind: 'belote', seat: 'E' }];
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: ann });
    expect(r.dedans).toBe(true);
    expect(r.nsScore).toBe(0); // pas de belote preneur, points cartes perdus
    expect(r.ewScore).toBe(162 + 20);
  });

  it('71-91 + belote preneur → encore dedans (91 vs 91 = égalité, seuil strict)', () => {
    const t = makeTricks(71, 91, false);
    const ann: Announcement[] = [{ kind: 'belote', seat: 'S' }];
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: ann });
    expect(r.dedans).toBe(true);
    expect(r.nsScore).toBe(20); // belote preneur conservée
    expect(r.ewScore).toBe(162);
  });

  it('belote + rebelote dédupliquées → un seul bonus', () => {
    const t = makeTricks(90, 72, true);
    const ann: Announcement[] = [
      { kind: 'belote', seat: 'S' },
      { kind: 'rebelote', seat: 'S' },
      { kind: 'belote', seat: 'S' }, // doublon ignoré
    ];
    const r = scoreDeal({ tricks: t, taker: 'S', trump: 'H', announcements: ann });
    expect(r.nsScore).toBe(110); // 90 + 20
  });
});

// Suppression warning unused.
void ([] as PlayedCard[]);
void ('H' as Suit);

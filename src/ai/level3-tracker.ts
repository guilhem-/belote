// Niveau 3 — niveau 2 + card-tracker + conventions de base en émission.
import type { Bid, Card, DealState, Seat, Suit } from '@core/types';
import { partner } from '@core/types';
import type { AIConfig, AIPlayer, BidDecision, CandidatePlay, ObservableEvent, PlayDecision } from './types';
import { CardTracker } from './common/card-tracker';
import { handStrength } from './common/hand-strength';
import { masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
import { hasBeloteCombo } from '@core/rules/belote';
import { createRng } from '@core/rng';

export function createLevel3AI(seat: Seat, config: AIConfig): AIPlayer {
  const rng = createRng(config.seed);
  const tracker = new CardTracker(seat);
  let beloteAnnouncedByMe = false;

  return {
    config,
    seat,

    async chooseBid(state: DealState, allowed: readonly Bid[]): Promise<BidDecision> {
      const hand = state.hands[seat];
      let bestBid: Bid = { kind: 'pass' };
      let bestStrength = 0;
      const round = state.phase.kind === 'bidding' ? state.phase.phase.round : 1;
      const threshold = round === 1 ? 50 : 60;

      for (const b of allowed) {
        if (b.kind !== 'take') continue;
        const trump = b.trump;
        const wouldHaveFaceUp = round === 1;
        const augmented = wouldHaveFaceUp ? [...hand, state.faceUp] : hand;
        const s = handStrength(augmented, trump, wouldHaveFaceUp);
        if (s > bestStrength) {
          bestStrength = s;
          bestBid = b;
        }
      }
      if (bestStrength < threshold) bestBid = { kind: 'pass' };

      return {
        bid: bestBid,
        reasoning: { level: 3, kind: 'heuristic+', handStrength: bestStrength, partnerSignals: [] },
      };
    },

    async chooseCard(state: DealState, legal: readonly Card[]): Promise<PlayDecision> {
      if (state.phase.kind !== 'playing') {
        return {
          card: legal[0]!,
          reasoning: {
            level: 3,
            kind: 'heuristic+',
            candidates: [],
            conventionsApplied: [],
            tracker: { remainingBySuit: { H: 0, D: 0, C: 0, S: 0 }, voidsBySeat: { N: [], E: [], S: [], W: [] } },
          },
        };
      }
      const trump = state.phase.trump;
      const trick = state.phase.current;
      const partnerSeat = partner(seat);
      const view = tracker.view();
      const conventions: string[] = [];

      const candidates: CandidatePlay[] = legal.map((c) => {
        const sc = scoreLevel3(c, trick, trump, seat, partnerSeat, state.hands[seat], view, conventions);
        return { card: c, score: sc.score, rationale: sc.rationale };
      });
      candidates.sort((a, b) => b.score - a.score);

      const top = candidates[0]!;
      const ties = candidates.filter((c) => c.score === top.score);
      const chosen = ties.length > 1 ? ties[Math.floor(rng.next() * ties.length)]! : top;

      // Belote/Rebelote
      let announceBelote = false;
      if (chosen.card.suit === trump && (chosen.card.rank === 'K' || chosen.card.rank === 'Q')) {
        if (!beloteAnnouncedByMe && hasBeloteCombo(state.hands[seat], trump)) {
          announceBelote = true;
          beloteAnnouncedByMe = true;
        } else if (beloteAnnouncedByMe) {
          const other = chosen.card.rank === 'K' ? 'Q' : 'K';
          if (!state.hands[seat].some((c) => c.suit === trump && c.rank === other)) announceBelote = true;
        }
      }

      const trackerSnap = {
        remainingBySuit: view.remainingBySuit,
        voidsBySeat: view.voidsBySeat,
      };

      return {
        card: chosen.card,
        ...(announceBelote ? { announceBelote: true } : {}),
        reasoning: {
          level: 3,
          kind: 'heuristic+',
          candidates,
          conventionsApplied: [...new Set(conventions)],
          tracker: trackerSnap,
        },
      };
    },

    observe(event: ObservableEvent): void {
      tracker.observe(event);
      if (event.type === 'deal-start' || event.type === 'deal-end') beloteAnnouncedByMe = false;
    },
    dispose(): void {},
  };
}

function isPartnerMaster(trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat }, trump: Suit, partnerSeat: Seat): boolean {
  if (trick.cards.length === 0) return false;
  return masterSeat(trick, trump) === partnerSeat;
}

function wouldBecomeMaster(card: Card, trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat }, trump: Suit): boolean {
  if (trick.cards.length === 0) return true;
  const ledSuit = trick.cards[0]!.card.suit;
  const trumpsInTrick = trick.cards.filter((pc) => pc.card.suit === trump);
  if (card.suit === trump) {
    if (trumpsInTrick.length === 0) return true;
    const maxTrump = Math.max(...trumpsInTrick.map((pc) => cardStrength(pc.card, trump)));
    return cardStrength(card, trump) > maxTrump;
  }
  if (trumpsInTrick.length > 0) return false;
  if (card.suit !== ledSuit) return false;
  const ledInTrick = trick.cards.filter((pc) => pc.card.suit === ledSuit);
  const maxLed = Math.max(...ledInTrick.map((pc) => cardStrength(pc.card, trump)));
  return cardStrength(card, trump) > maxLed;
}

function scoreLevel3(
  card: Card,
  trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat },
  trump: Suit,
  seat: Seat,
  partnerSeat: Seat,
  hand: readonly Card[],
  view: ReturnType<CardTracker['view']>,
  conventions: string[],
): { score: number; rationale: string } {
  let score = 0;
  let rationale = '';

  // CONVENTION : appel à l'as.
  // Si on entame et qu'on a l'as d'une couleur non-atout, le jouer envoie un signal au partenaire.
  if (trick.cards.length === 0) {
    if (card.suit !== trump && card.rank === 'A') {
      score += 14;
      conventions.push(`appel à l'as ${card.suit}`);
      rationale = `Entame as ${card.suit} (signal partenaire)`;
      return { score, rationale };
    }
    // Pas d'atout en entame en début (sauf si main forte).
    if (card.suit === trump) {
      const myTrumps = hand.filter((c) => c.suit === trump).length;
      if (myTrumps >= 4) {
        score += 8;
        rationale = `Tire atout (long ${myTrumps})`;
      } else {
        score -= 5;
        rationale = `Évite tirer atout court`;
      }
      return { score, rationale };
    }
    // Sinon : entame une carte basse non atout, sauf 10/A qui vont au partenaire idéalement.
    score += card.rank === '10' ? 4 : 0;
    score -= cardPoints(card, trump);
    rationale = `Entame ${card.rank}${card.suit}`;
    return { score, rationale };
  }

  const partnerMaster = isPartnerMaster(trick, trump, partnerSeat);
  const wouldWin = wouldBecomeMaster(card, trick, trump);

  // Si partenaire maître hors-atout → donner du gras (10 ou A).
  if (partnerMaster && !wouldWin) {
    score += cardPoints(card, trump);
    if (card.suit === trump && (card.rank === 'J' || card.rank === '9')) {
      score -= 25;
      rationale = `Garde atout fort, partenaire maître`;
    } else if (card.rank === '10' || card.rank === 'A') {
      score += 10;
      conventions.push('donner les points au partenaire');
      rationale = `Donne ${cardPoints(card, trump)} pts au partenaire`;
    } else {
      rationale = `Petite défausse, partenaire maître`;
    }
    return { score, rationale };
  }

  // Si on prend le pli, économiser.
  if (wouldWin && !partnerMaster) {
    score += 50;
    score -= cardStrength(card, trump);
    // Bonus si on récupère beaucoup de points avec une carte forte.
    let trickPts = 0;
    for (const pc of trick.cards) trickPts += cardPoints(pc.card, trump);
    if (trickPts >= 14) score += 5;
    rationale = `Devient maître ${card.rank}${card.suit}`;
    return { score, rationale };
  }

  // On ne gagne pas le pli : minimiser perte.
  score -= cardPoints(card, trump);
  if (card.suit === trump) score -= 6;
  // Si on doit défausser, conserver les As.
  if (card.suit !== trump && card.rank === 'A') {
    // Mais l'As sur défausse perd un atout potentiel : éviter sauf pas le choix.
    score -= 8;
  }
  rationale = `Sous-coupe / défausse min`;
  return { score, rationale };
}

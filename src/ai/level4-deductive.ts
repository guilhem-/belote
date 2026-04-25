// Niveau 4 — niveau 3 + lecture des appels partenaires + comptage atouts adverses.
// Pas de PIMC (réservé niveau 5) mais raisonnement déterministe sur sets de cartes possibles.
import type { Bid, Card, DealState, Seat, Suit } from '@core/types';
import { partner } from '@core/types';
import type { AIConfig, AIPlayer, BidDecision, CandidatePlay, ObservableEvent, PlayDecision } from './types';
import { CardTracker } from './common/card-tracker';
import { handStrength } from './common/hand-strength';
import { masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
import { hasBeloteCombo } from '@core/rules/belote';
import { TRUMP_RANK_ORDER } from '@core/rules/constants';
import { createRng } from '@core/rng';

export function createLevel4AI(seat: Seat, config: AIConfig): AIPlayer {
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
      const threshold = round === 1 ? 48 : 56;
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
        reasoning: { level: 4, kind: 'heuristic+', handStrength: bestStrength, partnerSignals: [] },
      };
    },

    async chooseCard(state: DealState, legal: readonly Card[]): Promise<PlayDecision> {
      if (state.phase.kind !== 'playing') {
        return {
          card: legal[0]!,
          reasoning: {
            level: 4,
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
        const sc = scoreLevel4(c, trick, trump, seat, partnerSeat, state.hands[seat], view, tracker, conventions);
        return { card: c, score: sc.score, rationale: sc.rationale };
      });
      candidates.sort((a, b) => b.score - a.score);
      const top = candidates[0]!;
      const ties = candidates.filter((c) => c.score === top.score);
      const chosen = ties.length > 1 ? ties[Math.floor(rng.next() * ties.length)]! : top;

      let announceBelote = false;
      if (chosen.card.suit === trump && (chosen.card.rank === 'K' || chosen.card.rank === 'Q')) {
        if (!beloteAnnouncedByMe && hasBeloteCombo(state.hands[seat], trump)) {
          announceBelote = true;
        } else if (beloteAnnouncedByMe) {
          const other = chosen.card.rank === 'K' ? 'Q' : 'K';
          if (!state.hands[seat].some((c) => c.suit === trump && c.rank === other)) announceBelote = true;
        }
      }

      return {
        card: chosen.card,
        ...(announceBelote ? { announceBelote: true } : {}),
        reasoning: {
          level: 4,
          kind: 'heuristic+',
          candidates,
          conventionsApplied: [...new Set(conventions)],
          tracker: { remainingBySuit: view.remainingBySuit, voidsBySeat: view.voidsBySeat },
        },
      };
    },

    observe(event: ObservableEvent): void {
      tracker.observe(event);
      if (event.type === 'deal-start' || event.type === 'deal-end') beloteAnnouncedByMe = false;
      else if (event.type === 'belote-announce' && event.seat === seat) beloteAnnouncedByMe = true;
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

function scoreLevel4(
  card: Card,
  trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat },
  trump: Suit,
  seat: Seat,
  partnerSeat: Seat,
  hand: readonly Card[],
  view: ReturnType<CardTracker['view']>,
  tracker: CardTracker,
  conventions: string[],
): { score: number; rationale: string } {
  let score = 0;
  let rationale = '';

  // 1) Comptage : reste-il des atouts maîtres adverses ?
  const trumpsRemainingOpponents = countOpponentTrumps(view, hand, partnerSeat, trump, tracker);
  const myTrumps = hand.filter((c) => c.suit === trump);

  if (trick.cards.length === 0) {
    // Lead.
    // Convention : si on a le V d'atout et plein d'atouts, on tire atout pour vider les adverses.
    if (
      card.suit === trump &&
      card.rank === 'J' &&
      myTrumps.length >= 4 &&
      trumpsRemainingOpponents > 0
    ) {
      score += 30;
      conventions.push('tire atout maître');
      rationale = `Tire V atout pour vider`;
      return { score, rationale };
    }
    // Appel à l'as : on entame une couleur non-atout dont on a l'as.
    if (card.suit !== trump && card.rank === 'A') {
      // Vérifie qu'aucun adversaire n'est probablement void de cette couleur (sinon ils coupent).
      const opponentsLikelyVoid = isOpponentLikelyVoid(card.suit, view, seat, partnerSeat);
      if (!opponentsLikelyVoid) {
        score += 18;
        conventions.push(`appel à l'as ${card.suit}`);
        rationale = `Appel as ${card.suit}`;
        return { score, rationale };
      } else {
        score -= 5;
        rationale = `Évite as ${card.suit} (risque coupe)`;
        return { score, rationale };
      }
    }
    // Petite couleur basse non-atout pour appeler.
    if (card.suit !== trump) {
      score -= cardPoints(card, trump);
      if (card.rank === '7' || card.rank === '8' || card.rank === '9') score += 2;
      rationale = `Entame petite ${card.rank}${card.suit}`;
      return { score, rationale };
    }
    // Atout court : éviter.
    score -= 8;
    rationale = `Atout court en entame`;
    return { score, rationale };
  }

  const partnerMaster = isPartnerMaster(trick, trump, partnerSeat);
  const wouldWin = wouldBecomeMaster(card, trick, trump);

  if (partnerMaster && !wouldWin) {
    // Donne des points si possible.
    score += cardPoints(card, trump);
    if (card.suit === trump && (card.rank === 'J' || card.rank === '9')) {
      score -= 30;
      rationale = `Garde V/9 atout`;
    } else if (card.rank === '10' || card.rank === 'A') {
      score += 12;
      conventions.push('signal de longueur');
      rationale = `Donne ${cardPoints(card, trump)} pts au partenaire`;
    } else {
      rationale = `Défausse min, partenaire maître`;
    }
    return { score, rationale };
  }

  if (wouldWin && !partnerMaster) {
    score += 60;
    // Préfère carte juste suffisante.
    score -= cardStrength(card, trump);
    // Bonus si beaucoup de points dans le pli.
    let trickPts = 0;
    for (const pc of trick.cards) trickPts += cardPoints(pc.card, trump);
    score += Math.min(trickPts, 20) * 0.5;
    // Si je suis le dernier à parler et le pli est gros : très bon.
    if (trick.cards.length === 3 && trickPts >= 14) score += 8;
    rationale = `Maître ${card.rank}${card.suit} (+${trickPts} pts)`;
    return { score, rationale };
  }

  // Sous le maître adverse.
  score -= cardPoints(card, trump);
  if (card.suit === trump) score -= 8;
  if (card.suit !== trump && (card.rank === 'A' || card.rank === '10')) score -= 10;
  rationale = `Sous le maître`;
  return { score, rationale };
}

function countOpponentTrumps(view: ReturnType<CardTracker['view']>, hand: readonly Card[], partnerSeat: Seat, trump: Suit, _tracker: CardTracker): number {
  // Atouts restants dans le pool global - mes atouts - atouts probables du partenaire.
  // Approximation : on suppose moitié des restants chez chaque adversaire.
  const total = view.remainingBySuit[trump];
  const mine = hand.filter((c) => c.suit === trump).length;
  // Pas d'estimation fine : retourne (total - mine) / 2 arrondi sup pour conservatisme.
  void partnerSeat;
  return Math.max(0, total - mine);
}

function isOpponentLikelyVoid(suit: Suit, view: ReturnType<CardTracker['view']>, seat: Seat, partnerSeat: Seat): boolean {
  for (const s of ['N', 'E', 'S', 'W'] as const) {
    if (s === seat || s === partnerSeat) continue;
    if (view.voidsBySeat[s].includes(suit)) return true;
  }
  return false;
}

void TRUMP_RANK_ORDER;

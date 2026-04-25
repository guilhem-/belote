// IA niveau 2 — heuristique simple : force de main pour bid, jeu local pour la carte.
import type { Bid, Card, DealState, Seat, Suit } from '@core/types';
import { partner } from '@core/types';
import type { AIConfig, AIPlayer, BidDecision, CandidatePlay, ObservableEvent, PlayDecision } from './types';
import { handStrength } from './common/hand-strength';
import { masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
import { hasBeloteCombo } from '@core/rules/belote';
import { createRng } from '@core/rng';
import { SUITS } from '@core/types';

const TAKE_THRESHOLD = 50;
const SECOND_ROUND_THRESHOLD = 60;

export function createLevel2AI(seat: Seat, config: AIConfig): AIPlayer {
  const rng = createRng(config.seed);
  let beloteAnnouncedByMe = false;

  return {
    config,
    seat,
    async chooseBid(state: DealState, allowed: readonly Bid[]): Promise<BidDecision> {
      const hand = state.hands[seat];
      let bestBid: Bid = { kind: 'pass' };
      let bestStrength = 0;
      const round = state.phase.kind === 'bidding' ? state.phase.phase.round : 1;
      const threshold = round === 1 ? TAKE_THRESHOLD : SECOND_ROUND_THRESHOLD;

      for (const b of allowed) {
        if (b.kind !== 'take') continue;
        const trump = b.trump;
        const wouldHaveFaceUp = round === 1; // preneur ramasse
        const augmentedHand = wouldHaveFaceUp ? [...hand, state.faceUp] : hand;
        const s = handStrength(augmentedHand, trump, wouldHaveFaceUp);
        if (s > bestStrength) {
          bestStrength = s;
          bestBid = b;
        }
      }

      if (bestStrength < threshold) {
        bestBid = { kind: 'pass' };
      }

      return {
        bid: bestBid,
        reasoning: { level: 2, kind: 'heuristic', handStrength: bestStrength, threshold },
      };
    },

    async chooseCard(state: DealState, legal: readonly Card[]): Promise<PlayDecision> {
      if (state.phase.kind !== 'playing') {
        return { card: legal[0]!, reasoning: { level: 2, kind: 'simple-heuristic', candidates: [], chosen: 'fallback' } };
      }
      const trump = state.phase.trump;
      const trick = state.phase.current;
      const partnerSeat = partner(seat);

      const candidates: CandidatePlay[] = legal.map((c) => ({
        card: c,
        score: scoreCard(c, trick, trump, seat, partnerSeat, state.hands[seat]),
        rationale: '',
      }));

      // Annoter rationale après tri.
      candidates.sort((a, b) => b.score - a.score);
      for (const c of candidates) {
        c.rationale = describe(c.card, trump, trick, seat, partnerSeat, state.hands[seat]);
      }

      // Petit bruit déterministe sur l'égalité de score.
      const top = candidates[0]!;
      const ties = candidates.filter((c) => c.score === top.score);
      const chosen = ties.length > 1 ? ties[Math.floor(rng.next() * ties.length)]! : top;

      // Belote/Rebelote auto-annoncée.
      let announceBelote = false;
      if (chosen.card.suit === trump && (chosen.card.rank === 'K' || chosen.card.rank === 'Q')) {
        if (!beloteAnnouncedByMe && hasBeloteCombo(state.hands[seat], trump)) {
          announceBelote = true;
          beloteAnnouncedByMe = true;
        } else if (beloteAnnouncedByMe) {
          // Rebelote : seulement si la carte qu'on joue est R ou Q et que l'autre n'est plus en main.
          const other = chosen.card.rank === 'K' ? 'Q' : 'K';
          const stillHasOther = state.hands[seat].some((c) => c.suit === trump && c.rank === other);
          if (!stillHasOther) {
            announceBelote = true;
          }
        }
      }

      return {
        card: chosen.card,
        ...(announceBelote ? { announceBelote: true } : {}),
        reasoning: { level: 2, kind: 'simple-heuristic', candidates, chosen: chosen.rationale },
      };
    },

    observe(event: ObservableEvent): void {
      if (event.type === 'deal-end' || event.type === 'deal-start') {
        beloteAnnouncedByMe = false;
      }
    },
    dispose(): void {},
  };
}

function isPartnerCurrentlyMaster(trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat }, trump: Suit, partnerSeat: Seat): boolean {
  if (trick.cards.length === 0) return false;
  return masterSeat(trick, trump) === partnerSeat;
}

function scoreCard(card: Card, trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat }, trump: Suit, seat: Seat, partnerSeat: Seat, _hand: readonly Card[]): number {
  // Heuristiques :
  // - si je peux gagner avec une carte basse → joue celle-là.
  // - si partenaire maître et il y a des points dans le pli → joue carte forte non-atout (donner les points).
  // - sinon joue le moins cher possible.
  let score = 0;

  if (trick.cards.length === 0) {
    // Leader : joue une grosse carte non-atout pour appeler, ou un atout faible si on n'a que des grosses.
    // Heuristique : préfère As/10 d'une couleur, défausse petits atouts en dernier.
    score = -cardPoints(card, trump);
    if (card.suit !== trump && (card.rank === 'A' || card.rank === '10')) score += 5;
    return score;
  }

  const partnerMaster = isPartnerCurrentlyMaster(trick, trump, partnerSeat);
  // Simulation : on pose card et on regarde si on devient maître (suffit de comparer à la carte maître actuelle).
  const wouldWin = wouldBecomeMaster(card, trick, trump);

  if (wouldWin && !partnerMaster) {
    score += 50;
    // Préférer la carte la moins forte qui suffit.
    score -= cardStrength(card, trump);
  } else if (partnerMaster) {
    // Donner des points sans risquer.
    score += cardPoints(card, trump);
    // Ne pas défausser nos plus belles cartes si on n'a que des hors-atout.
    if (card.suit === trump && (card.rank === 'J' || card.rank === '9')) score -= 30;
  } else {
    // On ne gagne pas le pli : minimiser perte.
    score -= cardPoints(card, trump);
    if (card.suit === trump) score -= 5; // économiser atouts
  }

  return score;
}

function wouldBecomeMaster(card: Card, trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat }, trump: Suit): boolean {
  if (trick.cards.length === 0) return true;
  const ledSuit = trick.cards[0]!.card.suit;
  const masterIdx = masterSeat({ leader: trick.leader, cards: trick.cards }, trump);
  void masterIdx;
  // Calcul : carte gagnerait si carte est atout strictement > meilleur atout actuel,
  // OU si pas d'atout dans trick et card de couleur demandée strictement > meilleur de couleur demandée.
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

function describe(card: Card, trump: Suit, trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat }, seat: Seat, partnerSeat: Seat, _hand: readonly Card[]): string {
  if (trick.cards.length === 0) {
    if (card.rank === 'A' && card.suit !== trump) return `Entame as ${card.suit}`;
    return `Entame ${card.rank}${card.suit}`;
  }
  if (isPartnerCurrentlyMaster(trick, trump, partnerSeat)) {
    if (cardPoints(card, trump) >= 10) return `Donne ${cardPoints(card, trump)} pts au partenaire`;
    return `Défausse minime, partenaire maître`;
  }
  if (wouldBecomeMaster(card, trick, trump)) {
    return `Devient maître avec ${card.rank}${card.suit}`;
  }
  return `Sous le maître, économise (${cardPoints(card, trump)} pts)`;
}

void SUITS;

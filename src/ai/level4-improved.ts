// Niveau 4 amélioré — variante expérimentale du level4-deductive avec conventions
// supplémentaires activables via flags. Le but : tester via tournoi quelles conventions
// apportent un gain net, et conserver les meilleures.
//
// Conventions ajoutées (par rapport à level4-deductive) :
//
// F1 — Réception appel direct
//   Si le partenaire entame une PETITE carte non-atout (7/8/9), il signale probablement
//   l'as ou une force dans cette couleur. En tant que partenaire, je tente de fournir
//   une petite carte (préserve ma force, le partenaire reprendra).
//
// F2 — Sous l'as du partenaire, mets le valet
//   Si le partenaire pose l'As d'une couleur non-atout et que je dois fournir, je
//   joue le V (si je l'ai) pour signaler que je tiens R+D dans cette couleur.
//
// F3 — Preneur tire atout long
//   Le preneur, dès qu'il a la main, sort un gros atout (V, 9 ou A) si sa main contient
//   ≥ 5 atouts, pour épuiser la défense même sans le V.
//
// F4 — Couper économique
//   Si je dois couper et qu'aucun adversaire n'est encore intervenu, je coupe avec le
//   plus petit atout possible (le minimum nécessaire). Déjà partiellement géré, on
//   accentue la préférence.
//
// F5 — Garde de coupe
//   Si une couleur est déjà coupée (par moi ou partenaire), je conserve mes cartes
//   non-atout de cette couleur (elles deviennent "petites garanties").

import type { Bid, Card, DealState, Seat, Suit } from '@core/types';
import { partner } from '@core/types';
import type { AIConfig, AIPlayer, BidDecision, CandidatePlay, ObservableEvent, PlayDecision } from './types';
import { CardTracker } from './common/card-tracker';
import { handStrength } from './common/hand-strength';
import { masterSeat } from '@core/rules/trick';
import { cardPoints, cardStrength } from '@core/rules/ordering';
import { hasBeloteCombo } from '@core/rules/belote';
import { createRng } from '@core/rng';

export interface ImprovedFlags {
  receiveDirectCall?: boolean;     // F1
  underAceTheJack?: boolean;       // F2
  takerPullsTrumpLong?: boolean;   // F3
  cutEconomical?: boolean;         // F4 (renforcé)
  cutGuard?: boolean;              // F5
}

/** Toutes les améliorations activées. */
export const ALL_IMPROVEMENTS: ImprovedFlags = {
  receiveDirectCall: true,
  underAceTheJack: true,
  takerPullsTrumpLong: true,
  cutEconomical: true,
  cutGuard: true,
};

interface ConfigWithFlags extends AIConfig {
  improvements?: ImprovedFlags;
}

export function createLevel4Improved(seat: Seat, config: ConfigWithFlags): AIPlayer {
  const flags = config.improvements ?? ALL_IMPROVEMENTS;
  const rng = createRng(config.seed);
  const tracker = new CardTracker(seat);
  let beloteAnnouncedByMe = false;
  /** Couleurs déjà coupées dans cette donne (par n'importe qui) — pour F5. */
  const cutSuits = new Set<Suit>();
  /** Carte d'entame du partenaire pour le pli en cours — pour F1/F2. */
  let partnerLeadOfTrick: Card | null = null;
  let leadOfTrick: { seat: Seat; card: Card } | null = null;

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
        const wouldHaveFaceUp = round === 1;
        const augmented = wouldHaveFaceUp ? [...hand, state.faceUp] : hand;
        const s = handStrength(augmented, b.trump, wouldHaveFaceUp);
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
      const taker = state.phase.taker;

      const candidates: CandidatePlay[] = legal.map((c) => {
        const sc = scoreLevel4Improved(
          c,
          trick,
          trump,
          seat,
          partnerSeat,
          state.hands[seat],
          view,
          tracker,
          conventions,
          flags,
          taker,
          cutSuits,
          partnerLeadOfTrick,
          leadOfTrick,
        );
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
      if (event.type === 'deal-start' || event.type === 'deal-end') {
        beloteAnnouncedByMe = false;
        cutSuits.clear();
        partnerLeadOfTrick = null;
        leadOfTrick = null;
      } else if (event.type === 'belote-announce' && event.seat === seat) {
        beloteAnnouncedByMe = true;
      } else if (event.type === 'play') {
        // Détecte une coupe
        const trump = tracker.view().trump;
        if (trump && leadOfTrick && event.card.suit === trump && leadOfTrick.card.suit !== trump) {
          cutSuits.add(leadOfTrick.card.suit);
        }
        // Note l'entame du pli
        if (!leadOfTrick) {
          leadOfTrick = { seat: event.seat, card: event.card };
          if (event.seat === partner(seat)) partnerLeadOfTrick = event.card;
        }
      } else if (event.type === 'trick-end') {
        leadOfTrick = null;
        partnerLeadOfTrick = null;
      }
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

function isOpponentLikelyVoid(suit: Suit, view: ReturnType<CardTracker['view']>, seat: Seat, partnerSeat: Seat): boolean {
  for (const s of ['N', 'E', 'S', 'W'] as const) {
    if (s === seat || s === partnerSeat) continue;
    if (view.voidsBySeat[s].includes(suit)) return true;
  }
  return false;
}

function scoreLevel4Improved(
  card: Card,
  trick: { cards: readonly { seat: Seat; card: Card }[]; leader: Seat },
  trump: Suit,
  seat: Seat,
  partnerSeat: Seat,
  hand: readonly Card[],
  view: ReturnType<CardTracker['view']>,
  _tracker: CardTracker,
  conventions: string[],
  flags: ImprovedFlags,
  taker: Seat,
  cutSuits: Set<Suit>,
  partnerLeadOfTrick: Card | null,
  _leadOfTrick: { seat: Seat; card: Card } | null,
): { score: number; rationale: string } {
  let score = 0;
  let rationale = '';

  const myTrumps = hand.filter((c) => c.suit === trump);
  const totalTrumpRemaining = view.remainingBySuit[trump];
  const trumpsRemainingOpponents = Math.max(0, totalTrumpRemaining - myTrumps.length);
  const isTaker = seat === taker;
  const partnerIsTaker = partnerSeat === taker;

  if (trick.cards.length === 0) {
    // === ENTAME ===
    // F3 : Preneur tire atout long
    if (
      flags.takerPullsTrumpLong &&
      isTaker &&
      card.suit === trump &&
      myTrumps.length >= 5 &&
      trumpsRemainingOpponents > 0 &&
      (card.rank === 'J' || card.rank === '9' || card.rank === 'A')
    ) {
      score += 35;
      conventions.push('preneur tire atout long');
      rationale = `Tire ${card.rank} atout (long ${myTrumps.length})`;
      return { score, rationale };
    }
    if (card.suit === trump && card.rank === 'J' && myTrumps.length >= 4 && trumpsRemainingOpponents > 0) {
      score += 30;
      conventions.push('tire atout maître');
      rationale = `Tire V atout pour vider`;
      return { score, rationale };
    }
    if (card.suit !== trump && card.rank === 'A') {
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
    if (card.suit !== trump) {
      // F5 : si la couleur a déjà été coupée, ne pas la rejouer (sauf si je vise l'as).
      if (flags.cutGuard && cutSuits.has(card.suit)) {
        score -= 6;
        conventions.push('garde-coupe');
      }
      score -= cardPoints(card, trump);
      if (card.rank === '7' || card.rank === '8' || card.rank === '9') score += 2;
      rationale = `Entame petite ${card.rank}${card.suit}`;
      return { score, rationale };
    }
    score -= 8;
    rationale = `Atout court en entame`;
    return { score, rationale };
  }

  const partnerMaster = isPartnerMaster(trick, trump, partnerSeat);
  const wouldWin = wouldBecomeMaster(card, trick, trump);

  // F1 : Réception appel direct (si partenaire a entamé petit non-atout)
  if (
    flags.receiveDirectCall &&
    partnerLeadOfTrick &&
    partnerLeadOfTrick.suit !== trump &&
    (partnerLeadOfTrick.rank === '7' || partnerLeadOfTrick.rank === '8' || partnerLeadOfTrick.rank === '9') &&
    card.suit === partnerLeadOfTrick.suit
  ) {
    // Si je peux fournir et que je n'ai pas l'As (le partenaire l'a), garde mes forces.
    // Préfère petite carte si je peux laisser passer (pli probablement gagné par adversaire 1 mais
    // partenaire est aussi devant l'autre adversaire).
    if (cardPoints(card, trump) === 0) {
      score += 8;
      conventions.push('réponse appel direct (petite)');
    }
  }

  // F2 : Sous l'as du partenaire, mets le valet
  if (
    flags.underAceTheJack &&
    partnerLeadOfTrick &&
    partnerLeadOfTrick.suit !== trump &&
    partnerLeadOfTrick.rank === 'A' &&
    card.suit === partnerLeadOfTrick.suit &&
    card.rank === 'J'
  ) {
    score += 12;
    conventions.push("sous l'as, le valet");
  }

  if (partnerMaster && !wouldWin) {
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
    score -= cardStrength(card, trump);
    let trickPts = 0;
    for (const pc of trick.cards) trickPts += cardPoints(pc.card, trump);
    score += Math.min(trickPts, 20) * 0.5;
    if (trick.cards.length === 3 && trickPts >= 14) score += 8;
    // F4 : couper économique — si je dois couper avec atout et que je vais gagner, encore plus de bonus pour la plus petite.
    if (flags.cutEconomical && card.suit === trump && trick.cards[0]!.card.suit !== trump) {
      score -= cardStrength(card, trump) * 0.5;
    }
    rationale = `Maître ${card.rank}${card.suit} (+${trickPts} pts)`;
    return { score, rationale };
  }

  // Sous le maître adverse.
  score -= cardPoints(card, trump);
  if (card.suit === trump) score -= 8;
  if (card.suit !== trump && (card.rank === 'A' || card.rank === '10')) score -= 10;
  rationale = `Sous le maître`;
  void partnerIsTaker;
  return { score, rationale };
}

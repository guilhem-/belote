<script lang="ts">
  import type { Card as CardType, Seat, Suit } from '@core/types';
  import { cardStrength } from '@core/rules/ordering';
  import Card from './Card.svelte';

  interface Props {
    cards: readonly CardType[];
    seat: Seat;
    facedown?: boolean;
    legalCards?: readonly CardType[] | undefined;
    canPlay?: boolean;
    /** Permet de cliquer une carte hors-tour pour la pré-sélectionner. */
    canPreselect?: boolean;
    /** Carte actuellement pré-sélectionnée (highlight visuel). */
    pendingCard?: CardType | null;
    trump?: Suit | null;
    onPlay?: ((card: CardType) => void) | undefined;
    onPreselect?: ((card: CardType) => void) | undefined;
  }

  const {
    cards,
    seat,
    facedown = false,
    legalCards,
    canPlay = false,
    canPreselect = false,
    pendingCard = null,
    trump = null,
    onPlay,
    onPreselect,
  }: Props = $props();

  // Ordre conventionnel français : atout d'abord, puis ♥ ♣ ♦ ♠ (alternance couleurs).
  function suitOrder(s: Suit): number {
    if (trump && s === trump) return 0;
    return ({ H: 1, C: 2, D: 3, S: 4 } as Record<Suit, number>)[s];
  }

  const sorted = $derived(
    cards.slice().sort((a, b) => {
      const so = suitOrder(a.suit) - suitOrder(b.suit);
      if (so !== 0) return so;
      // Force décroissante (le plus fort à gauche dans la couleur).
      const ta = trump ?? 'H';
      return cardStrength(b, ta) - cardStrength(a, ta);
    }),
  );

  function isLegal(c: CardType): boolean {
    if (!legalCards) return true;
    return legalCards.some((l) => l.suit === c.suit && l.rank === c.rank);
  }
  function isPending(c: CardType): boolean {
    return pendingCard != null && pendingCard.suit === c.suit && pendingCard.rank === c.rank;
  }
  function handleClick(c: CardType): void {
    if (canPlay && isLegal(c)) {
      onPlay?.(c);
    } else if (canPreselect) {
      onPreselect?.(c);
    }
  }
</script>

<div class="hand" data-seat={seat}>
  {#each sorted as c, i (i + c.suit + c.rank)}
    <Card
      card={c}
      facedown={facedown}
      selectable={(canPlay && isLegal(c)) || canPreselect}
      dimmed={canPlay && !isLegal(c)}
      highlighted={isPending(c)}
      onclick={() => handleClick(c)}
    />
  {/each}
</div>

<style>
  .hand {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>

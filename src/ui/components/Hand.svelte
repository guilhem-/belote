<script lang="ts">
  import type { Card as CardType, Seat } from '@core/types';
  import Card from './Card.svelte';

  interface Props {
    cards: readonly CardType[];
    seat: Seat;
    facedown?: boolean;
    legalCards?: readonly CardType[] | undefined;
    canPlay?: boolean;
    onPlay?: ((card: CardType) => void) | undefined;
  }

  const { cards, seat, facedown = false, legalCards, canPlay = false, onPlay }: Props = $props();

  function isLegal(c: CardType): boolean {
    if (!legalCards) return true;
    return legalCards.some((l) => l.suit === c.suit && l.rank === c.rank);
  }
</script>

<div class="hand" data-seat={seat}>
  {#each cards as c, i (i + c.suit + c.rank)}
    <Card
      card={c}
      facedown={facedown}
      selectable={canPlay && isLegal(c)}
      dimmed={canPlay && !isLegal(c)}
      onclick={() => onPlay?.(c)}
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

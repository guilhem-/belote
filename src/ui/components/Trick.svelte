<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Trick } from '@core/types';
  import Card from './Card.svelte';

  interface Props {
    trick: Trick;
  }
  const { trick }: Props = $props();

  function originFromSeat(seat: 'N' | 'E' | 'S' | 'W'): { x: number; y: number } {
    switch (seat) {
      case 'N':
        return { x: 0, y: -120 };
      case 'S':
        return { x: 0, y: 120 };
      case 'E':
        return { x: 180, y: 0 };
      case 'W':
        return { x: -180, y: 0 };
    }
  }
</script>

<div class="trick">
  {#each trick.cards as pc, i (`${pc.seat}-${pc.card.suit}-${pc.card.rank}-${i}`)}
    <div
      class="played"
      data-seat={pc.seat}
      in:fly={{ duration: 280, ...originFromSeat(pc.seat) }}
    >
      <span class="seat">{pc.seat}</span>
      <Card card={pc.card} />
    </div>
  {/each}
  {#if trick.cards.length === 0}
    <div class="empty">Pli vide — leader {trick.leader}</div>
  {/if}
</div>

<style>
  .trick {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    min-height: 100px;
    justify-content: center;
    padding: 8px;
  }
  .played {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .seat {
    font-size: 11px;
    color: #d1d5db;
  }
  .empty {
    color: #9ca3af;
    font-style: italic;
  }
</style>

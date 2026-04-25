<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Seat, Trick } from '@core/types';
  import { SEAT_SHORT } from '@i18n/notation';
  import Card from './Card.svelte';

  interface Props {
    trick: Trick;
    layout?: 'cross' | 'inline';
  }
  const { trick, layout = 'cross' }: Props = $props();

  function originFromSeat(seat: Seat): { x: number; y: number } {
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

  function findCard(seat: Seat) {
    return trick.cards.find((pc) => pc.seat === seat) ?? null;
  }

  const N = $derived(findCard('N'));
  const E = $derived(findCard('E'));
  const S = $derived(findCard('S'));
  const W = $derived(findCard('W'));
</script>

{#if layout === 'inline'}
  <div class="trick inline">
    {#each trick.cards as pc, i (`${pc.seat}-${pc.card.suit}-${pc.card.rank}-${i}`)}
      <div class="played" data-seat={pc.seat} in:fly={{ duration: 280, ...originFromSeat(pc.seat) }}>
        <span class="seat">{SEAT_SHORT[pc.seat]}</span>
        <Card card={pc.card} />
      </div>
    {/each}
    {#if trick.cards.length === 0}
      <div class="empty">Pli vide — entame {SEAT_SHORT[trick.leader]}</div>
    {/if}
  </div>
{:else}
  <div class="trick cross">
    <div class="slot slot-N">
      {#if N}
        <div in:fly={{ duration: 280, ...originFromSeat('N') }}>
          <span class="seat">{SEAT_SHORT.N}</span>
          <Card card={N.card} />
        </div>
      {/if}
    </div>
    <div class="slot slot-W">
      {#if W}
        <div in:fly={{ duration: 280, ...originFromSeat('W') }}>
          <span class="seat">{SEAT_SHORT.W}</span>
          <Card card={W.card} />
        </div>
      {/if}
    </div>
    <div class="slot slot-center">
      {#if trick.cards.length === 0}
        <div class="empty">Pli vide — entame {SEAT_SHORT[trick.leader]}</div>
      {/if}
    </div>
    <div class="slot slot-E">
      {#if E}
        <div in:fly={{ duration: 280, ...originFromSeat('E') }}>
          <span class="seat">{SEAT_SHORT.E}</span>
          <Card card={E.card} />
        </div>
      {/if}
    </div>
    <div class="slot slot-S">
      {#if S}
        <div in:fly={{ duration: 280, ...originFromSeat('S') }}>
          <span class="seat">{SEAT_SHORT.S}</span>
          <Card card={S.card} />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .trick.inline {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    min-height: 100px;
    justify-content: center;
    padding: 8px;
  }
  .trick.cross {
    display: grid;
    grid-template-columns: 80px 80px 80px;
    grid-template-rows: 100px 28px 100px;
    gap: 6px;
    justify-content: center;
    align-content: center;
    min-height: 240px;
  }
  .slot {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .slot-N {
    grid-column: 2;
    grid-row: 1;
  }
  .slot-W {
    grid-column: 1;
    grid-row: 2;
  }
  .slot-center {
    grid-column: 2;
    grid-row: 2;
  }
  .slot-E {
    grid-column: 3;
    grid-row: 2;
  }
  .slot-S {
    grid-column: 2;
    grid-row: 3;
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
    text-align: center;
    display: block;
  }
  .empty {
    color: #9ca3af;
    font-style: italic;
    font-size: 12px;
  }
</style>

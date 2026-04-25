<script lang="ts">
  import type { Bid, Card, DealState, Seat } from '@core/types';
  import { legalMoves } from '@core/rules/legal-moves';
  import { expectedToPlay } from '@core/game-state';
  import Hand from './Hand.svelte';
  import Trick from './Trick.svelte';
  import BidPanel from './BidPanel.svelte';

  interface Props {
    deal: DealState;
    /** Sièges contrôlés par un humain — leurs cartes sont visibles. En mode 4-humains, tous. */
    humanSeats: readonly Seat[];
    onBid: (seat: Seat, bid: Bid) => void;
    onPlay: (seat: Seat, card: Card) => void;
  }

  const { deal, humanSeats, onBid, onPlay }: Props = $props();

  const phase = $derived(deal.phase);
  const acting = $derived.by(() => {
    if (phase.kind === 'bidding') return phase.phase.toAct;
    if (phase.kind === 'playing') return expectedToPlay(phase.current);
    return null;
  });

  const legalForActing = $derived.by(() => {
    if (phase.kind !== 'playing' || !acting) return [];
    return legalMoves(deal.hands[acting], phase.current, phase.trump, acting);
  });

  function isHuman(s: Seat): boolean {
    return humanSeats.includes(s);
  }
</script>

<div class="table-grid">
  <div class="seat seat-N">
    <div class="badge">N</div>
    <Hand
      cards={deal.hands.N}
      seat="N"
      facedown={!isHuman('N')}
      legalCards={acting === 'N' ? legalForActing : undefined}
      canPlay={phase.kind === 'playing' && acting === 'N' && isHuman('N')}
      onPlay={(c) => onPlay('N', c)}
    />
  </div>
  <div class="seat seat-W">
    <div class="badge">W</div>
    <Hand
      cards={deal.hands.W}
      seat="W"
      facedown={!isHuman('W')}
      legalCards={acting === 'W' ? legalForActing : undefined}
      canPlay={phase.kind === 'playing' && acting === 'W' && isHuman('W')}
      onPlay={(c) => onPlay('W', c)}
    />
  </div>

  <div class="center">
    {#if phase.kind === 'bidding'}
      {#if isHuman(phase.phase.toAct)}
        <BidPanel phase={phase.phase} onBid={(b) => onBid(phase.phase.toAct, b)} />
      {:else}
        <div class="info">En attente de {phase.phase.toAct}…</div>
      {/if}
    {:else if phase.kind === 'playing'}
      <div class="trump-indic">Atout : <strong>{phase.trump}</strong> · Preneur : <strong>{phase.taker}</strong></div>
      <Trick trick={phase.current} />
      <div class="counts">Plis joués : {phase.tricks.length}/8</div>
    {:else}
      <div class="result-box">
        <h3>Donne terminée</h3>
        <div>NS : {phase.result.nsScore} · EO : {phase.result.ewScore}</div>
        {#if phase.result.dedans}<div>Dedans !</div>{/if}
        {#if phase.result.capot}<div>Capot {phase.result.capot}</div>{/if}
      </div>
    {/if}
  </div>

  <div class="seat seat-E">
    <div class="badge">E</div>
    <Hand
      cards={deal.hands.E}
      seat="E"
      facedown={!isHuman('E')}
      legalCards={acting === 'E' ? legalForActing : undefined}
      canPlay={phase.kind === 'playing' && acting === 'E' && isHuman('E')}
      onPlay={(c) => onPlay('E', c)}
    />
  </div>
  <div class="seat seat-S">
    <div class="badge">S</div>
    <Hand
      cards={deal.hands.S}
      seat="S"
      facedown={!isHuman('S')}
      legalCards={acting === 'S' ? legalForActing : undefined}
      canPlay={phase.kind === 'playing' && acting === 'S' && isHuman('S')}
      onPlay={(c) => onPlay('S', c)}
    />
  </div>
</div>

<style>
  .table-grid {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    grid-template-rows: auto 1fr auto;
    gap: 12px;
    padding: 12px;
    background: radial-gradient(ellipse at center, #0b6b3a 0%, #08502b 80%);
    border-radius: 12px;
    min-height: 480px;
  }
  .seat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .seat-N {
    grid-column: 2;
    grid-row: 1;
  }
  .seat-S {
    grid-column: 2;
    grid-row: 3;
  }
  .seat-W {
    grid-column: 1;
    grid-row: 2;
  }
  .seat-E {
    grid-column: 3;
    grid-row: 2;
  }
  .center {
    grid-column: 2;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
  }
  .badge {
    background: rgba(0, 0, 0, 0.35);
    border-radius: 9999px;
    padding: 2px 10px;
    font-weight: 700;
  }
  .info {
    color: #d1d5db;
    font-style: italic;
  }
  .trump-indic {
    background: rgba(0, 0, 0, 0.4);
    padding: 4px 12px;
    border-radius: 6px;
  }
  .counts {
    font-size: 12px;
    opacity: 0.8;
  }
  .result-box {
    background: rgba(0, 0, 0, 0.5);
    padding: 12px 18px;
    border-radius: 8px;
    text-align: center;
  }
</style>

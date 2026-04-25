<script lang="ts">
  import type { Bid, BidPhase, Suit } from '@core/types';
  import { legalBids } from '@core/bidding';
  import CardView from './Card.svelte';

  interface Props {
    phase: BidPhase;
    onBid: (bid: Bid) => void;
  }

  const { phase, onBid }: Props = $props();
  const bids = $derived(legalBids(phase));

  const SUIT_GLYPH: Record<Suit, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };

  function label(b: Bid): string {
    if (b.kind === 'pass') return 'Passer';
    return `Prendre ${SUIT_GLYPH[b.trump]}`;
  }
</script>

<div class="bid-panel">
  <div class="info">
    <div>Tour {phase.round} — à <strong>{phase.toAct}</strong></div>
    <div class="face-up">
      <span>Retourne :</span>
      <CardView card={phase.faceUp} />
    </div>
  </div>
  <div class="actions">
    {#each bids as b}
      <button type="button" class="bid-btn" onclick={() => onBid(b)}>{label(b)}</button>
    {/each}
  </div>
  {#if phase.bids.length > 0}
    <div class="history">
      <strong>Annonces :</strong>
      {#each phase.bids as b, i (i)}
        <span>{b.seat}: {b.bid.kind === 'pass' ? 'pass' : 'take ' + SUIT_GLYPH[b.bid.trump]}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .bid-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
  }
  .info {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .face-up {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .bid-btn {
    padding: 8px 14px;
    background: #1f2937;
    color: white;
    border: 1px solid #4b5563;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }
  .bid-btn:hover {
    background: #374151;
  }
  .history {
    font-size: 13px;
    opacity: 0.8;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
</style>


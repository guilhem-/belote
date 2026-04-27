<script lang="ts">
  import type { Bid, BidPhase } from '@core/types';
  import { legalBids } from '@core/bidding';
  import { SEAT_SHORT, SUIT_GLYPH } from '@i18n/notation';
  import CardView from './Card.svelte';

  interface Props {
    phase: BidPhase;
    interactive?: boolean;
    onBid: (bid: Bid) => void;
  }

  const { phase, interactive = true, onBid }: Props = $props();
  const bids = $derived(legalBids(phase));

  function label(b: Bid): string {
    if (b.kind === 'pass') return 'Passer';
    return `Prendre ${SUIT_GLYPH[b.trump]}`;
  }
</script>

<div class="bid-panel">
  <div class="info">
    <div>Tour {phase.round} — à <strong>{SEAT_SHORT[phase.toAct]}</strong></div>
    <div class="face-up">
      <span>Retourne :</span>
      <CardView card={phase.faceUp} />
    </div>
  </div>
  {#if interactive}
    <div class="actions">
      {#each bids as b}
        <button type="button" class="bid-btn" onclick={() => onBid(b)}>{label(b)}</button>
      {/each}
    </div>
  {:else}
    <div class="waiting">En attente de <strong>{SEAT_SHORT[phase.toAct]}</strong>…</div>
  {/if}
  {#if phase.bids.length > 0}
    <div class="history">
      <strong>Annonces :</strong>
      {#each phase.bids as b, i (i)}
        <span
          >{SEAT_SHORT[b.seat]}: {b.bid.kind === 'pass' ? 'passe' : 'prend ' + SUIT_GLYPH[b.bid.trump]}</span
        >
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
  .waiting {
    color: #d1d5db;
    font-style: italic;
    padding: 8px 0;
  }
  .history {
    font-size: 13px;
    opacity: 0.8;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
</style>

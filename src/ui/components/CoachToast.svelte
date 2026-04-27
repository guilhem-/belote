<script lang="ts">
  import { coachStore } from '../stores/coach.store.svelte';
  import { RANK_LABEL, SUIT_GLYPH } from '@i18n/notation';
  import type { Bid, Card } from '@core/types';

  function lbl(c: Card): string {
    return `${RANK_LABEL[c.rank]}${SUIT_GLYPH[c.suit]}`;
  }
  function bidLabel(b: Bid): string {
    if (b.kind === 'pass') return 'passer';
    return `prendre ${SUIT_GLYPH[b.trump]}`;
  }
</script>

{#if coachStore.current}
  {@const w = coachStore.current}
  <div class="coach" role="alert">
    <header>
      <span class="badge">Coach · {w.kind === 'bid' ? 'enchère' : 'jeu'}</span>
      <button class="close" onclick={() => coachStore.dismiss()} aria-label="Fermer">×</button>
    </header>
    <div class="body">
      {#if w.kind === 'play'}
        <div class="line">
          <span class="played">Joué : <strong>{lbl(w.played)}</strong></span>
          <span class="rec">Recommandé : <strong>{lbl(w.recommended)}</strong></span>
        </div>
        <p class="explain">{w.explanation}</p>
        {#if w.rationale}
          <p class="rationale"><em>{w.rationale}</em></p>
        {/if}
      {:else}
        <div class="line">
          <span class="played">Choisi : <strong>{bidLabel(w.played)}</strong></span>
          <span class="rec">Recommandé : <strong>{bidLabel(w.recommended)}</strong></span>
        </div>
        <p class="explain">{w.explanation}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .coach {
    position: fixed;
    bottom: 16px;
    right: 16px;
    max-width: 380px;
    background: #7c2d12;
    color: #fff;
    border: 1px solid #fbbf24;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    padding: 8px 12px;
    z-index: 150;
    font-size: 13px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .badge {
    background: #fbbf24;
    color: #422006;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .close {
    background: transparent;
    color: #fde68a;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 12px;
    gap: 8px;
  }
  .played strong {
    color: #fca5a5;
  }
  .rec strong {
    color: #86efac;
  }
  .explain {
    margin: 4px 0 2px;
    line-height: 1.4;
  }
  .rationale {
    color: #fbbf24;
    font-size: 11px;
    margin: 0;
  }
</style>

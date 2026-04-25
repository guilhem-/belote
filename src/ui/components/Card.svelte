<script lang="ts">
  import type { Card as CardType } from '@core/types';
  import { RANK_LABEL, SUIT_GLYPH, SUIT_IS_RED } from '@i18n/notation';

  interface Props {
    card: CardType | null;
    facedown?: boolean;
    selectable?: boolean;
    highlighted?: boolean;
    dimmed?: boolean;
    onclick?: () => void;
  }

  const {
    card,
    facedown = false,
    selectable = false,
    highlighted = false,
    dimmed = false,
    onclick,
  }: Props = $props();
</script>

{#if facedown || !card}
  <div class="card facedown" aria-label="carte cachée"></div>
{:else}
  <button
    type="button"
    class="card"
    class:red={SUIT_IS_RED[card.suit]}
    class:selectable
    class:highlighted
    class:dimmed
    onclick={onclick}
    disabled={!selectable}
    aria-label={`${RANK_LABEL[card.rank]} de ${SUIT_GLYPH[card.suit]}`}
  >
    <span class="rank">{RANK_LABEL[card.rank]}</span>
    <span class="suit">{SUIT_GLYPH[card.suit]}</span>
  </button>
{/if}

<style>
  .card {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 80px;
    background: white;
    color: black;
    border: 1.5px solid #1f2937;
    border-radius: 6px;
    font-family: 'Times New Roman', serif;
    font-weight: 600;
    line-height: 1;
    padding: 0;
    cursor: default;
    transition: transform 120ms ease, box-shadow 120ms ease;
    user-select: none;
  }
  .card.red {
    color: #c1121f;
  }
  .card.facedown {
    background: linear-gradient(135deg, #1d4ed8 25%, #1e3a8a 75%);
    border-color: #1e3a8a;
  }
  .card.selectable {
    cursor: pointer;
  }
  .card.selectable:hover {
    transform: translateY(-6px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }
  .card.highlighted {
    box-shadow: 0 0 0 3px #facc15;
  }
  .card.dimmed {
    opacity: 0.45;
  }
  .rank {
    font-size: 18px;
  }
  .suit {
    font-size: 22px;
    margin-top: 2px;
  }
</style>

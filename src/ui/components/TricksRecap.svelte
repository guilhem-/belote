<script lang="ts">
  import type { CompletedTrick, Suit } from '@core/types';
  import { SEAT_TEAM } from '@core/types';
  import { SEAT_SHORT, SUIT_GLYPH } from '@i18n/notation';
  import Card from './Card.svelte';

  interface Props {
    tricks: readonly CompletedTrick[];
    trump: Suit;
  }

  const { tricks, trump }: Props = $props();

  let openLast = $state(false);

  const stats = $derived.by(() => {
    let nsTricks = 0;
    let ewTricks = 0;
    let nsPts = 0;
    let ewPts = 0;
    for (const t of tricks) {
      if (SEAT_TEAM[t.winner] === 'NS') {
        nsTricks++;
        nsPts += t.points;
      } else {
        ewTricks++;
        ewPts += t.points;
      }
    }
    return { nsTricks, ewTricks, nsPts, ewPts };
  });

  const last = $derived(tricks[tricks.length - 1] ?? null);
</script>

<div class="recap">
  <div class="team team-ns" title="Plis remportés par NS">
    <span class="badge">NS</span>
    <span class="count">{stats.nsTricks}</span>
    <span class="pts">{stats.nsPts} pts</span>
  </div>

  <button
    type="button"
    class="last-btn"
    onclick={() => (openLast = !openLast)}
    disabled={!last}
    title={last ? 'Voir le dernier pli' : 'Aucun pli joué'}
  >
    {openLast ? 'Fermer' : 'Dernier pli'}
  </button>

  <div class="team team-ew" title="Plis remportés par EO">
    <span class="badge">EO</span>
    <span class="count">{stats.ewTricks}</span>
    <span class="pts">{stats.ewPts} pts</span>
  </div>

  {#if openLast && last}
    <div class="popover">
      <header>
        <strong>Dernier pli</strong>
        <span class="winner">Gagné par <b>{SEAT_SHORT[last.winner]}</b> · +{last.points} pts</span>
      </header>
      <div class="cards">
        {#each last.cards as pc, i (i)}
          <div class="played" data-seat={pc.seat}>
            <span class="seat">{SEAT_SHORT[pc.seat]}</span>
            <Card card={pc.card} />
          </div>
        {/each}
      </div>
      {#if trump}<div class="trump">Atout : {SUIT_GLYPH[trump]}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .recap {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.35);
    border-radius: 8px;
    position: relative;
    flex-wrap: wrap;
  }
  .team {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .team-ns .badge {
    color: #93c5fd;
  }
  .team-ew .badge {
    color: #fca5a5;
  }
  .badge {
    font-weight: 700;
    font-size: 11px;
  }
  .count {
    font-size: 18px;
    font-weight: 700;
  }
  .pts {
    color: #d1d5db;
    font-size: 12px;
  }
  .last-btn {
    background: #1e293b;
    color: white;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 12px;
  }
  .last-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .last-btn:hover:not(:disabled) {
    background: #334155;
  }
  .popover {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.97);
    color: white;
    padding: 12px 14px;
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
    z-index: 30;
    min-width: 320px;
  }
  .popover header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 13px;
  }
  .popover .winner {
    color: #fcd34d;
  }
  .cards {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .played {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .seat {
    font-size: 10px;
    color: #94a3b8;
  }
  .trump {
    margin-top: 6px;
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
  }
</style>

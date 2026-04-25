<script lang="ts">
  import type { MatchState } from '@core/types';

  interface Props {
    match: MatchState;
  }
  const { match }: Props = $props();
</script>

<div class="scoreboard">
  <div class="team team-ns">
    <div class="label">NS</div>
    <div class="score">{match.nsTotal}</div>
  </div>
  <div class="meta">
    <div>Donnes : {match.deals.length}</div>
    {#if match.settings.endMode === 'points'}
      <div>Cible : {match.settings.targetPoints}</div>
    {:else}
      <div>Donnes cible : {match.settings.targetDeals}</div>
    {/if}
    {#if match.finished}
      <div class="winner">
        {#if match.winner === 'draw'}
          Égalité
        {:else}
          Vainqueur : <strong>{match.winner}</strong>
        {/if}
      </div>
    {/if}
  </div>
  <div class="team team-ew">
    <div class="label">EO</div>
    <div class="score">{match.ewTotal}</div>
  </div>
</div>

<style>
  .scoreboard {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
  }
  .team {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;
  }
  .label {
    font-size: 12px;
    opacity: 0.8;
  }
  .score {
    font-size: 32px;
    font-weight: 800;
  }
  .team-ns .score {
    color: #93c5fd;
  }
  .team-ew .score {
    color: #fca5a5;
  }
  .meta {
    text-align: center;
    font-size: 13px;
    opacity: 0.85;
  }
  .winner {
    margin-top: 4px;
    color: #fde68a;
  }
</style>

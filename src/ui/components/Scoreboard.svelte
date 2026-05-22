<script lang="ts">
  import type { MatchState, Team } from '@core/types';

  interface Props {
    match: MatchState;
  }
  const { match }: Props = $props();

  const TEAM_LABEL: Record<Team, string> = { NS: 'NS', EW: 'EO' };
</script>

<div class="scoreboard">
  <div class="team team-ns">
    <span class="label">NS</span>
    <span class="score">{match.nsTotal}</span>
  </div>
  <div class="team team-ew">
    <span class="label">EO</span>
    <span class="score">{match.ewTotal}</span>
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
        {:else if match.winner}
          Vainqueur : <strong>{TEAM_LABEL[match.winner]}</strong>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .scoreboard {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
  }
  .team {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .label {
    font-size: 13px;
    opacity: 0.85;
    font-weight: 600;
  }
  .score {
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
  }
  .team-ns .score {
    color: #93c5fd;
  }
  .team-ew .score {
    color: #fca5a5;
  }
  .meta {
    text-align: center;
    font-size: 12px;
    opacity: 0.8;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 6px;
    margin-top: 2px;
  }
  .winner {
    margin-top: 4px;
    color: #fde68a;
  }
</style>

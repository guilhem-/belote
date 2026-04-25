<script lang="ts">
  import { matchStore } from '../stores/match.store.svelte';
  import { debugStore } from '../stores/debug.store.svelte';
  import { settingsStore } from '../stores/settings.store.svelte';
  import Table from '../components/Table.svelte';
  import Scoreboard from '../components/Scoreboard.svelte';
  import SettingsPanel from '../components/SettingsPanel.svelte';
  import ReasoningPanel from '../components/debug/ReasoningPanel.svelte';
  import type { Bid, Card, Seat } from '@core/types';

  let settingsOpen = $state(false);

  const humanSeats = $derived(
    debugStore.revealHands ? (['N', 'E', 'S', 'W'] as Seat[]) : settingsStore.value.humans,
  );

  function onBid(seat: Seat, bid: Bid): void {
    matchStore.submitHumanBid(seat, bid);
  }

  function onPlay(seat: Seat, card: Card): void {
    matchStore.submitHumanPlay(seat, card);
  }

  function nextDeal(): void {
    matchStore.nextDeal();
  }

  function newMatch(): void {
    matchStore.newMatch();
  }

  function applySettings(): void {
    settingsOpen = false;
    matchStore.newMatch();
  }
</script>

<div class="screen">
  <header class="topbar">
    <h1>Belote</h1>
    <Scoreboard match={matchStore.value.match} />
    <div class="topbar-actions">
      <button onclick={() => (settingsOpen = true)}>Paramètres</button>
      <button onclick={() => debugStore.toggle()}
        >{debugStore.visible ? 'Masquer debug' : 'Voir pensées IA'}</button
      >
      <button onclick={newMatch}>Nouvelle partie</button>
      {#if matchStore.value.deal.phase.kind === 'scored' && !matchStore.value.match.finished}
        <button class="primary" onclick={nextDeal}>Donne suivante</button>
      {/if}
    </div>
  </header>

  <main class="main">
    <Table deal={matchStore.value.deal} {humanSeats} {onBid} {onPlay} />
  </main>

  <footer class="footer">
    <span>Seed donne : 0x{matchStore.value.dealSeed.toString(16)}</span>
    <span>Donneur : {matchStore.value.deal.dealer}</span>
    <span>Cadence : {(settingsStore.value.paceMs / 1000).toFixed(1)}s</span>
  </footer>

  <ReasoningPanel />
  {#if settingsOpen}
    <SettingsPanel onApply={applySettings} onClose={() => (settingsOpen = false)} />
  {/if}
</div>

<style>
  .screen {
    max-width: 1100px;
    margin: 0 auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 100vh;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .topbar h1 {
    font-size: 24px;
    font-weight: 800;
  }
  .topbar-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .topbar-actions button {
    background: #1f2937;
    color: white;
    border: 1px solid #4b5563;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  .topbar-actions button.primary {
    background: #f59e0b;
    color: black;
    border-color: #f59e0b;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    opacity: 0.7;
    flex-wrap: wrap;
    gap: 12px;
  }
</style>

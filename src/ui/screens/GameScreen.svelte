<script lang="ts">
  import { matchStore } from '../stores/match.store';
  import Table from '../components/Table.svelte';
  import Scoreboard from '../components/Scoreboard.svelte';
  import type { Bid, Card, Seat } from '@core/types';

  const humanSeats = $derived(matchStore.value.setup.humans);

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

</script>

<div class="screen">
  <header class="topbar">
    <h1>Belote</h1>
    <Scoreboard match={matchStore.value.match} />
    <div class="topbar-actions">
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
  </footer>
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
  }
</style>

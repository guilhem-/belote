<script lang="ts">
  import { matchStore } from '../stores/match.store.svelte';
  import { debugStore } from '../stores/debug.store.svelte';
  import { settingsStore } from '../stores/settings.store.svelte';
  import Table from '../components/Table.svelte';
  import Scoreboard from '../components/Scoreboard.svelte';
  import SettingsPanel from '../components/SettingsPanel.svelte';
  import ReasoningPanel from '../components/debug/ReasoningPanel.svelte';
  import { SEAT_SHORT as seatShort } from '@i18n/notation';
  import type { Bid, Card, Seat } from '@core/types';

  let settingsOpen = $state(false);

  const humanSeats = $derived(settingsStore.value.humans);
  const revealedSeats = $derived(
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

  let seedToast = $state<string | null>(null);

  function showToast(msg: string): void {
    seedToast = msg;
    setTimeout(() => {
      seedToast = null;
    }, 2200);
  }

  function seedHex(): string {
    return '0x' + matchStore.value.match.seed.toString(16).padStart(8, '0');
  }

  async function copySeed(): Promise<void> {
    const s = seedHex();
    try {
      await navigator.clipboard.writeText(s);
      showToast(`Seed ${s} copiée`);
    } catch {
      showToast('Impossible de copier (presse-papier indisponible)');
    }
  }

  async function loadSeedFromClipboard(): Promise<void> {
    try {
      const txt = (await navigator.clipboard.readText()).trim();
      const m = txt.match(/^(?:0x)?([0-9a-fA-F]+)$/);
      if (!m) {
        showToast(`Seed invalide : « ${txt.slice(0, 16)} »`);
        return;
      }
      const seed = parseInt(m[1]!, 16) >>> 0;
      matchStore.newMatch(seed);
      showToast(`Partie chargée depuis seed 0x${seed.toString(16)}`);
    } catch {
      showToast('Impossible de lire le presse-papier');
    }
  }
</script>

<div class="screen" class:with-debug={debugStore.visible}>
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
    <Table
      deal={matchStore.value.deal}
      displayedTrick={matchStore.value.displayedTrick}
      {humanSeats}
      {revealedSeats}
      trickLayout={settingsStore.value.trickLayout}
      {onBid}
      {onPlay}
    />
  </main>

  <footer class="footer">
    <span class="seed-block">
      Seed partie : <code>{seedHex()}</code>
      <button
        type="button"
        class="icon-btn"
        title="Copier la seed dans le presse-papier"
        aria-label="Copier la seed"
        onclick={copySeed}
      >
        📋
      </button>
      <button
        type="button"
        class="icon-btn"
        title="Charger une partie depuis la seed dans le presse-papier"
        aria-label="Charger seed depuis presse-papier"
        onclick={loadSeedFromClipboard}
      >
        📥
      </button>
    </span>
    <span>Donneur : {seatShort[matchStore.value.deal.dealer]}</span>
    <span>Cadence : {(settingsStore.value.paceMs / 1000).toFixed(1)}s</span>
  </footer>

  {#if seedToast}
    <div class="toast" role="status">{seedToast}</div>
  {/if}

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
    transition: padding-right 200ms ease;
  }
  .screen.with-debug {
    max-width: none;
    margin: 0;
    padding-right: 400px;
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
    opacity: 0.85;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }
  .seed-block {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .seed-block code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
  }
  .icon-btn {
    background: transparent;
    border: 1px solid #4b5563;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    line-height: 1;
    font-size: 14px;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .toast {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.95);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 200;
  }
</style>

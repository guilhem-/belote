<script lang="ts">
  import { matchStore } from '../stores/match.store.svelte';
  import { debugStore } from '../stores/debug.store.svelte';
  import { settingsStore } from '../stores/settings.store.svelte';
  import Table from '../components/Table.svelte';
  import Scoreboard from '../components/Scoreboard.svelte';
  import SettingsPanel from '../components/SettingsPanel.svelte';
  import AboutPanel from '../components/AboutPanel.svelte';
  import Confetti from '../components/Confetti.svelte';
  import CoachToast from '../components/CoachToast.svelte';
  import ReasoningPanel from '../components/debug/ReasoningPanel.svelte';
  import { SEAT_SHORT as seatShort } from '@i18n/notation';
  import { SEAT_TEAM } from '@core/types';
  import type { Bid, Card, Seat, Team } from '@core/types';

  let settingsOpen = $state(false);
  let aboutOpen = $state(false);

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

  function onPreselect(seat: Seat, card: Card): void {
    matchStore.preselectHumanCard(seat, card);
  }

  // Confettis si humain a gagné le match (cible de points atteinte).
  const humanTeams = $derived.by(() => {
    const teams = new Set<Team>();
    for (const s of settingsStore.value.humans) teams.add(SEAT_TEAM[s]);
    return teams;
  });
  const humanWon = $derived.by(() => {
    const m = matchStore.value.match;
    if (!m.finished || !m.winner || m.winner === 'draw') return false;
    return humanTeams.has(m.winner);
  });

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
  <aside class="sidebar sidebar-left">
    <h1 class="title">Belote</h1>
    <Scoreboard match={matchStore.value.match} />
    <div class="info-block">
      <div class="info-row">
        <span class="info-label">Donneur</span>
        <span class="info-value">{seatShort[matchStore.value.deal.dealer]}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Cadence</span>
        <span class="info-value">{(settingsStore.value.paceMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
    <div class="seed-block">
      <span class="seed-label">Seed partie</span>
      <code class="seed-code">{seedHex()}</code>
      <div class="seed-actions">
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
      </div>
    </div>
  </aside>

  <main class="play-area">
    <Table
      deal={matchStore.value.deal}
      displayedTrick={matchStore.value.displayedTrick}
      pendingCard={matchStore.value.pendingHumanCard}
      dealingAnimation={matchStore.value.dealingAnimation}
      beloteBanner={matchStore.value.beloteBanner}
      playRuleOptions={{ enforceTrumpAfterAnyCut: settingsStore.value.enforceTrumpAfterAnyCut }}
      {humanSeats}
      {revealedSeats}
      trickLayout={settingsStore.value.trickLayout}
      {onBid}
      {onPlay}
      {onPreselect}
    />
  </main>

  <aside class="sidebar sidebar-right">
    {#if matchStore.value.deal.phase.kind === 'scored' && !matchStore.value.match.finished}
      <button class="action primary" onclick={nextDeal}>Donne suivante</button>
    {/if}
    <button class="action" onclick={newMatch}>Nouvelle partie</button>
    <button class="action" onclick={() => (settingsOpen = true)}>Paramètres</button>
    <button class="action" onclick={() => debugStore.toggle()}>
      {debugStore.visible ? 'Masquer debug' : 'Voir pensées IA'}
    </button>
    <button class="action" onclick={() => (aboutOpen = true)}>À propos</button>
  </aside>

  {#if seedToast}
    <div class="toast" role="status">{seedToast}</div>
  {/if}

  <Confetti active={humanWon} />
  <CoachToast />

  <ReasoningPanel />
  {#if settingsOpen}
    <SettingsPanel onApply={applySettings} onClose={() => (settingsOpen = false)} />
  {/if}
  {#if aboutOpen}
    <AboutPanel onClose={() => (aboutOpen = false)} />
  {/if}
</div>

<div class="portrait-warning" role="alert">
  <div class="portrait-icon">📱↻</div>
  <p>Tourne ton appareil en mode paysage pour jouer.</p>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: row;
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    gap: 8px;
    padding: 8px;
    transition: padding-right 200ms ease;
  }
  .screen.with-debug {
    padding-right: 388px;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: clamp(160px, 18vw, 240px);
    flex-shrink: 0;
    min-height: 0;
    overflow-y: auto;
  }

  .title {
    font-size: 22px;
    font-weight: 800;
    text-align: center;
    margin: 0;
    letter-spacing: 0.5px;
  }

  .info-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    opacity: 0.9;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .info-label {
    opacity: 0.75;
  }
  .info-value {
    font-weight: 600;
  }

  .seed-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
  }
  .seed-label {
    opacity: 0.75;
  }
  .seed-code {
    font-family: ui-monospace, monospace;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 3px;
    word-break: break-all;
  }
  .seed-actions {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }
  .icon-btn {
    background: transparent;
    border: 1px solid #4b5563;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    flex: 1;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .action {
    background: #1f2937;
    color: white;
    border: 1px solid #4b5563;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    text-align: center;
    font-weight: 500;
  }
  .action:hover {
    background: #374151;
  }
  .action.primary {
    background: #f59e0b;
    color: black;
    border-color: #f59e0b;
    font-weight: 700;
  }
  .action.primary:hover {
    background: #fbbf24;
  }

  .play-area {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
  }
  .play-area > :global(.table-grid) {
    flex: 1;
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

  .portrait-warning {
    display: none;
    position: fixed;
    inset: 0;
    background: #08502b;
    color: white;
    z-index: 9999;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
    font-size: 18px;
    gap: 16px;
  }
  .portrait-icon {
    font-size: 64px;
    animation: rotate-hint 2s ease-in-out infinite;
  }
  @keyframes rotate-hint {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(90deg); }
  }

  /* Smartphones tenus en portrait : on demande de tourner l'écran. */
  @media (orientation: portrait) and (max-width: 768px) {
    .screen {
      display: none;
    }
    .portrait-warning {
      display: flex;
    }
  }
</style>

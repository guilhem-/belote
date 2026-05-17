<script lang="ts">
  import { settingsStore } from '../stores/settings.store.svelte';
  import type { Seat } from '@core/types';
  import type { AILevel } from '@ai/types';
  import { SEAT_FULL } from '@i18n/notation';

  interface Props {
    onApply: () => void;
    onClose: () => void;
  }
  const { onApply, onClose }: Props = $props();

  const SEATS: Seat[] = ['N', 'E', 'S', 'W'];
  const LEVELS: AILevel[] = [1, 2, 3, 4, 5];
  const PACE_PRESETS = [
    { label: 'Instant', ms: 200 },
    { label: 'Rapide', ms: 1500 },
    { label: 'Normal', ms: 2500 },
    { label: 'Posé', ms: 4000 },
    { label: 'Lent', ms: 6000 },
  ];

  function toggleHuman(s: Seat): void {
    settingsStore.set((c) => {
      const has = c.humans.includes(s);
      const humans = has ? c.humans.filter((x) => x !== s) : [...c.humans, s];
      return { ...c, humans };
    });
  }

  function setLevel(s: Seat, lvl: AILevel): void {
    settingsStore.set((c) => ({ ...c, aiLevels: { ...c.aiLevels, [s]: lvl } }));
  }

  function setPace(ms: number): void {
    settingsStore.set((c) => ({ ...c, paceMs: ms }));
  }

  function setEndMode(mode: 'points' | 'deals'): void {
    settingsStore.set((c) => ({ ...c, endMode: mode }));
  }
</script>

<div class="overlay" role="dialog" aria-label="Paramètres">
  <div class="panel">
    <header>
      <h2>Paramètres</h2>
      <button class="close" onclick={onClose} aria-label="Fermer">×</button>
    </header>

    <section>
      <h3>Joueurs</h3>
      <p class="hint">Cochez les sièges contrôlés par un humain. Les autres sont des IA.</p>
      <div class="seats">
        {#each SEATS as s}
          <div class="seat-row">
            <label>
              <input
                type="checkbox"
                checked={settingsStore.value.humans.includes(s)}
                onchange={() => toggleHuman(s)}
              />
              {SEAT_FULL[s]} humain
            </label>
            {#if !settingsStore.value.humans.includes(s)}
              <select
                value={settingsStore.value.aiLevels[s] ?? 4}
                onchange={(e) => setLevel(s, Number(e.currentTarget.value) as AILevel)}
              >
                {#each LEVELS as l}
                  <option value={l}>Niveau {l}{l === 5 ? ' (PIMC)' : ''}</option>
                {/each}
              </select>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <section>
      <h3>Cadence d'un pli</h3>
      <div class="pace">
        {#each PACE_PRESETS as p}
          <button
            class:active={Math.abs(settingsStore.value.paceMs - p.ms) < 100}
            onclick={() => setPace(p.ms)}
          >
            {p.label}<br /><small>{(p.ms / 1000).toFixed(1)}s</small>
          </button>
        {/each}
      </div>
      <label class="custom">
        Personnalisé : {(settingsStore.value.paceMs / 1000).toFixed(1)}s
        <input type="range" min="200" max="8000" step="100" value={settingsStore.value.paceMs} oninput={(e) => setPace(Number(e.currentTarget.value))} />
      </label>
    </section>

    <section>
      <h3>Cadence des enchères</h3>
      <label class="custom">
        Délai par décision d'enchère : {(settingsStore.value.bidPaceMs / 1000).toFixed(1)}s
        <input
          type="range"
          min="100"
          max="3000"
          step="100"
          value={settingsStore.value.bidPaceMs}
          oninput={(e) =>
            settingsStore.set((c) => ({ ...c, bidPaceMs: Number(e.currentTarget.value) }))}
        />
      </label>
    </section>

    <section>
      <h3>Fin de partie</h3>
      <label><input type="radio" checked={settingsStore.value.endMode === 'points'} onchange={() => setEndMode('points')} /> Points</label>
      {#if settingsStore.value.endMode === 'points'}
        <select value={settingsStore.value.targetPoints} onchange={(e) => settingsStore.set((c) => ({ ...c, targetPoints: Number(e.currentTarget.value) as 501 | 1000 | 1501 }))}>
          <option value={501}>501</option>
          <option value={1000}>1000</option>
          <option value={1501}>1501</option>
        </select>
      {/if}
      <label><input type="radio" checked={settingsStore.value.endMode === 'deals'} onchange={() => setEndMode('deals')} /> N donnes</label>
      {#if settingsStore.value.endMode === 'deals'}
        <input type="number" min="1" max="50" value={settingsStore.value.targetDeals} oninput={(e) => settingsStore.set((c) => ({ ...c, targetDeals: Number(e.currentTarget.value) }))} />
      {/if}
    </section>

    <section>
      <h3>Annonces</h3>
      <label>
        <input
          type="checkbox"
          checked={settingsStore.value.beloteEnabled}
          onchange={(e) =>
            settingsStore.set((c) => ({ ...c, beloteEnabled: e.currentTarget.checked }))}
        />
        Belote / Rebelote activée
      </label>
    </section>

    <section>
      <h3>Confort</h3>
      <div class="layout-choice">
        <label>
          <input
            type="checkbox"
            checked={settingsStore.value.autoPlayLastCard}
            onchange={(e) =>
              settingsStore.set((c) => ({ ...c, autoPlayLastCard: e.currentTarget.checked }))}
          />
          Jouer automatiquement la dernière carte forcée
        </label>
        <label>
          <input
            type="checkbox"
            checked={settingsStore.value.autoNextDeal}
            onchange={(e) =>
              settingsStore.set((c) => ({ ...c, autoNextDeal: e.currentTarget.checked }))}
          />
          Lancer automatiquement la donne suivante
        </label>
        <label>
          <input
            type="checkbox"
            checked={settingsStore.value.coachWarnings}
            onchange={(e) =>
              settingsStore.set((c) => ({ ...c, coachWarnings: e.currentTarget.checked }))}
          />
          Coach : avertir quand un coup humain semble sous-optimal
        </label>
        <label>
          <input
            type="checkbox"
            checked={settingsStore.value.dealAnimation}
            onchange={(e) =>
              settingsStore.set((c) => ({ ...c, dealAnimation: e.currentTarget.checked }))}
          />
          Animer la distribution des cartes (3s au début de chaque donne)
        </label>
      </div>
    </section>

    <section>
      <h3>Disposition du pli</h3>
      <div class="layout-choice">
        <label>
          <input
            type="radio"
            name="trick-layout"
            checked={settingsStore.value.trickLayout === 'cross'}
            onchange={() => settingsStore.set((c) => ({ ...c, trickLayout: 'cross' }))}
          />
          En croix (Nord en haut, Sud en bas, Ouest à gauche, Est à droite)
        </label>
        <label>
          <input
            type="radio"
            name="trick-layout"
            checked={settingsStore.value.trickLayout === 'inline'}
            onchange={() => settingsStore.set((c) => ({ ...c, trickLayout: 'inline' }))}
          />
          En ligne (ordre chronologique)
        </label>
      </div>
    </section>

    <footer class="actions">
      <button onclick={() => settingsStore.reset()}>Réinitialiser</button>
      <button class="primary" onclick={onApply}>Appliquer & nouvelle partie</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .panel {
    background: #0f172a;
    color: white;
    padding: 18px 22px;
    border-radius: 10px;
    max-width: 540px;
    width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  h2 {
    font-size: 20px;
    font-weight: 700;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 12px 0 6px;
    color: #fcd34d;
  }
  section {
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid #1e293b;
  }
  .hint {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 6px;
  }
  .seats {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .seat-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .seat-row label {
    min-width: 110px;
  }
  .pace {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pace button {
    background: #1e293b;
    color: white;
    border: 1px solid #334155;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    text-align: center;
  }
  .pace button.active {
    background: #f59e0b;
    color: black;
    border-color: #f59e0b;
  }
  .layout-choice {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }
  .custom {
    display: block;
    margin-top: 8px;
    font-size: 12px;
  }
  .custom input {
    width: 100%;
  }
  .close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 22px;
    cursor: pointer;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
  .actions button {
    background: #1e293b;
    color: white;
    border: 1px solid #334155;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  .actions button.primary {
    background: #f59e0b;
    color: black;
    border-color: #f59e0b;
    font-weight: 700;
  }
  select,
  input[type='number'] {
    background: #1e293b;
    color: white;
    border: 1px solid #334155;
    padding: 4px 6px;
    border-radius: 4px;
  }
</style>

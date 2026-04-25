<script lang="ts">
  import { debugStore } from '../../stores/debug.store.svelte';

  function fmt(v: unknown): string {
    if (typeof v === 'number') return v.toFixed(1);
    if (Array.isArray(v)) return v.map((x) => JSON.stringify(x)).join(', ');
    return String(v);
  }
</script>

{#if debugStore.visible}
  <aside class="debug-panel">
    <header>
      <strong>Pensées des IA</strong>
      <div class="actions">
        <label><input type="checkbox" checked={debugStore.revealHands} onchange={(e) => debugStore.setRevealHands(e.currentTarget.checked)} /> Voir mains</label>
        <button onclick={() => debugStore.clear()}>Effacer</button>
        <button onclick={() => debugStore.toggle()}>Fermer</button>
      </div>
    </header>
    <ol class="entries">
      <li class="meta">{debugStore.entries.length} décisions enregistrées</li>
      {#each [...debugStore.entries].reverse() as e, idx (idx + '-' + e.ts + '-' + e.seat)}
        <li>
          <div class="head">
            <span class="seat">{e.seat}</span>
            <span class="kind">{e.kind}</span>
            {#if e.card}<span class="card">{e.card.rank}{e.card.suit}</span>{/if}
            {#if e.bid}<span class="card">{e.bid.kind === 'pass' ? 'pass' : 'take ' + e.bid.trump}</span>{/if}
            <span class="lvl">L{e.reasoning.level}</span>
          </div>
          {#if 'candidates' in e.reasoning && e.reasoning.candidates.length > 0}
            <ul class="cands">
              {#each e.reasoning.candidates.slice(0, 5) as c}
                {@const ext = c as { card: { rank: string; suit: string }; score: number; rationale: string; expectedScore?: number; stdev?: number; winRateInWorlds?: number }}
                <li>
                  <strong>{ext.card.rank}{ext.card.suit}</strong>
                  <span>score={fmt(ext.score)}</span>
                  {#if ext.expectedScore !== undefined}
                    <span>E={fmt(ext.expectedScore)} σ={fmt(ext.stdev ?? 0)} win={((ext.winRateInWorlds ?? 0) * 100).toFixed(0)}%</span>
                  {/if}
                  <em>{ext.rationale}</em>
                </li>
              {/each}
            </ul>
          {/if}
          {#if 'explanation' in e.reasoning}
            <div class="explain">{e.reasoning.explanation}</div>
          {/if}
          {#if 'conventionsApplied' in e.reasoning && e.reasoning.conventionsApplied.length > 0}
            <div class="conv">{e.reasoning.conventionsApplied.join(' · ')}</div>
          {/if}
          {#if 'worldsUsed' in e.reasoning}
            <div class="worlds">Mondes : {e.reasoning.worldsUsed} · {e.reasoning.worldsBudgetMs.used}ms / {e.reasoning.worldsBudgetMs.budget}ms</div>
          {/if}
        </li>
      {/each}
    </ol>
  </aside>
{/if}

<style>
  .debug-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 380px;
    height: 100vh;
    background: rgba(15, 23, 42, 0.97);
    color: white;
    overflow-y: auto;
    padding: 12px;
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.5);
    font-size: 12px;
    z-index: 50;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .actions label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .actions button {
    background: #334155;
    color: white;
    border: 1px solid #475569;
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
    font-size: 11px;
  }
  .entries {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .entries > li {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 6px;
    padding: 6px 8px;
  }
  .entries > li.meta {
    background: transparent;
    color: #94a3b8;
    font-size: 11px;
    padding: 2px 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .seat {
    background: #1e3a8a;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 700;
  }
  .kind {
    color: #94a3b8;
    font-size: 11px;
  }
  .card {
    color: #fcd34d;
    font-weight: 600;
  }
  .lvl {
    margin-left: auto;
    font-size: 10px;
    background: #475569;
    padding: 1px 5px;
    border-radius: 3px;
  }
  .cands {
    margin: 4px 0 0;
    padding-left: 14px;
    list-style: disc;
  }
  .cands li {
    line-height: 1.3;
  }
  .cands li strong {
    color: #fcd34d;
  }
  .cands li em {
    color: #94a3b8;
    font-style: italic;
  }
  .explain {
    margin-top: 4px;
    font-style: italic;
    color: #cbd5e1;
  }
  .conv {
    margin-top: 4px;
    color: #93c5fd;
  }
  .worlds {
    margin-top: 4px;
    color: #6ee7b7;
    font-family: monospace;
    font-size: 10px;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { Card, Seat } from '@core/types';
  import { nextSeat } from '@core/types';
  import { SUIT_GLYPH, RANK_LABEL } from '@i18n/notation';

  interface Props {
    dealer: Seat;
    /** Carte retournée révélée à la fin de l'animation. */
    faceUp: Card;
    /** Durée totale de l'animation en ms. */
    durationMs?: number;
  }
  const { dealer, faceUp, durationMs = 3000 }: Props = $props();

  // Ordre antihoraire à partir du joueur à gauche du donneur (cf. core/deck.ts orderFromDealer).
  const order = $derived.by(() => {
    const out: Seat[] = [];
    let s = nextSeat(dealer);
    for (let i = 0; i < 4; i++) {
      out.push(s);
      s = nextSeat(s);
    }
    return out;
  });

  // Vraie distribution : 3 cartes à chaque siège, puis 2 cartes à chaque siège.
  // 4 sièges × 5 cartes = 20 cartes au total.
  const WAVES: readonly number[] = [3, 2];
  const TRAVEL_MS = 550;
  const FACEUP_REVEAL_MS = 600;

  // On garde ~85% de la durée pour la distribution, le reste pour révéler la retourne.
  const distributionBudget = $derived(Math.max(1200, Math.floor(durationMs * 0.85) - FACEUP_REVEAL_MS));
  const totalCards = $derived(order.length * WAVES.reduce((a, b) => a + b, 0));
  const stagger = $derived(
    Math.max(40, Math.floor((distributionBudget - TRAVEL_MS) / Math.max(1, totalCards - 1))),
  );

  // Mesuré au montage : positions finales (en px, dans le repère de l'overlay) de chaque
  // carte des 4 mains. Les .hand sont rendues par Table.svelte en visibility:hidden,
  // donc leur layout est valide même avant que les cartes soient visibles.
  let overlayEl: HTMLDivElement | undefined = $state();
  let targets: Record<Seat, { x: number; y: number }[]> | null = $state(null);
  let center: { x: number; y: number } = $state({ x: 0, y: 0 });
  // Origine des cartes distribuées : la main du donneur (il tient le talon).
  let origin: { x: number; y: number } = $state({ x: 0, y: 0 });

  const cards = $derived.by(() => {
    if (!targets) return [];
    const out: { delay: number; to: { x: number; y: number } }[] = [];
    const slotIdx: Record<Seat, number> = { N: 0, E: 0, S: 0, W: 0 };
    let i = 0;
    for (const wave of WAVES) {
      for (const seat of order) {
        for (let c = 0; c < wave; c++) {
          const slot = slotIdx[seat]++;
          const dest = targets[seat][slot] ?? targets[seat][targets[seat].length - 1] ?? center;
          out.push({ delay: i * stagger, to: dest });
          i++;
        }
      }
    }
    return out;
  });

  // Délai d'apparition de la retourne (juste après la dernière carte distribuée).
  const faceUpDelay = $derived(Math.max(0, (totalCards - 1) * stagger + TRAVEL_MS + 60));
  const faceUpColor = $derived(faceUp.suit === 'H' || faceUp.suit === 'D' ? '#dc2626' : '#0f172a');

  onMount(() => {
    if (!overlayEl) return;
    const overlayRect = overlayEl.getBoundingClientRect();
    center = { x: overlayRect.width / 2, y: overlayRect.height / 2 };
    origin = center;
    const out: Record<Seat, { x: number; y: number }[]> = { N: [], E: [], S: [], W: [] };
    for (const seat of ['N', 'E', 'S', 'W'] as Seat[]) {
      const hand = document.querySelector(`.hand[data-seat="${seat}"]`);
      if (!hand) continue;
      for (const card of Array.from(hand.querySelectorAll('.card'))) {
        const r = card.getBoundingClientRect();
        out[seat].push({
          x: r.left + r.width / 2 - overlayRect.left,
          y: r.top + r.height / 2 - overlayRect.top,
        });
      }
      if (seat === dealer) {
        const r = hand.getBoundingClientRect();
        origin = {
          x: r.left + r.width / 2 - overlayRect.left,
          y: r.top + r.height / 2 - overlayRect.top,
        };
      }
    }
    targets = out;
  });
</script>

<div class="deal-overlay" bind:this={overlayEl} aria-hidden="true">
  {#if targets}
    {#each cards as c, idx (idx)}
      <div
        class="card-back"
        style="
          --from-x: {origin.x}px;
          --from-y: {origin.y}px;
          --to-x: {c.to.x}px;
          --to-y: {c.to.y}px;
          --delay: {c.delay}ms;
          --travel: {TRAVEL_MS}ms;
        "
      ></div>
    {/each}

    <div
      class="face-up"
      style="--delay: {faceUpDelay}ms; left: {center.x}px; top: {center.y}px; color: {faceUpColor};"
    >
      <span class="rank">{RANK_LABEL[faceUp.rank]}</span>
      <span class="suit">{SUIT_GLYPH[faceUp.suit]}</span>
    </div>
  {/if}
</div>

<style>
  .deal-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 30;
    overflow: hidden;
  }
  .card-back {
    position: absolute;
    width: var(--card-w);
    height: var(--card-h);
    /* Centre la carte sur (--from-x/--to-x, --from-y/--to-y). */
    margin-left: calc(var(--card-w) / -2);
    margin-top: calc(var(--card-h) / -2);
    background: linear-gradient(135deg, #1d4ed8 25%, #1e3a8a 75%);
    border: 1.5px solid #1e3a8a;
    border-radius: 6px;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
    left: var(--from-x);
    top: var(--from-y);
    opacity: 0;
    transform: scale(0.35) rotate(0deg);
    animation: deal var(--travel) cubic-bezier(0.4, 0.1, 0.3, 1) var(--delay) forwards;
  }
  @keyframes deal {
    0% {
      left: var(--from-x);
      top: var(--from-y);
      opacity: 0;
      transform: scale(0.35) rotate(0deg);
    }
    15% {
      opacity: 1;
    }
    100% {
      left: var(--to-x);
      top: var(--to-y);
      opacity: 1;
      transform: scale(1) rotate(360deg);
    }
  }

  .face-up {
    position: absolute;
    width: var(--card-w);
    height: var(--card-h);
    margin-left: calc(var(--card-w) / -2);
    margin-top: calc(var(--card-h) / -2);
    background: white;
    border: 1.5px solid #1f2937;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Times New Roman', serif;
    font-weight: 700;
    line-height: 1;
    opacity: 0;
    transform: scale(0.4) rotateY(180deg);
    animation: reveal 500ms ease-out var(--delay) forwards;
  }
  .face-up .rank {
    font-size: var(--card-rank-fs);
    line-height: 1;
  }
  .face-up .suit {
    font-size: var(--card-suit-fs);
    line-height: 1;
    margin-top: 4px;
  }
  @keyframes reveal {
    0% {
      opacity: 0;
      transform: scale(0.4) rotateY(180deg);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotateY(0deg);
    }
  }
</style>

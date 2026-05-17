<script lang="ts">
  import type { Seat } from '@core/types';

  interface Props {
    dealer: Seat;
    /** Durée totale de l'animation en ms. */
    durationMs?: number;
  }
  const { dealer, durationMs = 3000 }: Props = $props();

  // Positions approximatives des sièges dans la table-grid (en pourcentage).
  const SEAT_POS: Record<Seat, { x: number; y: number }> = {
    N: { x: 50, y: 10 },
    S: { x: 50, y: 90 },
    W: { x: 10, y: 50 },
    E: { x: 90, y: 50 },
  };

  const SEATS: readonly Seat[] = ['N', 'E', 'S', 'W'];
  const targets = $derived(SEATS.filter((s) => s !== dealer));
  const dealerPos = $derived(SEAT_POS[dealer]);

  const CARDS_PER_TARGET = 5;
  const TRAVEL_MS = 600;
  // On répartit les départs sur ~70% de la durée pour laisser une légère pause finale.
  const stagger = $derived.by(() => {
    const totalCards = targets.length * CARDS_PER_TARGET;
    return Math.max(40, Math.floor((durationMs * 0.7 - TRAVEL_MS) / Math.max(1, totalCards - 1)));
  });

  // Ordre d'envoi : on alterne les destinataires (1 carte chacun, puis 1 carte chacun…)
  // pour symboliser une distribution réelle.
  const cards = $derived.by(() => {
    const out: { target: Seat; delay: number }[] = [];
    let i = 0;
    for (let round = 0; round < CARDS_PER_TARGET; round++) {
      for (const t of targets) {
        out.push({ target: t, delay: i * stagger });
        i++;
      }
    }
    return out;
  });
</script>

<div class="deal-overlay" aria-hidden="true">
  {#each cards as c, idx (idx)}
    <div
      class="card-back"
      style="
        --from-x: {dealerPos.x}%;
        --from-y: {dealerPos.y}%;
        --to-x: {SEAT_POS[c.target].x}%;
        --to-y: {SEAT_POS[c.target].y}%;
        --delay: {c.delay}ms;
        --travel: {TRAVEL_MS}ms;
      "
    ></div>
  {/each}
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
    width: 28px;
    height: 40px;
    margin-left: -14px;
    margin-top: -20px;
    background: repeating-linear-gradient(
        45deg,
        #1e3a8a 0 4px,
        #1e40af 4px 8px
      );
    border: 1.5px solid #fcd34d;
    border-radius: 4px;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
    left: var(--from-x);
    top: var(--from-y);
    opacity: 0;
    transform: scale(0.5) rotate(0deg);
    animation: deal var(--travel) cubic-bezier(0.4, 0.1, 0.3, 1) var(--delay) forwards;
  }
  @keyframes deal {
    0% {
      left: var(--from-x);
      top: var(--from-y);
      opacity: 0;
      transform: scale(0.5) rotate(0deg);
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
</style>

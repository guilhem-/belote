<script lang="ts">
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

  // Positions approximatives des sièges dans la table-grid (en pourcentage).
  const SEAT_POS: Record<Seat, { x: number; y: number }> = {
    N: { x: 50, y: 12 },
    S: { x: 50, y: 88 },
    W: { x: 12, y: 50 },
    E: { x: 88, y: 50 },
  };
  const CENTER = { x: 50, y: 50 };

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

  const cards = $derived.by(() => {
    const out: { target: Seat; delay: number }[] = [];
    let i = 0;
    for (const wave of WAVES) {
      for (const seat of order) {
        for (let c = 0; c < wave; c++) {
          out.push({ target: seat, delay: i * stagger });
          i++;
        }
      }
    }
    return out;
  });

  // Délai d'apparition de la retourne (juste après la dernière carte distribuée).
  const faceUpDelay = $derived(Math.max(0, (totalCards - 1) * stagger + TRAVEL_MS + 60));
  const faceUpColor = $derived(faceUp.suit === 'H' || faceUp.suit === 'D' ? '#dc2626' : '#0f172a');
</script>

<div class="deal-overlay" aria-hidden="true">
  {#each cards as c, idx (idx)}
    <div
      class="card-back"
      style="
        --from-x: {CENTER.x}%;
        --from-y: {CENTER.y}%;
        --to-x: {SEAT_POS[c.target].x}%;
        --to-y: {SEAT_POS[c.target].y}%;
        --delay: {c.delay}ms;
        --travel: {TRAVEL_MS}ms;
      "
    ></div>
  {/each}

  <div
    class="face-up"
    style="--delay: {faceUpDelay}ms; color: {faceUpColor};"
  >
    <span class="rank">{RANK_LABEL[faceUp.rank]}</span>
    <span class="suit">{SUIT_GLYPH[faceUp.suit]}</span>
  </div>
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
    width: 26px;
    height: 38px;
    margin-left: -13px;
    margin-top: -19px;
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

  .face-up {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 44px;
    height: 60px;
    margin-left: -22px;
    margin-top: -30px;
    background: white;
    border: 1.5px solid #fcd34d;
    border-radius: 5px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-weight: 800;
    opacity: 0;
    transform: scale(0.4) rotateY(180deg);
    animation: reveal 500ms ease-out var(--delay) forwards;
  }
  .face-up .rank {
    font-size: 14px;
    line-height: 1;
  }
  .face-up .suit {
    font-size: 18px;
    line-height: 1;
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

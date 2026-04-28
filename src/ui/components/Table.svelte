<script lang="ts">
  import type { Bid, Card, DealState, Seat, Suit, Trick as TrickType } from '@core/types';
  import { legalMoves } from '@core/rules/legal-moves';
  import { expectedToPlay } from '@core/game-state';
  import { SEAT_SHORT, SUIT_GLYPH } from '@i18n/notation';
  import Hand from './Hand.svelte';
  import Trick from './Trick.svelte';
  import BidPanel from './BidPanel.svelte';
  import TricksRecap from './TricksRecap.svelte';

  interface Props {
    deal: DealState;
    /** Pli figé à afficher (override) pendant la pause "voir le pli". */
    displayedTrick?: TrickType | null;
    /** Sièges contrôlés par un humain (donc cartes visibles + interactives). */
    humanSeats: readonly Seat[];
    /** Sièges dont les cartes sont visibles (debug). N'autorise PAS l'interaction. */
    revealedSeats: readonly Seat[];
    /** Disposition des cartes du pli. */
    trickLayout?: 'cross' | 'inline';
    /** Carte pré-sélectionnée par l'humain (highlight) — destinée à être jouée à son tour. */
    pendingCard?: { seat: Seat; card: Card } | null;
    onBid: (seat: Seat, bid: Bid) => void;
    onPlay: (seat: Seat, card: Card) => void;
    onPreselect?: (seat: Seat, card: Card) => void;
  }

  const {
    deal,
    displayedTrick = null,
    humanSeats,
    revealedSeats,
    trickLayout = 'cross',
    pendingCard = null,
    onBid,
    onPlay,
    onPreselect,
  }: Props = $props();

  const phase = $derived(deal.phase);
  const trump: Suit | null = $derived(phase.kind === 'playing' ? phase.trump : null);
  const acting = $derived.by(() => {
    if (phase.kind === 'bidding') return phase.phase.toAct;
    if (phase.kind === 'playing') return expectedToPlay(phase.current);
    return null;
  });

  const legalForActing = $derived.by(() => {
    if (phase.kind !== 'playing' || !acting) return [];
    return legalMoves(deal.hands[acting], phase.current, phase.trump, acting);
  });

  function isHuman(s: Seat): boolean {
    return humanSeats.includes(s);
  }
  function isRevealed(s: Seat): boolean {
    return humanSeats.includes(s) || revealedSeats.includes(s);
  }
  function isActing(s: Seat): boolean {
    return acting === s;
  }
  function pendingFor(s: Seat): Card | null {
    return pendingCard && pendingCard.seat === s ? pendingCard.card : null;
  }
  function pre(s: Seat): boolean {
    // Permet le pré-clic seulement quand : siège humain, phase playing, ce n'est PAS son tour
    return isHuman(s) && phase.kind === 'playing' && !isActing(s);
  }
</script>

<div class="table-grid">
  <div class="seat seat-N" class:active={isActing('N')}>
    <div class="badge">{SEAT_SHORT.N}</div>
    {#if isActing('N')}<div class="active-marker top">▼</div>{/if}
    <Hand
      cards={deal.hands.N}
      seat="N"
      facedown={!isRevealed('N')}
      legalCards={acting === 'N' ? legalForActing : undefined}
      canPlay={phase.kind === 'playing' && acting === 'N' && isHuman('N')}
      canPreselect={pre('N')}
      pendingCard={pendingFor('N')}
      {trump}
      onPlay={(c) => onPlay('N', c)}
      onPreselect={(c) => onPreselect?.('N', c)}
    />
  </div>
  <div class="seat seat-W" class:active={isActing('W')}>
    <div class="badge">{SEAT_SHORT.W}</div>
    {#if isActing('W')}<div class="active-marker right">▶</div>{/if}
    <Hand
      cards={deal.hands.W}
      seat="W"
      facedown={!isRevealed('W')}
      legalCards={acting === 'W' ? legalForActing : undefined}
      canPlay={phase.kind === 'playing' && acting === 'W' && isHuman('W')}
      canPreselect={pre('W')}
      pendingCard={pendingFor('W')}
      {trump}
      onPlay={(c) => onPlay('W', c)}
      onPreselect={(c) => onPreselect?.('W', c)}
    />
  </div>

  <div class="center">
    {#if phase.kind === 'bidding'}
      <BidPanel
        phase={phase.phase}
        interactive={isHuman(phase.phase.toAct)}
        onBid={(b) => onBid(phase.phase.toAct, b)}
      />
    {:else if phase.kind === 'playing' || displayedTrick}
      {@const trumpEff = phase.kind === 'playing' ? phase.trump : phase.result.trump}
      {@const takerEff = phase.kind === 'playing' ? phase.taker : phase.result.taker}
      {@const tricksEff = phase.kind === 'playing' ? phase.tricks : phase.result.tricks}
      {@const currentEff = phase.kind === 'playing'
        ? phase.current
        : { leader: takerEff, cards: [] as readonly { seat: Seat; card: Card }[] }}
      <div class="trump-indic">
        Atout : <strong>{SUIT_GLYPH[trumpEff]}</strong> · Preneur :
        <strong>{SEAT_SHORT[takerEff]}</strong>
      </div>
      <Trick trick={displayedTrick ?? currentEff} layout={trickLayout} />
      <TricksRecap tricks={tricksEff} trump={trumpEff} />
    {:else}
      <div class="result-box">
        <h3>Donne terminée</h3>
        <div>NS : {phase.result.nsScore} · EO : {phase.result.ewScore}</div>
        {#if phase.result.dedans}<div>Dedans !</div>{/if}
        {#if phase.result.capot}<div>Capot {phase.result.capot}</div>{/if}
        <TricksRecap tricks={phase.result.tricks} trump={phase.result.trump} />
      </div>
    {/if}
  </div>

  <div class="seat seat-E" class:active={isActing('E')}>
    <div class="badge">{SEAT_SHORT.E}</div>
    {#if isActing('E')}<div class="active-marker left">◀</div>{/if}
    <Hand
      cards={deal.hands.E}
      seat="E"
      facedown={!isRevealed('E')}
      legalCards={acting === 'E' ? legalForActing : undefined}
      canPlay={phase.kind === 'playing' && acting === 'E' && isHuman('E')}
      canPreselect={pre('E')}
      pendingCard={pendingFor('E')}
      {trump}
      onPlay={(c) => onPlay('E', c)}
      onPreselect={(c) => onPreselect?.('E', c)}
    />
  </div>
  <div class="seat seat-S" class:active={isActing('S')}>
    <div class="badge">{SEAT_SHORT.S}</div>
    {#if isActing('S')}<div class="active-marker bottom">▲</div>{/if}
    <Hand
      cards={deal.hands.S}
      seat="S"
      facedown={!isRevealed('S')}
      legalCards={acting === 'S' ? legalForActing : undefined}
      canPlay={phase.kind === 'playing' && acting === 'S' && isHuman('S')}
      canPreselect={pre('S')}
      pendingCard={pendingFor('S')}
      {trump}
      onPlay={(c) => onPlay('S', c)}
      onPreselect={(c) => onPreselect?.('S', c)}
    />
  </div>
</div>

<style>
  .table-grid {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    grid-template-rows: auto 1fr auto;
    gap: 8px;
    padding: 8px;
    background: radial-gradient(ellipse at center, #0b6b3a 0%, #08502b 80%);
    border-radius: 12px;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }
  .seat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .seat-N {
    grid-column: 2;
    grid-row: 1;
  }
  .seat-S {
    grid-column: 2;
    grid-row: 3;
  }
  .seat-W {
    grid-column: 1;
    grid-row: 2;
  }
  .seat-E {
    grid-column: 3;
    grid-row: 2;
  }
  .center {
    grid-column: 2;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
  }
  .badge {
    background: rgba(0, 0, 0, 0.35);
    border-radius: 9999px;
    padding: 2px 10px;
    font-weight: 700;
  }
  .seat.active .badge {
    background: #f59e0b;
    color: black;
    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.4);
  }
  .active-marker {
    color: #f59e0b;
    font-size: 22px;
    line-height: 1;
    text-shadow: 0 0 6px rgba(251, 191, 36, 0.7);
    animation: pulse 1.4s ease-in-out infinite;
    pointer-events: none;
  }
  .active-marker.top {
    margin-top: 2px;
  }
  .active-marker.bottom {
    margin-bottom: 2px;
    order: -1;
  }
  .active-marker.left {
    margin-right: 4px;
  }
  .active-marker.right {
    margin-left: 4px;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.85; }
    50% { transform: scale(1.2); opacity: 1; }
  }
  .trump-indic {
    background: rgba(0, 0, 0, 0.4);
    padding: 4px 12px;
    border-radius: 6px;
  }
  .result-box {
    background: rgba(0, 0, 0, 0.5);
    padding: 12px 18px;
    border-radius: 8px;
    text-align: center;
  }
</style>

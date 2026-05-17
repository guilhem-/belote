<script lang="ts">
  import type { Seat } from '@core/types';
  import { SEAT_FULL } from '@i18n/notation';

  interface Props {
    banner: { kind: 'belote' | 'rebelote'; seat: Seat } | null;
  }
  const { banner }: Props = $props();
</script>

{#if banner}
  {#key `${banner.kind}-${banner.seat}-${Date.now()}`}
    <div class="banner" role="status" aria-live="polite">
      <div class="word">{banner.kind === 'belote' ? 'Belote !' : 'Rebelote !'}</div>
      <div class="sub">par {SEAT_FULL[banner.seat]}</div>
    </div>
  {/key}
{/if}

<style>
  .banner {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: black;
    padding: 18px 36px;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    z-index: 150;
    text-align: center;
    pointer-events: none;
    animation: pop 1.8s ease-out forwards;
  }
  .word {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-shadow: 0 2px 0 rgba(255, 255, 255, 0.3);
  }
  .sub {
    font-size: 14px;
    margin-top: 2px;
    opacity: 0.85;
  }
  @keyframes pop {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
    15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
    25% { transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
  }
</style>

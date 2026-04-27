<script lang="ts">
  // Animation de confettis CSS pure. Active=true → rendu, sinon rien.
  interface Props {
    active: boolean;
  }
  const { active }: Props = $props();

  // 80 particules avec positions/couleurs/délais déterministes (pas besoin de RNG).
  const PARTICLES = Array.from({ length: 80 }, (_, i) => ({
    left: (i * 17 + 13) % 100,
    delay: ((i * 53) % 1500) / 1000,
    duration: 2.6 + ((i * 31) % 12) / 10,
    drift: ((i * 41) % 200) - 100,
    rotation: (i * 73) % 360,
    color: ['#f43f5e', '#3b82f6', '#facc15', '#10b981', '#a855f7', '#fb923c'][i % 6],
    size: 6 + (i % 4) * 3,
  }));
</script>

{#if active}
  <div class="overlay" aria-hidden="true">
    {#each PARTICLES as p, i (i)}
      <span
        class="confetti"
        style="left:{p.left}%; animation-delay:{p.delay}s; animation-duration:{p.duration}s;
               --drift:{p.drift}px; --rot:{p.rotation}deg; background:{p.color};
               width:{p.size}px; height:{p.size * 1.4}px;"
      ></span>
    {/each}
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 200;
  }
  .confetti {
    position: absolute;
    top: -20px;
    border-radius: 1px;
    transform: rotate(0deg);
    animation-name: fall;
    animation-timing-function: ease-out;
    animation-fill-mode: forwards;
    animation-iteration-count: infinite;
  }
  @keyframes fall {
    0% {
      transform: translate(0, 0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translate(var(--drift), 110vh) rotate(var(--rot));
      opacity: 0.9;
    }
  }
</style>

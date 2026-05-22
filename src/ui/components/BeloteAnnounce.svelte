<script lang="ts">
  interface Props {
    /** Type d'annonce. Le siège est implicite : le composant est rendu à côté
     *  du badge du siège concerné (voir Table.svelte). */
    kind: 'belote' | 'rebelote';
  }
  const { kind }: Props = $props();
</script>

{#key kind}
  <div class="banner" role="status" aria-live="polite">
    {kind === 'belote' ? 'Belote !' : 'Rebelote !'}
  </div>
{/key}

<style>
  .banner {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: black;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.3px;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
    pointer-events: none;
    white-space: nowrap;
    animation: pop 1.8s ease-out forwards;
  }
  @keyframes pop {
    0% { opacity: 0; transform: scale(0.6); }
    15% { opacity: 1; transform: scale(1.15); }
    25% { transform: scale(1); }
    80% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.95); }
  }
</style>

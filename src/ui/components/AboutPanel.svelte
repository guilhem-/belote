<script lang="ts">
  interface Props {
    onClose: () => void;
  }
  const { onClose }: Props = $props();
</script>

<div class="overlay" role="dialog" aria-label="À propos">
  <div class="panel">
    <header>
      <h2>À propos · stratégies par niveau d'IA</h2>
      <button class="close" onclick={onClose} aria-label="Fermer">×</button>
    </header>

    <section>
      <h3>Variante de Belote</h3>
      <p>
        Belote classique française avec retourne (FFB). Distribution 3-2-3, capot à 100 points,
        dedans à 82, Belote/Rebelote 20 points, dix de der. Voir
        <code>docs/rules-conventions.md</code> pour le détail.
      </p>
    </section>

    <section>
      <h3>Niveau 1 — Aléatoire pondéré</h3>
      <ul>
        <li><strong>Aucune mémoire</strong> : ne suit pas l'historique.</li>
        <li>Enchères : prend ~25% du temps si une prise est possible.</li>
        <li>Jeu : choisit uniformément parmi les coups légaux.</li>
      </ul>
    </section>

    <section>
      <h3>Niveau 2 — Heuristique locale</h3>
      <ul>
        <li><strong>Évaluation force de main</strong> pour décider de prendre (seuil 50 / 60 selon tour).</li>
        <li><strong>Si je gagnerai le pli</strong> : joue la carte la plus basse qui suffit (+50 bonus, -force).</li>
        <li><strong>Si partenaire est maître</strong> : donne du gras (As, 10) ; garde V/9 d'atout.</li>
        <li><strong>Sinon</strong> : minimise la perte (préfère carte sans points, économise les atouts).</li>
        <li>Annonce automatique de Belote/Rebelote.</li>
      </ul>
    </section>

    <section>
      <h3>Niveau 3 — Comptage + conventions d'émission</h3>
      <ul>
        <li>Toutes les heuristiques du niveau 2.</li>
        <li><strong>Card-tracker</strong> : suit toutes les cartes vues, déduit les voids par siège.</li>
        <li>
          <strong>Appel à l'as</strong> : entame préférentiellement un As hors-atout pour signaler
          au partenaire (+14 score).
        </li>
        <li>
          <strong>Tire atout long</strong> : si j'ai ≥ 4 atouts, j'entame atout pour vider la
          défense.
        </li>
        <li>
          <strong>Évite atout court</strong> : pas d'entame atout si je n'en ai que 1-2.
        </li>
        <li>
          <strong>Donner les points au partenaire</strong> : signal de longueur via 10/As quand
          partenaire maître (+10).
        </li>
      </ul>
    </section>

    <section>
      <h3>Niveau 4 — Inférence déductive</h3>
      <ul>
        <li>Toutes les heuristiques du niveau 3, plus :</li>
        <li>
          <strong>Comptage des atouts adverses</strong> restants pour décider de tirer ou non.
        </li>
        <li>
          <strong>Lecture des voids</strong> : si un adversaire est connu void d'une couleur,
          j'évite d'y entamer mon As (sinon il coupe).
        </li>
        <li>
          <strong>Tire V atout maître</strong> : si j'ai le V atout + ≥ 4 atouts + adversaires en
          ont encore (+30).
        </li>
        <li>
          <strong>Capture sécurisée</strong> : bonus si je suis dernier à parler et le pli est
          gros (+8).
        </li>
        <li>
          <strong>Conserve mes appuis</strong> : pénalité si je sacrifie un As/10 hors-atout sous
          le maître (-10).
        </li>
      </ul>
    </section>

    <section>
      <h3>Niveau 5 — PIMC (Perfect-Information Monte-Carlo)</h3>
      <ul>
        <li>
          <strong>Base level4</strong> : décision baseline garantie via les heuristiques du
          niveau 4.
        </li>
        <li>
          <strong>Belief state</strong> : pour chaque carte non-vue, suit l'ensemble des sièges où
          elle peut être (mis à jour via défausses observées).
        </li>
        <li>
          <strong>Shortlist</strong> : ne PIMC que si plusieurs candidats level4 sont à ≤ 12
          points d'écart (sinon le coup level4 est joué directement).
        </li>
        <li>
          <strong>Sampling</strong> : tire 6-50 mondes compatibles avec le belief, dans un budget
          de 1500 ms.
        </li>
        <li>
          <strong>Solver alpha-beta</strong> : sur chaque monde, recherche la meilleure suite
          jusqu'à la fin de la donne avec coupures alpha-beta réelles + transposition table.
          Score de donne final (incluant capot, dedans, belote) — pas seulement points cartes.
        </li>
        <li>
          <strong>Aggregation</strong> : choisit la carte de meilleure espérance sur les mondes
          (avec écart-type et taux de victoire ≥ 82).
        </li>
        <li>
          <strong>Fallback</strong> : si moins de 4 mondes ont pu être évalués (budget temps), on
          retombe sur la décision level4.
        </li>
      </ul>
    </section>

    <footer>
      <button class="primary" onclick={onClose}>Fermer</button>
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
    max-width: 720px;
    width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    position: sticky;
    top: 0;
    background: #0f172a;
    padding-bottom: 6px;
  }
  h2 {
    font-size: 18px;
    font-weight: 700;
  }
  h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 12px 0 6px;
    color: #fcd34d;
  }
  section {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #1e293b;
  }
  ul {
    margin: 6px 0 0 18px;
    list-style: disc;
    font-size: 13px;
    line-height: 1.5;
  }
  ul li {
    margin: 2px 0;
  }
  p {
    font-size: 13px;
    line-height: 1.5;
    margin: 4px 0;
  }
  code {
    background: rgba(255, 255, 255, 0.08);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 22px;
    cursor: pointer;
  }
  footer {
    text-align: right;
    margin-top: 8px;
  }
  footer button.primary {
    background: #f59e0b;
    color: black;
    border: 1px solid #f59e0b;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 700;
  }
</style>

# Belote — guide pour les itérations futures

Ce fichier sert de contexte pour reprendre le projet rapidement. Conventions importantes,
points de friction, choix d'archi qui ne se devinent pas en lisant le code.

## Stack

- TypeScript strict + Vite + Svelte 5 (runes), Tailwind 4
- Vitest + fast-check pour les tests unitaires
- Playwright pour les e2e (dossier `e2e/`)
- Comlink pour les Web Workers IA (niveaux 4-5 en worker)
- Zod pour la persistance localStorage (versionnée v1)
- RNG seedé Mulberry32 pour reproductibilité

## Structure

- `src/core/` règles pures, sans UI, sans Worker. **Cible 100% testée.**
- `src/ai/` interface `AIPlayer` + niveaux 1-5
- `src/ai/level5-pimc/` belief / sampler / solver alpha-beta
- `src/workers/` ai.worker.ts (exposé via Comlink) + ai.client.ts (wrapper main thread)
- `src/ui/` composants Svelte + stores
- `src/ui/stores/*.svelte.ts` **doivent avoir l'extension `.svelte.ts`** (rune `$state`)
- `src/persistence/` schema Zod + load/save localStorage
- `src/i18n/notation.ts` mapping interne→FR (W→O, J→V, Q→D, K→R, ♥♦♣♠)
- `docs/rules-conventions.md` règles Belote FFB figées (source de vérité unique)
- `scripts/tournament.ts` — tournoi générique CLI
- `scripts/compare-strategies.ts` — variantes level4 vs baseline
- `scripts/level5-vs-level4.ts` — PIMC vs heuristique

## Conventions code

- Types internes inchangés : `Seat = N|E|S|W`, `Suit = H|D|C|S`, `Rank = J|Q|K|A`...
- L'**affichage** utilise `i18n/notation.ts` (W→O, EW→EO, V/D/R, glyphes ♥♦♣♠)
- Vérifier après chaque modif UI : `grep -rn "EW" src/ui` doit ne rien retourner
- Stores Svelte 5 = pattern `let value = $state(...)` + getters dans l'objet retourné
- Les objets `$state` sont des Proxy → **non clonables par `structuredClone`**
  → toujours passer par `JSON.parse(JSON.stringify(...))` avant Worker (cf `ai.client.ts`)
- IA workers : niveaux ≥ 4 vont en worker (`useWorkerForLevel(level)`)

## Règles Belote figées

Cf `docs/rules-conventions.md` (source unique de vérité). Points-clés :

- Distribution **3-2-3** (jamais 3-3-2)
- Capot = **+100 bonus** (pas 90)
- Sur-coupe **non** obligatoire si partenaire maître
- Seuil dedans = **strict ≥ 82** (égalité → dedans)
- Annonces v1 : Belote/Rebelote uniquement (tierces/carrés non implémentés)
- Rotation donneur **antihoraire** : N → W → S → E → N

## Niveaux d'IA — résumés

| Niveau | Mémoire | Décision |
|---|---|---|
| 1 | aucune | random pondéré (25% take, choix uniforme jeu) |
| 2 | aucune | heuristique locale (force main pour bid, scoring carte au pli) |
| 3 | card-tracker | + conventions émission (appel à l'as, donner les points) |
| 4 | tracker + voids | + comptage atouts adverses, lecture voids, tire V |
| 5 | belief proba | level4 baseline + PIMC sur ties (shortlist top 3 à ≤ 12 d'écart) |

**Niveau 5** : alpha-beta véritable avec coupures, transposition table, score de
donne complet (capot/dedans/belote inclus dans l'éval finale). Budget par défaut
1500 ms / décision. Fallback dur level4 si < 4 mondes évalués.

Tournois (rapides, sans worker) :
- level5 vs level4 sur 100 parties (budget 200 ms) : ~53% (IC ±10)
- level5 vs level4 sur 100 parties (budget 400 ms) : 53% mais +9.6 pts/partie (vs +4.4)
- Aucune convention level4-improved (F1-F6) ne dépasse 51% sur 1000 parties

## Coach (option `coachWarnings`)

- Décoché par défaut. Crée un AI level4 par siège humain qui observe **les mêmes events**
  que l'humain (pas de triche).
- Évalue chaque enchère et chaque coup humain. Si écart > 25 pts (jeu) ou si le bid diffère
  (enchère), émet un warning avec explication contextuelle.
- Code dans `src/ui/coach.ts` (logique) + `coach.store.svelte.ts` (state) + `CoachToast.svelte` (UI)

## Pièges connus

### `RedealRequired` / boucle infinie
Quand tous passent 2 tours, `apply` lève `RedealRequired`. Avant fix : `nextDeal()` réutilisait
le même `dealIndex` → même seed → même deck → boucle. **Fix actuel** dans
`match.store.svelte.ts.redealNow()` : compteur `redealAttempt` mixé dans `deriveDealSeed`,
rotation manuelle du donneur. Reset à 0 dans `onDealEnd`.

### Worker `DataCloneError`
`postMessage` ne peut pas cloner les Proxy `$state`. **Toujours** sérialiser via
`JSON.parse(JSON.stringify(...))` avant d'envoyer au worker (cf `ai.client.ts.toPlain`).

### Belote/Rebelote drift
Quand un wrapper (level5) ignore la décision d'un fallback (level4) qui voulait annoncer,
le flag `beloteAnnouncedByMe` interne au level4 drift. **Fix actuel** : tous les niveaux
synchronisent `beloteAnnouncedByMe` via `observe('belote-announce')`, jamais via leur
propre décision.

### 8ᵉ pli pas affiché
Quand le 8ᵉ et dernier pli est complété, la phase passe directement à `'scored'`. La
condition de rendu doit donc inclure `displayedTrick` non nul, sinon l'UI passe au
`result-box` avant la pause UI. Cf `Table.svelte` :
```svelte
{:else if phase.kind === 'playing' || displayedTrick}
```

### Hauteur d'écran
`.screen` a `max-height: 100vh, overflow: hidden`. Tout ajout de contenu doit respecter
cette contrainte. `.table-grid` est en `flex 1, height 100%`.

## UI features importantes

- **Indicateur joueur actif** : badge orange + flèche clignotante (▼/▲/◀/▶) sous le siège
- **Pré-clic** : humain peut cliquer une carte hors tour → stockée dans
  `state.pendingHumanCard`, jouée à son tour si encore légale
- **Tri main** : par couleur (atout d'abord, puis ♥ ♣ ♦ ♠), force décroissante
- **Disposition pli** : "cross" (géographique) ou "inline" (chronologique), via Settings
- **Cadence** : `paceMs` pour le pli (défaut 4 s), `bidPaceMs` pour les enchères (défaut 1 s)
- **Confettis** : déclenchés quand match terminé et équipe gagnante contient un humain
- **Seed copier/charger** : icônes 📋 / 📥 dans le footer ; seed du *match* (reproductible)
- **Auto-play dernière carte** + **auto-next-deal** : cochés par défaut

## Déploiement

GitHub Pages via workflow `.github/workflows/deploy-pages.yml`. URL :
**https://guilhem-.github.io/belote/**

Vite : `base = '/belote/'` quand `GITHUB_ACTIONS=1`, sinon `'/'`.

Push sur `main` → déploiement auto.

## Commandes utiles

```bash
npm run dev              # serveur dev local
npm test                 # vitest unitaires
npm run e2e              # playwright e2e (auto-démarre le dev server)
npm run typecheck        # svelte-check + tsc scripts
npm run lint             # eslint --max-warnings 0
npm run build            # build prod (dist/)
npm run ci               # lint + typecheck + test + build
npm run tournament -- --teamA 5 --teamB 4 --games 100   # tournoi générique
npx tsx scripts/level5-vs-level4.ts --games 100 --budget 200
npx tsx scripts/compare-strategies.ts --games 1000 --seed 0xCAFE
```

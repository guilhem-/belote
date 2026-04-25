# Belote

Jeu de Belote dans le navigateur, sans backend. 0 ou 1 joueur humain, 3 ou 4 IA paramétrables (niveaux 1-5).

## Stack

- TypeScript strict, Vite, Svelte 5 (runes)
- Tailwind CSS, Vitest + fast-check
- IA niveau 5 : PIMC bayésien en Web Worker
- Persistance localStorage, RNG seedé Mulberry32 pour replays déterministes

## Commandes

```bash
npm install
npm run dev          # serveur dev
npm run build        # bundle prod
npm test             # tests unitaires
npm run test:watch   # tests en watch
npm run test:coverage
npm run typecheck
npm run lint
npm run format
npm run tournament   # tournoi IA-vs-IA
npm run benchmark    # latence IA niveau 5
```

## Structure

- `src/core/` règles pures, sans UI, 100% testées
- `src/ai/` moteurs d'IA (niveaux 1-5)
- `src/ui/` composants Svelte
- `src/workers/` Web Worker IA (Comlink)
- `src/persistence/` localStorage
- `docs/rules-conventions.md` règles de Belote figées
- `scripts/tournament.ts` tournoi IA-vs-IA

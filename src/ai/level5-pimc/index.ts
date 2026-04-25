// IA niveau 5 — pour l'instant alias de level4-deductive.
//
// TODO: l'implémentation PIMC initiale (belief/sampler/solver alpha-beta) a été testée
// et dégrade le jeu vs niveau 4 (~20% vs 80% sur tournoi 10 parties). Causes identifiées :
//   1. Le solver alpha-beta ne fait pas de vraies coupures alpha-beta (juste min-max naïf
//      sans bornes propagées) → arbre 28 niveaux trop grand pour budget 500ms.
//   2. La heuristique de coupure (own + remaining * 0.5) est trop plate.
//   3. Pas de transposition table.
//   4. Belote/rebelote pas comptées dans le score solver.
// Code conservé dans belief.ts/sampler.ts/solver.ts pour itérer dessus.
//
// Le niveau 5 utilise donc le moteur level4 (comptage, conventions, déductions void),
// qui bat niveau 3 ~70%/30%. Une vraie implémentation PIMC robuste reste à faire.

import type { Seat } from '@core/types';
import type { AIConfig, AIPlayer } from '../types';
import { createLevel4AI } from '../level4-deductive';

export function createLevel5AI(seat: Seat, config: AIConfig): AIPlayer {
  return createLevel4AI(seat, { ...config, level: 4 });
}

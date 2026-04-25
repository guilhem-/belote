import type { Seat } from '@core/types';
import type { AIConfig, AIPlayer } from './types';
import { createLevel1AI } from './level1-random';
import { createLevel2AI } from './level2-heuristic';

export function createAI(seat: Seat, config: AIConfig): AIPlayer {
  switch (config.level) {
    case 1:
      return createLevel1AI(seat, config);
    case 2:
      return createLevel2AI(seat, config);
    case 3:
    case 4:
    case 5:
      // À implémenter aux étapes E (3-4) et G (5). Fallback niveau 2 en attendant.
      return createLevel2AI(seat, config);
  }
}

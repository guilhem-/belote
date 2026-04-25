import type { Seat } from '@core/types';
import type { AIConfig, AIPlayer } from './types';
import { createLevel1AI } from './level1-random';
import { createLevel2AI } from './level2-heuristic';
import { createLevel3AI } from './level3-tracker';
import { createLevel4AI } from './level4-deductive';
import { createLevel5AI } from './level5-pimc';

export function createAI(seat: Seat, config: AIConfig): AIPlayer {
  switch (config.level) {
    case 1:
      return createLevel1AI(seat, config);
    case 2:
      return createLevel2AI(seat, config);
    case 3:
      return createLevel3AI(seat, config);
    case 4:
      return createLevel4AI(seat, config);
    case 5:
      return createLevel5AI(seat, config);
  }
}

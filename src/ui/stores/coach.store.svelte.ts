// Coach : warnings affichés au joueur humain quand il fait un coup sous-optimal
// par rapport à ce qu'une IA level4 (même information que lui) recommanderait.
import type { Card, Seat } from '@core/types';

export interface CoachWarning {
  ts: number;
  seat: Seat;
  played: Card;
  recommended: Card;
  /** Différence de score level4 entre le coup recommandé et le coup joué. */
  delta: number;
  /** Rationale du coup recommandé (vient du Reasoning level4). */
  rationale: string;
  /** Explication pédagogique générée à partir du contexte. */
  explanation: string;
}

function makeStore() {
  let warnings = $state<CoachWarning[]>([]);
  let current = $state<CoachWarning | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function push(w: CoachWarning): void {
    warnings = [...warnings.slice(-19), w];
    current = w;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      current = null;
    }, 7000);
  }

  function dismiss(): void {
    current = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function clear(): void {
    warnings = [];
    current = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    get warnings(): readonly CoachWarning[] {
      return warnings;
    },
    get current(): CoachWarning | null {
      return current;
    },
    push,
    dismiss,
    clear,
  };
}

export const coachStore = makeStore();

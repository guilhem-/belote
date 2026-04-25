// Échantillonne un "monde" : assignation cohérente des cartes restantes aux 3 sièges adverses.
// Algorithme : sampling séquentiel avec backtracking si contrainte de taille violée.
import type { Card, Hands, Seat } from '@core/types';
import { SEATS, cardId } from '@core/types';
import type { Rng } from '@core/rng';
import type { BeliefState } from './belief';

export interface SampledWorld {
  hands: Hands;
}

/** Tire un monde compatible avec belief. Retourne null si échec après maxAttempts. */
export function sampleWorld(belief: BeliefState, rng: Rng, maxAttempts = 30): SampledWorld | null {
  const ownSeat = belief.getOwnSeat();
  const ownHand = belief.getOwnHand();
  const handSizes = belief.getHandSizes();
  const remaining = belief.getRemainingCards().filter((c) => !ownHand.some((o) => cardId(o) === cardId(c)));

  const opponents = SEATS.filter((s) => s !== ownSeat);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const assigned: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] };
    assigned[ownSeat] = ownHand.slice();
    const targets: Record<Seat, number> = { N: handSizes.N, E: handSizes.E, S: handSizes.S, W: handSizes.W };
    targets[ownSeat] = ownHand.length;

    // Trie les cartes par nb de placements possibles (les plus contraintes d'abord).
    const ordered = remaining
      .map((c) => ({ c, possible: [...belief.getPossibleSeats(c)].filter((s) => s !== ownSeat) }))
      .sort((a, b) => a.possible.length - b.possible.length);

    let ok = true;
    for (const { c, possible } of ordered) {
      // Filtre par capacité restante.
      const availableSeats = possible.filter((s) => assigned[s].length < targets[s]);
      if (availableSeats.length === 0) {
        ok = false;
        break;
      }
      // Tirage uniforme.
      const pick = availableSeats[Math.floor(rng.next() * availableSeats.length)]!;
      assigned[pick].push(c);
    }
    if (!ok) continue;
    // Vérifie tailles atteintes.
    let sizesOk = true;
    for (const s of opponents) {
      if (assigned[s].length !== targets[s]) {
        sizesOk = false;
        break;
      }
    }
    if (sizesOk) {
      return {
        hands: {
          N: Object.freeze(assigned.N.slice()),
          E: Object.freeze(assigned.E.slice()),
          S: Object.freeze(assigned.S.slice()),
          W: Object.freeze(assigned.W.slice()),
        },
      };
    }
  }
  return null;
}

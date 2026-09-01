/**
 * Dynamic difficulty adjustment.
 *
 * The original calls this "super basic DDA": if the player has tried a level
 * several times, quietly give them extra hit points and refuel the jetpack
 * faster in the air. Nothing is shown in the UI — the level just gets easier.
 *
 * Ported from: Original/src/com/replica/replicaisland/PlayerComponent.java
 * (adjustDifficulty)
 */

import type { DifficultyConstants } from '../stores/useGameStore';

export interface DifficultyAdjustment {
  /** Extra hit points to add to the player's starting life. */
  lifeBoost: number;
  /** Jetpack refill rate while airborne. */
  fuelAirRefillSpeed: number;
}

/**
 * Work out the boost for a level the player has attempted `attempts` times.
 *
 * `attempts` counts every start of the level, so the first play is 1.
 */
export function getDifficultyAdjustment(
  constants: DifficultyConstants,
  attempts: number
): DifficultyAdjustment {
  if (attempts >= constants.ddaStage2Attempts) {
    return {
      lifeBoost: constants.ddaStage2LifeBoost,
      fuelAirRefillSpeed: constants.ddaStage2FuelAirRefillSpeed,
    };
  }

  if (attempts >= constants.ddaStage1Attempts) {
    return {
      lifeBoost: constants.ddaStage1LifeBoost,
      fuelAirRefillSpeed: constants.ddaStage1FuelAirRefillSpeed,
    };
  }

  return { lifeBoost: 0, fuelAirRefillSpeed: constants.fuelAirRefillSpeed };
}

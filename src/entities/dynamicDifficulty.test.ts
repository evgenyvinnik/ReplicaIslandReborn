/**
 * Dynamic difficulty adjustment, which the port was missing entirely.
 *
 * The original quietly makes a level easier once the player has failed it a
 * few times: extra hit points and faster jetpack refuelling in the air. None of
 * it is surfaced in the UI, so a regression here is silent.
 *
 * Reference: Original/src/com/replica/replicaisland/PlayerComponent.java
 * (adjustDifficulty) and the three *DifficultyConstants.java files.
 */

import { describe, expect, test } from 'bun:test';
import { getDifficultyAdjustment } from './dynamicDifficulty';
import { DifficultySettings } from '../stores/useGameStore';

const KIDS = DifficultySettings.kids;
const ADULTS = DifficultySettings.adults;
const BABY = DifficultySettings.baby;

describe('dynamic difficulty adjustment', () => {
  test('a first attempt gets no boost', () => {
    const adjustment = getDifficultyAdjustment(KIDS, 1);
    expect(adjustment.lifeBoost).toBe(0);
    expect(adjustment.fuelAirRefillSpeed).toBe(KIDS.fuelAirRefillSpeed);
  });

  test('stage 1 kicks in on the configured attempt', () => {
    // Kids: DDA_STAGE_1_ATTEMPTS = 3.
    expect(getDifficultyAdjustment(KIDS, KIDS.ddaStage1Attempts - 1).lifeBoost).toBe(0);

    const stage1 = getDifficultyAdjustment(KIDS, KIDS.ddaStage1Attempts);
    expect(stage1.lifeBoost).toBe(KIDS.ddaStage1LifeBoost);
    expect(stage1.fuelAirRefillSpeed).toBe(KIDS.ddaStage1FuelAirRefillSpeed);
  });

  test('stage 2 replaces stage 1', () => {
    const stage2 = getDifficultyAdjustment(KIDS, KIDS.ddaStage2Attempts);
    expect(stage2.lifeBoost).toBe(KIDS.ddaStage2LifeBoost);
    expect(stage2.fuelAirRefillSpeed).toBe(KIDS.ddaStage2FuelAirRefillSpeed);
    expect(stage2.lifeBoost).toBeGreaterThan(KIDS.ddaStage1LifeBoost);
  });

  test('very many attempts stay at stage 2', () => {
    const adjustment = getDifficultyAdjustment(KIDS, 500);
    expect(adjustment.lifeBoost).toBe(KIDS.ddaStage2LifeBoost);
  });

  test('adults need more attempts before stage 1 than kids', () => {
    // Kids 3, Adults 4 in the original.
    expect(ADULTS.ddaStage1Attempts).toBeGreaterThan(KIDS.ddaStage1Attempts);
    expect(getDifficultyAdjustment(ADULTS, KIDS.ddaStage1Attempts).lifeBoost).toBe(0);
  });

  test('baby reaches stage 2 soonest and boosts hardest', () => {
    expect(BABY.ddaStage2Attempts).toBeLessThan(KIDS.ddaStage2Attempts);
    expect(BABY.ddaStage2LifeBoost).toBeGreaterThan(KIDS.ddaStage2LifeBoost);
  });

  test('every difficulty boosts air refuelling monotonically', () => {
    for (const [name, constants] of Object.entries(DifficultySettings)) {
      expect(constants.ddaStage1FuelAirRefillSpeed, name)
        .toBeGreaterThanOrEqual(constants.fuelAirRefillSpeed);
      expect(constants.ddaStage2FuelAirRefillSpeed, name)
        .toBeGreaterThan(constants.ddaStage1FuelAirRefillSpeed);
    }
  });
});

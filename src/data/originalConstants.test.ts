/**
 * Constants read straight out of the Java at test time and compared with the
 * port's copies.
 *
 * Most fidelity checks in this repo assert a number the porter wrote down. That
 * catches drift in the port, but not a misreading of the original - and it goes
 * stale silently if the reference copy under Original/ is ever updated. These
 * parse the Java instead, so both sides have to agree.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DifficultySettings } from '../stores/useGameStore';
import { HotSpotType } from '../engine/HotSpotSystem';

const root = join(import.meta.dir, '../..');
const java = (name: string): string =>
  readFileSync(join(root, 'Original/src/com/replica/replicaisland', name), 'utf8');

/** `private static final <type> NAME = value;` declarations. */
function constantsIn(source: string): Map<string, number> {
  const found = new Map<string, number>();
  for (const m of source.matchAll(
    /(?:private|public|protected)?\s*(?:final\s+)?static\s+(?:final\s+)?(?:float|int)\s+(\w+)\s*=\s*(-?[\d.]+)f?\s*;/g
  )) {
    found.set(m[1], Number(m[2]));
  }
  return found;
}

describe('constants read from the original', () => {
  test('difficulty settings match the three DifficultyConstants classes', () => {
    const mapping: Array<[string, keyof typeof DifficultySettings]> = [
      ['BabyDifficultyConstants.java', 'baby'],
      ['KidsDifficultyConstants.java', 'kids'],
      ['AdultsDifficultyConstants.java', 'adults'],
    ];
    // Java constant -> the port's field name.
    const fields: Array<[string, string]> = [
      ['MAX_PLAYER_LIFE', 'playerMaxLife'],
      ['COINS_PER_POWERUP', 'coinsPerPowerup'],
      ['GLOW_DURATION', 'glowDuration'],
      ['FUEL_AIR_REFILL_SPEED', 'fuelAirRefillSpeed'],
      ['FUEL_GROUND_REFILL_SPEED', 'fuelGroundRefillSpeed'],
      ['DDA_STAGE_1_ATTEMPTS', 'ddaStage1Attempts'],
      ['DDA_STAGE_2_ATTEMPTS', 'ddaStage2Attempts'],
      ['DDA_STAGE_1_LIFE_BOOST', 'ddaStage1LifeBoost'],
      ['DDA_STAGE_2_LIFE_BOOST', 'ddaStage2LifeBoost'],
      ['DDA_STAGE_1_FUEL_AIR_REFILL_SPEED', 'ddaStage1FuelAirRefillSpeed'],
      ['DDA_STAGE_2_FUEL_AIR_REFILL_SPEED', 'ddaStage2FuelAirRefillSpeed'],
    ];

    const wrong: string[] = [];
    let compared = 0;
    for (const [file, difficulty] of mapping) {
      const original = constantsIn(java(file));
      const port = DifficultySettings[difficulty] as unknown as Record<string, number>;
      for (const [javaName, portName] of fields) {
        const want = original.get(javaName);
        expect(want, `${file} has no ${javaName}`).toBeDefined();
        compared++;
        if (Math.abs(port[portName] - want!) > 1e-6) {
          wrong.push(`${difficulty}.${portName}: ${port[portName]} vs ${javaName}=${want}`);
        }
      }
    }
    expect(wrong).toEqual([]);
    expect(compared).toBe(33);
  });

  test('hot spot types match HotSpotSystem.java', () => {
    const source = java('HotSpotSystem.java');
    const original = new Map<string, number>();
    for (const m of source.matchAll(/public static final int (\w+)\s*=\s*(-?\d+);/g)) {
      original.set(m[1], Number(m[2]));
    }
    expect(original.size).toBeGreaterThan(30);

    const port = HotSpotType as unknown as Record<string, number>;
    const wrong: string[] = [];
    for (const [name, value] of original) {
      if (!(name in port)) { wrong.push(`${name} missing from the port`); continue; }
      if (port[name] !== value) wrong.push(`${name}: port ${port[name]} vs original ${value}`);
    }
    expect(wrong, 'level hot spot data would be misread').toEqual([]);
  });

  test('component constants match their Java counterparts', () => {
    const pairs: Array<[string, string, string[]]> = [
      ['PopOutComponent.java', 'src/entities/components/PopOutComponent.ts',
        ['DEFAULT_APPEAR_DISTANCE', 'DEFAULT_HIDE_DISTANCE', 'DEFAULT_ATTACK_DISTANCE']],
      ['MotionBlurComponent.java', 'src/entities/components/MotionBlurComponent.ts',
        ['STEP_COUNT', 'STEP_DELAY']],
      ['SleeperComponent.java', 'src/entities/components/SleeperComponent.ts',
        ['DEFAULT_WAKE_UP_DURATION']],
      ['TheSourceComponent.java', 'src/entities/components/TheSourceComponent.ts',
        ['SHAKE_TIME', 'DIE_TIME', 'EXPLOSION_TIME', 'SHAKE_MAGNITUDE', 'SHAKE_SCALE',
         'CAMERA_HIT_SHAKE_MAGNITUDE']],
      ['HitReactionComponent.java', 'src/entities/components/HitReactionComponent.ts',
        ['DEFAULT_BOUNCE_MAGNITUDE', 'EVENT_SEND_DELAY']],
      ['CameraSystem.java', 'src/engine/CameraSystem.ts',
        ['X_FOLLOW_DISTANCE', 'Y_UP_FOLLOW_DISTANCE', 'Y_DOWN_FOLLOW_DISTANCE',
         'MAX_INTERPOLATE_TO_TARGET_DISTANCE', 'INTERPOLATE_TO_TARGET_TIME',
         'SHAKE_FREQUENCY', 'BIAS_SPEED']],
      ['TimeSystem.java', 'src/engine/TimeSystem.ts', ['EASE_DURATION']],
    ];

    const wrong: string[] = [];
    let compared = 0;
    for (const [javaFile, tsFile, names] of pairs) {
      const original = constantsIn(java(javaFile));
      const ts = readFileSync(join(root, tsFile), 'utf8');
      for (const name of names) {
        const want = original.get(name);
        expect(want, `${javaFile} has no ${name}`).toBeDefined();
        const m = ts.match(new RegExp(`(?:const|readonly)\\s+${name}(?::\\s*number)?\\s*=\\s*(-?[\\d.]+)`));
        if (!m) { wrong.push(`${tsFile}: no ${name}`); continue; }
        compared++;
        if (Math.abs(Number(m[1]) - want!) > 1e-6) {
          wrong.push(`${name}: port ${m[1]} vs original ${want}`);
        }
      }
    }
    expect(wrong).toEqual([]);
    expect(compared).toBeGreaterThan(15);
  });
});

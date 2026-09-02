/**
 * Enemy animations carry their collision volumes per frame.
 *
 * This is what the rendering rewrite bought: the volumes ride on the frames the
 * original ships them on, instead of being selected from the object's action by
 * a separate component. A skeleton's attack volume exists only on the frames
 * where the swing lands, so it is harmless during the wind-up — behaviour the
 * action-level approximation could not express.
 */

import { describe, expect, test } from 'bun:test';
import { createEnemyAnimations, getEnemyArtSize } from './enemyAnimations';
import { EnemyAnimation } from '../entities/components/EnemyAnimationComponent';
import { HitType } from '../types';

const CONTACT_ENEMIES = ['brobot', 'bat', 'sting', 'onion', 'karaguin', 'snailbomb'];

describe('enemy animations', () => {
  test('every enemy with art gets an idle animation', () => {
    for (const subType of [...CONTACT_ENEMIES, 'skeleton', 'mudman', 'pink_namazu', 'turret']) {
      const animations = createEnemyAnimations(subType);
      expect(animations?.get(EnemyAnimation.IDLE), subType).toBeDefined();
    }
  });

  test('bosses and scripted characters are not covered here', () => {
    for (const subType of ['evil_kabocha', 'rokudou', 'the_source', 'wanda']) {
      expect(createEnemyAnimations(subType), subType).toBeNull();
    }
  });

  test('every frame names its own sprite', () => {
    const walk = createEnemyAnimations('brobot')?.get(EnemyAnimation.MOVE);
    expect(walk?.frames.map((f) => f.sprite)).toEqual([
      'brobot_walk01', 'brobot_walk02', 'brobot_walk03',
    ]);
  });

  test('a contact enemy is dangerous on its idle and walk frames', () => {
    for (const subType of CONTACT_ENEMIES) {
      const animations = createEnemyAnimations(subType)!;
      const idle = animations.get(EnemyAnimation.IDLE)!;
      const hasAttack = idle.frames.every((f) => f.attackVolumes !== null);
      expect(hasAttack, subType).toBe(true);
    }
  });

  test('a skeleton is harmless while walking and during its wind-up', () => {
    const animations = createEnemyAnimations('skeleton')!;

    // Patrolling: no attack volume at all.
    for (const frame of animations.get(EnemyAnimation.MOVE)!.frames) {
      expect(frame.attackVolumes).toBeNull();
    }

    // Swinging: the original arms only the last two of the three frames.
    const attack = animations.get(EnemyAnimation.ATTACK)!.frames;
    expect(attack[0].attackVolumes).toBeNull();
    expect(attack[1].attackVolumes).not.toBeNull();
    expect(attack[2].attackVolumes).not.toBeNull();
  });

  test('a mudman lands its crush only on the later attack frames', () => {
    const attack = createEnemyAnimations('mudman')!.get(EnemyAnimation.ATTACK)!.frames;
    const armed = attack.map((f) => f.attackVolumes !== null);
    expect(armed).toEqual([false, false, false, false, true, true, true]);
  });

  test('crushers stay invulnerable on every frame', () => {
    for (const subType of ['mudman', 'pink_namazu']) {
      const animations = createEnemyAnimations(subType)!;
      for (const [, animation] of animations) {
        for (const frame of animation.frames) {
          expect(frame.vulnerabilityVolumes, subType).toBeNull();
        }
      }
    }
  });

  test('the turret stays POSSESS-only on every frame', () => {
    const animations = createEnemyAnimations('turret')!;
    for (const [, animation] of animations) {
      for (const frame of animation.frames) {
        expect(frame.vulnerabilityVolumes?.map((v) => v.getHitType())).toEqual([HitType.POSSESS]);
      }
    }
  });

  test('art sizes match what the renderer used', () => {
    expect(getEnemyArtSize('bat')).toEqual({ width: 64, height: 32 });
    expect(getEnemyArtSize('karaguin')).toEqual({ width: 32, height: 32 });
    expect(getEnemyArtSize('mudman')).toEqual({ width: 128, height: 128 });
    expect(getEnemyArtSize('evil_kabocha')).toBeNull();
  });
});

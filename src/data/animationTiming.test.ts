/**
 * Per-frame animation timing, checked against the original.
 *
 * Every animation in this port used to hold each frame for the same 3/24s
 * (Andou's for 1/12s). Almost nothing in the original does that: a coin rests
 * for over a second and then glints, a mudman holds its slam for a third of a
 * second, Andou stands stock still for a full second between steps.
 *
 * Each number here is the `Utils.framesToTime(24, n)` argument in the matching
 * spawn function of GameObjectFactory.java.
 */

import { describe, expect, test } from 'bun:test';
import { createEnemyAnimations } from './enemyAnimations';
import { createObjectAnimation } from './objectAnimations';
import { createPlayerAnimations } from './playerAnimations';
import { EnemyAnimation } from '../entities/components/EnemyAnimationComponent';
import type { SpriteFrame } from '../types';

/** Frame hold times back in the original's 24 FPS units. */
function holdFrames(frames: SpriteFrame[]): number[] {
  return frames.map((f) => Math.round(f.duration * 24));
}

describe('enemy frame timing', () => {
  test('a brobot idles unevenly and walks fast', () => {
    const animations = createEnemyAnimations('brobot')!;
    const idle = animations.get(EnemyAnimation.IDLE)!;
    // Original: idle01(3), idle02(1), idle03(3), idle02(3) - it returns to
    // idle02 rather than snapping back to the start.
    expect(idle.frames.map((f) => f.sprite)).toEqual([
      'brobot_idle01', 'brobot_idle02', 'brobot_idle03', 'brobot_idle02',
    ]);
    expect(holdFrames(idle.frames)).toEqual([3, 1, 3, 3]);

    expect(holdFrames(animations.get(EnemyAnimation.MOVE)!.frames)).toEqual([1, 1, 1]);
  });

  test('a skeleton winds up long and strikes fast', () => {
    const attack = createEnemyAnimations('skeleton')!.get(EnemyAnimation.ATTACK)!;
    // 5 frames of wind-up, then two single-frame contact frames.
    expect(holdFrames(attack.frames)).toEqual([5, 1, 1]);
    expect(attack.loop).toBe(false);
  });

  test('a mudman holds the crush and returns to walk03 mid-cycle', () => {
    const animations = createEnemyAnimations('mudman')!;
    expect(holdFrames(animations.get(EnemyAnimation.ATTACK)!.frames))
      .toEqual([2, 2, 2, 2, 1, 1, 8, 5]);
    // A single held frame, not the three the port had invented.
    expect(animations.get(EnemyAnimation.IDLE)!.frames).toHaveLength(1);
    expect(holdFrames(animations.get(EnemyAnimation.IDLE)!.frames)).toEqual([12]);
    expect(holdFrames(animations.get(EnemyAnimation.MOVE)!.frames))
      .toEqual([4, 4, 5, 4, 4, 5]);
  });

  test('the turret loops its firing animation', () => {
    const animations = createEnemyAnimations('turret')!;
    const attack = animations.get(EnemyAnimation.ATTACK)!;
    expect(attack.loop).toBe(true);
    expect(holdFrames(attack.frames)).toEqual([1, 1, 2, 1]);
    // The idle is the closed barrel alone.
    expect(animations.get(EnemyAnimation.IDLE)!.frames.map((f) => f.sprite))
      .toEqual(['object_gunturret_idle']);
  });

  test('pink namazu breathes slowly in its sleep', () => {
    const idle = createEnemyAnimations('pink_namazu')!.get(EnemyAnimation.IDLE)!;
    expect(holdFrames(idle.frames)).toEqual([8, 3, 8, 3]);
  });

  test('the snailbomb leans out and back rather than cycling', () => {
    const walk = createEnemyAnimations('snailbomb')!.get(EnemyAnimation.MOVE)!;
    expect(walk.frames.map((f) => f.sprite)).toEqual([
      'snailbomb_stand', 'snailbomb_walk01', 'snailbomb_walk02',
      'snailbomb_walk01', 'snailbomb_stand',
    ]);
    expect(holdFrames(walk.frames)).toEqual([2, 2, 6, 2, 2]);
  });
});

describe('player frame timing', () => {
  test('Andou stands still for a full second', () => {
    const idle = createPlayerAnimations(false).get('idle')!;
    expect(idle.frames[0].duration).toBeCloseTo(1.0, 5);
  });

  test('the hit reaction holds for a tenth of a second', () => {
    const hit = createPlayerAnimations(false).get('hit')!;
    expect(hit.frames[0].duration).toBeCloseTo(0.1, 5);
  });

  test('the stomp runs at 24 FPS', () => {
    const stomp = createPlayerAnimations(false).get('stomp')!;
    expect(holdFrames(stomp.frames)).toEqual([1, 1, 1, 1]);
  });

  test('death flickers twice and then explodes', () => {
    const dead = createPlayerAnimations(false).get('dead')!;
    expect(dead.frames.map((f) => f.sprite)).toEqual([
      'andou_die01', 'andou_die02', 'andou_die01', 'andou_die02',
      'andou_explode01', 'andou_explode02', 'andou_explode03', 'andou_explode04',
      'andou_explode05', 'andou_explode06', 'andou_explode07', 'andou_explode08',
      'andou_explode09', 'andou_explode10', 'andou_explode11', 'andou_explode12',
    ]);
    // The explosion's tail runs at half speed.
    expect(holdFrames(dead.frames)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2,
    ]);
    expect(dead.loop).toBe(false);
  });
});

describe('object frame timing', () => {
  test('a coin rests, then glints', () => {
    const coin = createObjectAnimation('coin', 32, 32)!;
    // 30 frames - a second and a quarter - on the first frame alone.
    expect(holdFrames(coin.frames)).toEqual([30, 2, 2, 1, 2]);
    expect(coin.loop).toBe(true);
  });

  test('a ruby cycles from its second frame', () => {
    const ruby = createObjectAnimation('ruby', 32, 32)!;
    // ruby01 is not part of the original's cycle.
    expect(ruby.frames.map((f) => f.sprite)).toEqual([
      'ruby02', 'ruby03', 'ruby04', 'ruby05',
    ]);
    expect(holdFrames(ruby.frames)).toEqual([2, 1, 1, 2]);
  });

  test('the diary flickers through all six of its frames', () => {
    const diary = createObjectAnimation('diary', 32, 32)!;
    expect(diary.frames).toHaveLength(7);
    expect(new Set(diary.frames.map((f) => f.sprite)).size).toBe(6);
    expect(holdFrames(diary.frames)).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });

  test('the ghost animates the energy ball', () => {
    const ghost = createObjectAnimation('ghost', 64, 64)!;
    expect(ghost.frames.map((f) => f.sprite)).toEqual([
      'effect_energyball01', 'effect_energyball02',
      'effect_energyball03', 'effect_energyball04',
    ]);
  });

  test('a terminal flickers rather than cycling', () => {
    const terminal = createObjectAnimation('terminal', 64, 64, 'rokudou')!;
    expect(terminal.frames).toHaveLength(9);
    expect(holdFrames(terminal.frames)).toEqual([1, 2, 2, 1, 1, 1, 1, 1, 1]);
  });

  test('a brobot bullet is drawn with the brobot\'s own walk frames', () => {
    const bullet = createObjectAnimation('projectile', 32, 32, 'brobot_bullet')!;
    expect(bullet.frames.map((f) => f.sprite)).toEqual([
      'brobot_walk01', 'brobot_walk02', 'brobot_walk03',
    ]);
  });
});

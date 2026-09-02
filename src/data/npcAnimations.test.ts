import { describe, expect, test } from 'bun:test';
import { NPCAnimation } from '../entities/components/NPCAnimationComponent';
import { createNpcAnimations } from './npcAnimations';
import type { AnimationDefinition } from '../types';

function animation(subType: string, index: NPCAnimation): AnimationDefinition {
  const size = subType === 'evil_kabocha' || subType === 'rokudou' ? 128 : 64;
  return createNpcAnimations(subType, size, 128)!.get(index)!;
}

describe('NPC animation data', () => {
  test('Wanda preserves the original walk, run, jump wind-up, and shot timing', () => {
    const walk = animation('wanda', NPCAnimation.WALK);
    const run = animation('wanda', NPCAnimation.RUN);
    const jumpStart = animation('wanda', NPCAnimation.JUMP_START);
    const shoot = animation('wanda', NPCAnimation.SHOOT);

    expect(walk.frames.map((frame) => frame.sprite)).toEqual([
      'enemy_wanda_walk01', 'enemy_wanda_walk02', 'enemy_wanda_walk03',
      'enemy_wanda_walk04', 'enemy_wanda_walk05', 'enemy_wanda_walk04',
      'enemy_wanda_walk03', 'enemy_wanda_walk02',
    ]);
    expect(run.frames).toHaveLength(9);
    expect(run.frames[7]?.sprite).toBe('enemy_wanda_run04');
    expect(jumpStart.frames.map((frame) => frame.sprite)).toEqual([
      'enemy_wanda_run04', 'enemy_wanda_crouch',
      'enemy_wanda_jump01', 'enemy_wanda_jump01',
    ]);
    expect(shoot.frames.map((frame) => frame.duration * 24)).toEqual([
      2, 8, 1, 1, 1, 1, 1, 1, 2, 3, 3,
    ]);
  });

  test('boss animations use their shipped art and original frame contracts', () => {
    const kabochaDeath = animation('evil_kabocha', NPCAnimation.DEATH);
    const rokudouHit = animation('rokudou', NPCAnimation.TAKE_HIT);
    const rokudouDeath = animation('rokudou', NPCAnimation.DEATH);
    const rokudouShoot = animation('rokudou', NPCAnimation.SHOOT);

    expect(kabochaDeath.frames.map((frame) => frame.sprite)).toEqual([
      'evil_kabocha_die01', 'evil_kabocha_stand', 'evil_kabocha_die02',
      'evil_kabocha_die03', 'evil_kabocha_die04',
    ]);
    expect(rokudouHit.frames).toHaveLength(7);
    expect(rokudouDeath.frames).toHaveLength(5);
    expect(rokudouShoot.loop).toBe(true);
  });
});

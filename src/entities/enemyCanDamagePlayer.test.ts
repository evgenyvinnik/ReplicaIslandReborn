import { describe, expect, test } from 'bun:test';
import { ActionType } from '../types';
import { enemyCanDamagePlayer } from './enemyCanDamagePlayer';

describe('enemyCanDamagePlayer', () => {
  test('keeps contact enemies dangerous while they move', () => {
    expect(enemyCanDamagePlayer('brobot', ActionType.MOVE)).toBe(true);
    expect(enemyCanDamagePlayer('snailbomb', ActionType.MOVE)).toBe(true);
    expect(enemyCanDamagePlayer('shadowslime', ActionType.IDLE)).toBe(true);
  });

  test('only exposes timed attack volumes for animation-driven enemies', () => {
    expect(enemyCanDamagePlayer('pink_namazu', ActionType.IDLE)).toBe(false);
    expect(enemyCanDamagePlayer('pink_namazu', ActionType.ATTACK)).toBe(true);
    expect(enemyCanDamagePlayer('skeleton', ActionType.MOVE)).toBe(false);
    expect(enemyCanDamagePlayer('skeleton', ActionType.ATTACK)).toBe(true);
  });

  test('does not turn projectile-only or non-contact bosses into touch hazards', () => {
    expect(enemyCanDamagePlayer('turret', ActionType.ATTACK)).toBe(false);
    expect(enemyCanDamagePlayer('evil_kabocha', ActionType.MOVE)).toBe(false);
    expect(enemyCanDamagePlayer('rokudou', ActionType.ATTACK)).toBe(false);
    expect(enemyCanDamagePlayer('the_source', ActionType.IDLE)).toBe(false);
  });
});

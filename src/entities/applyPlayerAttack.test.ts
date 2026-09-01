/**
 * The inline stomp path and the component collision pipeline must not both
 * apply the same hit.
 *
 * Bosses used to be special-cased here by `subType` string, which is why they
 * never carried the original's collision volumes. They are now built the way
 * the original builds them - NPCComponent for the scripted death, a
 * vulnerability volume, and a HitReactionComponent fed by
 * GameObjectCollisionSystem - so this function must report on them without
 * touching their life.
 */

import { describe, expect, test } from 'bun:test';
import { Team, HitType } from '../types';
import { GameObject } from './GameObject';
import { applyPlayerAttack, canPlayerAttackTarget } from './applyPlayerAttack';
import { NPCComponent } from './components/NPCComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';

/** A boss built the way LevelSystemNew now builds Rokudou / Evil Kabocha. */
function makeScriptedBoss(subType: string, life: number): GameObject {
  const object = new GameObject();
  object.type = 'enemy';
  object.subType = subType;
  object.team = Team.ENEMY;
  object.life = life;

  const reaction = new HitReactionComponent();
  const collision = new DynamicCollisionComponent();
  collision.setCollisionVolumes(null, [new AABoxCollisionVolume(0, 0, 64, 64, HitType.HIT)]);
  collision.setHitReactionComponent(reaction);

  object.addComponent(new NPCComponent({ reactToHits: true }));
  object.addComponent(collision);
  object.addComponent(reaction);
  return object;
}

describe('applyPlayerAttack', () => {
  test('rejects player stomps against The Source on the same team', () => {
    const player = new GameObject();
    player.team = Team.PLAYER;
    const source = new GameObject();
    source.subType = 'the_source';
    source.team = Team.PLAYER;

    expect(canPlayerAttackTarget(player, source)).toBe(false);
    source.team = Team.ENEMY;
    expect(canPlayerAttackTarget(player, source)).toBe(true);
  });

  test('removes an ordinary enemy immediately', () => {
    const enemy = new GameObject();
    enemy.type = 'enemy';
    enemy.subType = 'brobot';

    expect(applyPlayerAttack(enemy)).toEqual({ isBoss: false, defeated: true });
    expect(enemy.life).toBe(0);
    expect(enemy.isVisible()).toBe(false);
    expect(enemy.isMarkedForRemoval()).toBe(true);
  });

  test('does not decrement a scripted boss - the collision system owns that', () => {
    const boss = makeScriptedBoss('rokudou', 3);

    const result = applyPlayerAttack(boss);

    expect(result).toEqual({ isBoss: true, defeated: false });
    // Applying damage here as well would halve the number of stomps the fight
    // takes compared with the original.
    expect(boss.life).toBe(3);
    expect(boss.isVisible()).toBe(true);
    expect(boss.isMarkedForRemoval()).toBe(false);
  });

  test('reports a scripted boss as defeated but leaves its death sequence alone', () => {
    const boss = makeScriptedBoss('evil_kabocha', 0);

    const result = applyPlayerAttack(boss);

    expect(result).toEqual({ isBoss: true, defeated: true });
    // NPCComponent plays the death action and posts the ending cutscene; the
    // object must survive long enough for that to happen.
    expect(boss.isMarkedForRemoval()).toBe(false);
    expect(boss.isVisible()).toBe(true);
  });

  test('The Source keeps its own collapse sequence', () => {
    const source = new GameObject();
    source.type = 'enemy';
    source.subType = 'the_source';
    source.life = 0;
    const reaction = new HitReactionComponent();
    source.addComponent(reaction);

    const result = applyPlayerAttack(source);

    expect(result).toEqual({ isBoss: true, defeated: true });
    expect(source.isMarkedForRemoval()).toBe(false);
  });

  test('an object with no death sequence is removed once the pipeline kills it', () => {
    // Breakable blocks take their damage from the collision system but have
    // nothing to run a death animation, so they are cleaned up here.
    const block = new GameObject();
    block.type = 'breakable_block';
    block.life = 0;
    block.addComponent(new HitReactionComponent());

    const result = applyPlayerAttack(block);

    expect(result).toEqual({ isBoss: false, defeated: true });
    expect(block.isVisible()).toBe(false);
    expect(block.isMarkedForRemoval()).toBe(true);
  });

  test('a still-standing pipeline object is left alone', () => {
    const block = new GameObject();
    block.type = 'breakable_block';
    block.life = 1;
    block.addComponent(new HitReactionComponent());

    expect(applyPlayerAttack(block)).toEqual({ isBoss: false, defeated: false });
    expect(block.isMarkedForRemoval()).toBe(false);
  });
});

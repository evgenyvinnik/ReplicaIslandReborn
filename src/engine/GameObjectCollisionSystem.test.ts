/**
 * Object-to-object collision, end to end through the component pipeline.
 *
 * This system is the original's `GameObjectCollisionSystem`: attack volumes are
 * tested against vulnerability volumes and the result is dispatched to
 * `HitReactionComponent`. It was fully ported but never instantiated, which left
 * `DynamicCollisionComponent` volumes inert and forced combat to be
 * reimplemented as inline AABB checks keyed off `subType` strings. These tests
 * pin the wiring so it cannot silently fall out again.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { GameObjectCollisionSystem } from './GameObjectCollisionSystem';
import { sSystemRegistry } from './SystemRegistry';
import { GameObject } from '../entities/GameObject';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { AABoxCollisionVolume } from './collision/AABoxCollisionVolume';
import { HitType, Team } from '../types';

/** An attacker carrying a single HIT attack volume covering its whole body. */
function makeAttacker(x: number, y: number): GameObject {
  const object = new GameObject();
  object.type = 'player';
  object.team = Team.PLAYER;
  object.width = 32;
  object.height = 48;
  object.getPosition().set(x, y);

  const collision = new DynamicCollisionComponent();
  collision.setCollisionVolumes([new AABoxCollisionVolume(0, 0, 32, 48, HitType.HIT)], null);
  object.addComponent(collision);
  return object;
}

interface Victim {
  object: GameObject;
  reaction: HitReactionComponent;
}

/** A victim carrying a vulnerability volume and a real HitReactionComponent. */
function makeVictim(x: number, y: number, life: number): Victim {
  const object = new GameObject();
  object.type = 'enemy';
  object.team = Team.ENEMY;
  object.width = 64;
  object.height = 64;
  object.life = life;
  object.maxLife = life;
  object.getPosition().set(x, y);

  const reaction = new HitReactionComponent();
  const collision = new DynamicCollisionComponent();
  collision.setCollisionVolumes(null, [new AABoxCollisionVolume(0, 0, 64, 64, HitType.HIT)]);
  collision.setHitReactionComponent(reaction);
  object.addComponent(collision);
  object.addComponent(reaction);
  return { object, reaction };
}

/** Run one frame: components register their volumes, then the system resolves. */
function runFrame(system: GameObjectCollisionSystem, objects: GameObject[], time: number): void {
  for (const object of objects) {
    object.setGameTime(time);
    object.update(1 / 60, time);
  }
  system.update(1 / 60);
}

describe('GameObjectCollisionSystem wiring', () => {
  let system: GameObjectCollisionSystem;

  beforeEach(() => {
    sSystemRegistry.reset();
    system = new GameObjectCollisionSystem();
    sSystemRegistry.register(system, 'gameObjectCollision');
  });

  test('is reachable from the global registry', () => {
    expect(sSystemRegistry.gameObjectCollisionSystem).toBe(system);
  });

  test('an overlapping attack volume damages a vulnerable object', () => {
    const attacker = makeAttacker(100, 100);
    const victim = makeVictim(100, 100, 3);

    runFrame(system, [attacker, victim.object], 1);

    expect(victim.object.life).toBe(2);
  });

  test('objects that do not overlap are left alone', () => {
    const attacker = makeAttacker(0, 100);
    const victim = makeVictim(1000, 100, 3);

    runFrame(system, [attacker, victim.object], 1);

    expect(victim.object.life).toBe(3);
  });

  test('DynamicCollisionComponent resolves the system without explicit injection', () => {
    // Nothing calls setCollisionSystem() at any spawn site, so the registry
    // fallback is the only thing making the pipeline work in the real game.
    const attacker = makeAttacker(100, 100);
    const victim = makeVictim(100, 100, 1);
    expect(victim.object.getComponent(DynamicCollisionComponent)).toBeDefined();

    runFrame(system, [attacker, victim.object], 1);

    expect(victim.object.life).toBe(0);
  });

  test('same-team attackers do not damage each other', () => {
    const attacker = makeAttacker(100, 100);
    const victim = makeVictim(100, 100, 3);
    victim.object.team = Team.PLAYER;

    runFrame(system, [attacker, victim.object], 1);

    expect(victim.object.life).toBe(3);
  });

  test("a stomping player breaks a breakable block", () => {
    // Blocks take their damage from the pipeline now, and applyPlayerAttack
    // clears them away once life runs out. The player's HIT volume only exists
    // while stomping, so walking past a block must leave it standing.
    const makeBlock = (): { object: GameObject; reaction: HitReactionComponent } => {
      const object = new GameObject();
      object.type = 'breakable_block';
      object.team = Team.ENEMY;
      object.width = 32;
      object.height = 32;
      object.life = 1;
      object.getPosition().set(100, 100);

      const reaction = new HitReactionComponent();
      const collision = new DynamicCollisionComponent();
      collision.setCollisionVolumes(
        null,
        [new AABoxCollisionVolume(7, 0, 32 - 7, 42, HitType.HIT)]
      );
      collision.setHitReactionComponent(reaction);
      object.addComponent(collision);
      object.addComponent(reaction);
      return { object, reaction };
    };

    const stomper = makeAttacker(100, 100);
    const block = makeBlock();
    runFrame(system, [stomper, block.object], 1);

    expect(block.object.life).toBe(0);
  });

  test('an invincible target refuses the hit', () => {
    const attacker = makeAttacker(100, 100);
    const victim = makeVictim(100, 100, 3);
    victim.reaction.setInvincible(true);

    runFrame(system, [attacker, victim.object], 1);

    expect(victim.object.life).toBe(3);
  });
});

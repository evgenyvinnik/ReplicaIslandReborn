/**
 * Ordinary enemies, damaged and damaging through the component pipeline.
 *
 * Combat used to be a whole-body AABB check in Game.tsx that one-shot every
 * enemy and applied contact damage from a `subType` lookup table. The original
 * puts attack and vulnerability volumes on animation frames instead, which
 * produces behaviour the AABB version could not express:
 *
 *  - Mudman and Pink Namazu have no vulnerability volume; they cannot be
 *    stomped at all.
 *  - Skeleton, Mudman and Pink Namazu only carry an attack volume on their
 *    attack frames, so they are harmless while patrolling.
 *  - Stomping drops Andou's vulnerability volume, so a stomp beats contact
 *    damage.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObject } from './GameObject';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { EnemyCollisionComponent } from './components/EnemyCollisionComponent';
import {
  createEnemyCollisionProfile,
  selectEnemyAttackVolumes,
} from './enemyCollisionProfiles';
import { createPlayerVolumeSets } from './playerCollisionVolumes';
import { ActionType, HitType, Team } from '../types';

const ALWAYS_HOSTILE = ['brobot', 'snailbomb', 'shadowslime', 'karaguin', 'bat', 'sting', 'onion'];
const ATTACK_ONLY = ['skeleton', 'mudman', 'pink_namazu'];
const INVULNERABLE = ['mudman', 'pink_namazu'];

describe('enemy collision profiles', () => {
  test('every enemy the levels spawn has a profile', () => {
    for (const subType of [...ALWAYS_HOSTILE, ...ATTACK_ONLY, 'turret']) {
      expect(createEnemyCollisionProfile(subType), subType).not.toBeNull();
    }
  });

  test('bosses and scripted characters are left to configure themselves', () => {
    for (const subType of ['evil_kabocha', 'rokudou', 'the_source', 'wanda', 'kyle']) {
      expect(createEnemyCollisionProfile(subType), subType).toBeNull();
    }
  });

  test('crushers are invulnerable', () => {
    for (const subType of INVULNERABLE) {
      const profile = createEnemyCollisionProfile(subType);
      // A stomp must not kill these; the player has to avoid or possess them.
      expect(profile?.vulnerability, subType).toBeNull();
    }
  });

  test('ordinary enemies are vulnerable', () => {
    for (const subType of [...ALWAYS_HOSTILE, 'skeleton', 'turret']) {
      const profile = createEnemyCollisionProfile(subType);
      expect(profile?.vulnerability, subType).not.toBeNull();
    }
  });

  test('attack-frame enemies are harmless while patrolling', () => {
    for (const subType of ATTACK_ONLY) {
      const profile = createEnemyCollisionProfile(subType)!;
      expect(selectEnemyAttackVolumes(profile, ActionType.MOVE), subType).toBeNull();
      expect(selectEnemyAttackVolumes(profile, ActionType.ATTACK), subType).not.toBeNull();
    }
  });

  test('contact enemies are hostile on every frame', () => {
    for (const subType of ALWAYS_HOSTILE) {
      const profile = createEnemyCollisionProfile(subType)!;
      expect(selectEnemyAttackVolumes(profile, ActionType.MOVE), subType).not.toBeNull();
    }
  });

  test('the turret hurts only through its projectiles', () => {
    const profile = createEnemyCollisionProfile('turret')!;
    expect(profile.attack).toBeNull();
    expect(profile.vulnerability).not.toBeNull();
  });

  test('the turret can only be possessed, never stomped', () => {
    // The original types the turret's vulnerability volume POSSESS, so a HIT
    // simply does not match it.
    const profile = createEnemyCollisionProfile('turret')!;
    expect(profile.vulnerability!.map((v) => v.getHitType())).toEqual([HitType.POSSESS]);
  });

  test('enemies the original leaves untyped accept any hit', () => {
    // An untyped vulnerability volume matches every hit type, which is how a
    // brobot can be both stomped and possessed.
    for (const subType of ['brobot', 'skeleton', 'karaguin', 'bat', 'sting', 'onion']) {
      const profile = createEnemyCollisionProfile(subType)!;
      expect(profile.vulnerability!.map((v) => v.getHitType()), subType)
        .toEqual([HitType.INVALID]);
    }
  });

  test('the shadow slime and snailbomb are stompable but not possessable', () => {
    // Two enemies the original types HIT rather than leaving untyped:
    // spawnEnemyShadowSlime calls setHitType(HitType.HIT) on its vulnerability
    // volume, and the snailbomb's is constructed with it. A typed volume
    // accepts only its own hit type, so the ghost bounces off both.
    for (const subType of ['shadowslime', 'snailbomb']) {
      const profile = createEnemyCollisionProfile(subType)!;
      expect(profile.vulnerability!.map((v) => v.getHitType()), subType)
        .toEqual([HitType.HIT]);
    }
  });

  test('a brobot can still depress buttons', () => {
    // The original gives brobots a DEPRESS volume so they trigger buttons.
    const profile = createEnemyCollisionProfile('brobot')!;
    const types = profile.attack!.map((volume) => volume.getHitType());
    expect(types).toContain(HitType.DEPRESS);
    expect(types).toContain(HitType.HIT);
  });
});

describe('enemy combat through GameObjectCollisionSystem', () => {
  let system: GameObjectCollisionSystem;

  beforeEach(() => {
    sSystemRegistry.reset();
    system = new GameObjectCollisionSystem();
    sSystemRegistry.register(system, 'gameObjectCollision');
  });

  /** An enemy wired the way LevelSystemNew.attachEnemyCollision wires it. */
  function makeEnemy(subType: string, action: ActionType = ActionType.MOVE): GameObject {
    const object = new GameObject();
    object.type = 'enemy';
    object.subType = subType;
    object.team = Team.ENEMY;
    object.width = 64;
    object.height = 64;
    object.life = 1;
    object.getPosition().set(100, 100);
    object.setCurrentAction(action);

    const profile = createEnemyCollisionProfile(subType)!;
    const collision = new DynamicCollisionComponent();
    const reaction = new HitReactionComponent({ invincibleAfterHitTime: 0.5 });
    collision.setHitReactionComponent(reaction);
    const selector = new EnemyCollisionComponent(profile);
    selector.setCollisionComponent(collision);

    object.addComponent(collision);
    object.addComponent(reaction);
    object.addComponent(selector);
    return object;
  }

  function makePlayer(state: 'normal' | 'stomping', x = 100, y = 100): GameObject {
    const object = new GameObject();
    object.type = 'player';
    object.team = Team.PLAYER;
    object.width = 32;
    object.height = 48;
    object.life = 3;
    object.getPosition().set(x, y);

    const sets = createPlayerVolumeSets();
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(sets[state].attack, sets[state].vulnerability);
    const reaction = new HitReactionComponent({ invincibleAfterHitTime: 2 });
    collision.setHitReactionComponent(reaction);
    object.addComponent(collision);
    object.addComponent(reaction);
    return object;
  }

  function runFrame(objects: GameObject[], time = 1): void {
    for (const object of objects) {
      object.setGameTime(time);
      object.update(1 / 60, time);
    }
    system.update(1 / 60);
  }

  test('stomping kills an ordinary enemy', () => {
    const player = makePlayer('stomping');
    const enemy = makeEnemy('brobot');

    runFrame([player, enemy]);

    expect(enemy.life).toBe(0);
  });

  test('stomping does not kill a turret', () => {
    const player = makePlayer('stomping');
    const turret = makeEnemy('turret');

    runFrame([player, turret]);

    expect(turret.life).toBe(1);
  });

  test('stomping does not kill a mudman', () => {
    const player = makePlayer('stomping');
    const mudman = makeEnemy('mudman');

    runFrame([player, mudman]);

    expect(mudman.life).toBe(1);
  });

  test('walking into a brobot costs the player a life', () => {
    const player = makePlayer('normal');
    const enemy = makeEnemy('brobot');

    runFrame([player, enemy]);

    expect(player.life).toBe(2);
  });

  // The skeleton's swing sphere sits higher and further right than its body
  // (Sphere(16, 48, 32) vs the body's Sphere(16, 32, 32)), so the player has to
  // stand inside the arc for these two cases to differ only by action.
  const IN_SWING_ARC = 120;

  test('a patrolling skeleton is harmless', () => {
    const player = makePlayer('normal', IN_SWING_ARC);
    const skeleton = makeEnemy('skeleton', ActionType.MOVE);

    runFrame([player, skeleton]);

    expect(player.life).toBe(3);
  });

  test('an attacking skeleton hurts', () => {
    const player = makePlayer('normal', IN_SWING_ARC);
    const skeleton = makeEnemy('skeleton', ActionType.ATTACK);

    runFrame([player, skeleton]);

    expect(player.life).toBe(2);
  });

  test('stomping beats contact damage', () => {
    // The original's STOMP frames carry no vulnerability volume, so landing on
    // an enemy kills it without costing a life.
    const player = makePlayer('stomping');
    const enemy = makeEnemy('brobot');

    runFrame([player, enemy]);

    expect(enemy.life).toBe(0);
    expect(player.life).toBe(3);
  });

  test('a dead enemy stops hurting the player', () => {
    const player = makePlayer('stomping');
    const enemy = makeEnemy('brobot');
    runFrame([player, enemy]);
    expect(enemy.life).toBe(0);

    // Game.tsx hides and removes it on the same frame; make sure a second pass
    // with a vulnerable player does not then take a life off a corpse.
    enemy.setVisible(false);
    enemy.markForRemoval();
    const vulnerable = makePlayer('normal');
    vulnerable.getPosition().set(100, 100);
    runFrame([vulnerable], 2);

    expect(vulnerable.life).toBe(3);
  });
});

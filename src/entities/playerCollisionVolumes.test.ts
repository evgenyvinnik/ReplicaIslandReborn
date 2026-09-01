/**
 * The player's HIT volume must only be live while stomping (or glowing).
 *
 * The original gets this for free because collision volumes live on animation
 * frames and only the STOMP/glow frames carry a HIT volume. This port assigns
 * volumes from PlayerComponent state instead, so the rule needs pinning: a
 * permanently-live HIT volume would let the player kill enemies by walking into
 * them.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObject } from './GameObject';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { createPlayerVolumeSets, selectPlayerVolumeState } from './playerCollisionVolumes';
import { HitType, Team } from '../types';

describe('player collision volume selection', () => {
  test('normal movement carries no HIT attack volume', () => {
    const sets = createPlayerVolumeSets();
    const hitVolumes = sets.normal.attack.filter((v) => v.getHitType() === HitType.HIT);
    expect(hitVolumes).toHaveLength(0);
  });

  test('normal movement is vulnerable', () => {
    const sets = createPlayerVolumeSets();
    expect(sets.normal.vulnerability).not.toBeNull();
  });

  test('stomping and glowing drop vulnerability', () => {
    // The original's STOMP and glow frames pass null vulnerability volumes;
    // that is what lets a stomp beat an enemy's contact damage.
    const sets = createPlayerVolumeSets();
    expect(sets.stomping.vulnerability).toBeNull();
    expect(sets.glowing.vulnerability).toBeNull();
  });

  test('stomping carries a HIT volume', () => {
    const sets = createPlayerVolumeSets();
    expect(sets.stomping.attack.some((v) => v.getHitType() === HitType.HIT)).toBe(true);
  });

  test('glowing carries a HIT volume', () => {
    const sets = createPlayerVolumeSets();
    expect(sets.glowing.attack.some((v) => v.getHitType() === HitType.HIT)).toBe(true);
  });

  test('DEPRESS and COLLECT stay available in every state', () => {
    const sets = createPlayerVolumeSets();
    for (const state of ['normal', 'stomping', 'glowing'] as const) {
      const types = sets[state].attack.map((v) => v.getHitType());
      expect(types).toContain(HitType.DEPRESS);
      expect(types).toContain(HitType.COLLECT);
    }
  });

  test('stomping takes precedence over glowing', () => {
    expect(selectPlayerVolumeState(true, true)).toBe('stomping');
    expect(selectPlayerVolumeState(true, false)).toBe('stomping');
    expect(selectPlayerVolumeState(false, true)).toBe('glowing');
    expect(selectPlayerVolumeState(false, false)).toBe('normal');
  });
});

describe('player volumes through the collision system', () => {
  let system: GameObjectCollisionSystem;

  beforeEach(() => {
    sSystemRegistry.reset();
    system = new GameObjectCollisionSystem();
    sSystemRegistry.register(system, 'gameObjectCollision');
  });

  /** A player-team object wearing one of the real volume sets. */
  function makePlayer(state: 'normal' | 'stomping' | 'glowing'): GameObject {
    const object = new GameObject();
    object.type = 'player';
    object.team = Team.PLAYER;
    object.width = 32;
    object.height = 48;
    object.getPosition().set(100, 100);

    const sets = createPlayerVolumeSets();
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(sets[state].attack, sets[state].vulnerability);
    object.addComponent(collision);
    return object;
  }

  function makeEnemy(): GameObject {
    const object = new GameObject();
    object.type = 'enemy';
    object.team = Team.ENEMY;
    object.width = 64;
    object.height = 64;
    object.life = 3;
    object.getPosition().set(100, 100);

    const reaction = new HitReactionComponent();
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(null, [new AABoxCollisionVolume(0, 0, 64, 64, HitType.HIT)]);
    collision.setHitReactionComponent(reaction);
    object.addComponent(collision);
    object.addComponent(reaction);
    return object;
  }

  function runFrame(objects: GameObject[]): void {
    for (const object of objects) {
      object.setGameTime(1);
      object.update(1 / 60, 1);
    }
    system.update(1 / 60);
  }

  test('walking into an enemy does not damage it', () => {
    const player = makePlayer('normal');
    const enemy = makeEnemy();

    runFrame([player, enemy]);

    expect(enemy.life).toBe(3);
  });

  test('stomping an enemy damages it', () => {
    const player = makePlayer('stomping');
    const enemy = makeEnemy();

    runFrame([player, enemy]);

    expect(enemy.life).toBe(2);
  });
});

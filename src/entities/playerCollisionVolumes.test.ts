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

  test("the player's vulnerability volume accepts every hit type", () => {
    // Untyped in the original. Typing it HIT would stop a cannon's LAUNCH
    // volume from ever reaching Andou, so he could never be fired.
    const sets = createPlayerVolumeSets();
    expect(sets.normal.vulnerability!.map((v) => v.getHitType())).toEqual([HitType.INVALID]);
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

  test('the stomp box is under Andou, not over his head', () => {
    // The original's stompAttackVolume is AABox(16, -5, 32, 37, HIT) on a
    // 64x64 sprite in Y-up space, whose origin is the object's bottom. That
    // spans y -5..32: it starts five pixels *below* his feet and reaches up to
    // mid-body, which is what makes a stomp land on whatever he comes down on.
    //
    // Carried over with only its x rescaled - which is what this port did - it
    // becomes -5..32 in Y-down, sitting above his head. Andou then reaches
    // *over* an enemy rather than into it, and the hit only lands after he has
    // fallen far enough that his head is level with the enemy's body.
    //
    // Conversion for the 32x48 player object: 48 - (offsetY_up + height).
    const sets = createPlayerVolumeSets();
    const hit = sets.stomping.attack.find(
      (v) => (v as { getHitType(): HitType }).getHitType() === HitType.HIT
    ) as AABoxCollisionVolume;
    expect(hit).toBeDefined();

    const PLAYER_HEIGHT = 48;
    // Reaches below the feet, as the original's -5 does.
    expect(hit.getMaxYPosition(null)).toBeGreaterThan(PLAYER_HEIGHT);
    // And does not extend above his middle.
    expect(hit.getMinYPosition(null)).toBeGreaterThanOrEqual(PLAYER_HEIGHT / 2 - 8);
  });

  test('the DEPRESS box is at his feet, which is what presses a button', () => {
    // pressCollisionVolume is AABox(16, 0, 32, 16) - the bottom 16px of the
    // sprite in Y-up. At the head it would press buttons Andou jumped past
    // rather than ones he stood on.
    const sets = createPlayerVolumeSets();
    const press = sets.normal.attack.find(
      (v) => (v as { getHitType(): HitType }).getHitType() === HitType.DEPRESS
    ) as AABoxCollisionVolume;
    expect(press).toBeDefined();
    expect(press.getMaxYPosition(null)).toBe(48);
    expect(press.getMinYPosition(null)).toBe(32);
  });
});

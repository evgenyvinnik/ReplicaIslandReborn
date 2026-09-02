/**
 * Enemies draw themselves through SpriteComponent.
 *
 * Rendering used to be a 200-line switch inside `Game.tsx`'s render callback
 * that picked a list of sprite names from each enemy's action and velocity every
 * frame. That is `EnemyAnimationComponent`'s job, and the frames belong on
 * `SpriteComponent` — which is also where the original keeps each frame's
 * collision volumes.
 *
 * This drives a real level through a recording RenderSystem and checks that the
 * draw calls come out of the component pipeline with the right sprites.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { LevelSystem } from './LevelSystemNew';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { EnemyAnimationComponent } from '../entities/components/EnemyAnimationComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import type { RenderSystem } from '../engine/RenderSystem';
import type { GameObject } from '../entities/GameObject';
import type { GameComponent } from '../entities/GameComponent';
import { ActionType, HitType } from '../types';
import { createPlayerAnimations } from '../data/playerAnimations';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

interface DrawCall {
  sprite: string;
  x: number;
  y: number;
}

/** Stands in for RenderSystem, recording what the components ask to draw. */
function createRecordingRenderSystem(): { system: RenderSystem; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const system = {
    // Every sprite "exists" so SpriteComponent never bails out on a missing asset.
    hasSprite: (): boolean => true,
    drawSprite: (sprite: string, x: number, y: number): void => {
      calls.push({ sprite, x, y });
    },
  } as unknown as RenderSystem;
  return { system, calls };
}

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.pathname
        : new URL(input.url).pathname;
    const pathname = rawUrl.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const requested = file(join(publicDirectory, pathname));
    if (!(await requested.exists())) return new Response(null, { status: 404 });
    return new Response(await requested.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('enemies render from their components', () => {
  let calls: DrawCall[];
  let manager: GameObjectManager;

  beforeEach(() => {
    sSystemRegistry.reset();
    manager = new GameObjectManager();
    manager.setCamera(new CameraSystem(480, 320));
    const recorder = createRecordingRenderSystem();
    calls = recorder.calls;
    sSystemRegistry.register(recorder.system, 'render');
    sSystemRegistry.register(manager, 'gameObject');
  });

  async function loadLevelWithEnemy(subType: string): Promise<GameObject | null> {
    for (const group of linearLevelTree) {
      for (const entry of group.levels) {
        const levelSystem = new LevelSystem();
        levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
        if (!(await levelSystem.loadLevel(resourceToLevelId[entry.resource]))) continue;
        manager.commitUpdates();
        const enemy = manager.getActiveObjects().find((o) => o.subType === subType);
        if (enemy) return enemy;
        manager.reset();
      }
    }
    return null;
  }

  function componentOf<T extends GameComponent>(object: GameObject, ctor: unknown): T | null {
    return object.getComponent(ctor as new (...args: unknown[]) => T) as T | null;
  }

  test('a spawned enemy carries the animation components', async () => {
    const brobot = await loadLevelWithEnemy('brobot');
    expect(brobot, 'no level spawns a brobot').not.toBeNull();

    expect(componentOf<SpriteComponent>(brobot!, SpriteComponent)).not.toBeNull();
    expect(componentOf<EnemyAnimationComponent>(brobot!, EnemyAnimationComponent)).not.toBeNull();
  });

  test('updating an enemy schedules a draw of one of its own frames', async () => {
    const brobot = await loadLevelWithEnemy('brobot');
    const sprite = componentOf<SpriteComponent>(brobot!, SpriteComponent)!;

    calls.length = 0;
    sprite.update(1 / 60, brobot!);

    expect(calls.length).toBe(1);
    expect(calls[0].sprite).toMatch(/^brobot_(idle|walk)0\d$/);
  });

  test('the drawn frame advances with the animation', async () => {
    const brobot = await loadLevelWithEnemy('brobot');
    const sprite = componentOf<SpriteComponent>(brobot!, SpriteComponent)!;

    calls.length = 0;
    for (let i = 0; i < 12; i++) {
      sprite.update(1 / 24, brobot!);
    }

    const distinct = new Set(calls.map((c) => c.sprite));
    expect(distinct.size).toBeGreaterThan(1);
  });

  test('the played animation follows the action', async () => {
    const skeleton = await loadLevelWithEnemy('skeleton');
    expect(skeleton, 'no level spawns a skeleton').not.toBeNull();
    const sprite = componentOf<SpriteComponent>(skeleton!, SpriteComponent)!;
    const animator = componentOf<EnemyAnimationComponent>(skeleton!, EnemyAnimationComponent)!;

    skeleton!.setCurrentAction(ActionType.ATTACK);
    // EnemyAnimationComponent notes the transition on one update and plays the
    // new animation on the next, as the original's state machine does.
    animator.update(1 / 60, skeleton!);
    animator.update(1 / 60, skeleton!);
    calls.length = 0;
    sprite.update(1 / 60, skeleton!);

    expect(calls[0].sprite).toMatch(/^skeleton_attack/);
  });

  test('single-loop objects draw themselves too', async () => {
    // Collectibles, blocks, signs, cannons and spawners have no state to select
    // on, so they get a looping animation and no animation component.
    const cases: Array<[string, RegExp]> = [
      ['coin', /^coin0\d$/],
      ['ruby', /^ruby0\d$/],
      ['breakable_block', /^debris_block$/],
    ];

    for (const [type, pattern] of cases) {
      manager.reset();
      let object: GameObject | null = null;
      for (const group of linearLevelTree) {
        for (const entry of group.levels) {
          const levelSystem = new LevelSystem();
          levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
          if (!(await levelSystem.loadLevel(resourceToLevelId[entry.resource]))) continue;
          manager.commitUpdates();
          object = manager.getActiveObjects().find((o) => o.type === type) ?? null;
          if (object) break;
          manager.reset();
        }
        if (object) break;
      }

      expect(object, `no level spawns a ${type}`).not.toBeNull();
      const sprite = componentOf<SpriteComponent>(object!, SpriteComponent);
      expect(sprite, `${type} has no SpriteComponent`).not.toBeNull();

      calls.length = 0;
      sprite!.update(1 / 60, object!);
      expect(calls.length, type).toBe(1);
      expect(calls[0].sprite, type).toMatch(pattern);
    }
  });

  test('doors and buttons draw the sprite their state selects', async () => {
    // Their animation components already chose the animation; naming the sprite
    // on each frame is what lets SpriteComponent draw it.
    for (const type of ['door', 'button']) {
      manager.reset();
      let object: GameObject | null = null;
      for (const group of linearLevelTree) {
        for (const entry of group.levels) {
          const levelSystem = new LevelSystem();
          levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
          if (!(await levelSystem.loadLevel(resourceToLevelId[entry.resource]))) continue;
          manager.commitUpdates();
          object = manager.getActiveObjects().find((o) => o.type === type) ?? null;
          if (object) break;
          manager.reset();
        }
        if (object) break;
      }

      expect(object, `no level spawns a ${type}`).not.toBeNull();
      const sprite = componentOf<SpriteComponent>(object!, SpriteComponent)!;

      calls.length = 0;
      sprite.update(1 / 60, object!);
      expect(calls.length, type).toBe(1);
      expect(calls[0].sprite, type).toMatch(
        type === 'door' ? /^object_door_(red|blue|green)0\d$/ : /^object_button_/
      );
    }
  });

  test('a runtime-spawned projectile draws itself', async () => {
    // Projectiles come from GameObjectFactory rather than level data, so they
    // need the same sprite attachment LevelSystem gives level-placed objects.
    const factory = new GameObjectFactory(manager);
    factory.setRenderSystem(sSystemRegistry.renderSystem!);
    const shot = factory.spawn(GameObjectType.ENERGY_BALL, 100, 100);
    expect(shot, 'factory did not spawn an energy ball').not.toBeNull();
    manager.commitUpdates();

    const sprite = componentOf<SpriteComponent>(shot!, SpriteComponent);
    expect(sprite, 'projectile has no SpriteComponent').not.toBeNull();

    calls.length = 0;
    sprite!.update(1 / 60, shot!);
    expect(calls.length).toBe(1);
    expect(calls[0].sprite).toMatch(/^energy_ball0\d$/);
  });

  test("Andou's stomp frames arm his attack volume and drop his vulnerability", async () => {
    // The point of moving the player onto SpriteComponent: his volumes ride on
    // the animation frames, as the original's spawnPlayer() sets them. The
    // STOMP frames pass null vulnerability volumes, which is what makes a stomp
    // beat an enemy's contact damage.
    const idle = createPlayerAnimations(false).get('idle')!;
    const stomp = createPlayerAnimations(false).get('stomp')!;

    for (const frame of idle.frames) {
      expect(frame.vulnerabilityVolumes).not.toBeNull();
      expect(frame.attackVolumes!.some((v) => v.getHitType() === HitType.HIT)).toBe(false);
    }
    for (const frame of stomp.frames) {
      expect(frame.vulnerabilityVolumes).toBeNull();
      expect(frame.attackVolumes!.some((v) => v.getHitType() === HitType.HIT)).toBe(true);
    }
  });

  test('the glow powerup swaps in a bigger attack volume', async () => {
    const normal = createPlayerAnimations(false).get('idle')!;
    const glowing = createPlayerAnimations(true).get('idle')!;

    expect(normal.frames[0].attackVolumes!.some((v) => v.getHitType() === HitType.HIT)).toBe(false);
    expect(glowing.frames[0].attackVolumes!.some((v) => v.getHitType() === HitType.HIT)).toBe(true);
  });

  test('the frame volumes reach the collision component as it plays', async () => {
    // The payoff of moving rendering onto components: a skeleton's attack volume
    // arrives on the frames where the swing lands, not from an action lookup.
    const skeleton = await loadLevelWithEnemy('skeleton');
    const sprite = componentOf<SpriteComponent>(skeleton!, SpriteComponent)!;
    const collision = componentOf<DynamicCollisionComponent>(skeleton!, DynamicCollisionComponent)!;

    sprite.playAnimation(2 /* EnemyAnimation.ATTACK */);
    sprite.update(0, skeleton!);
    // Wind-up frame: no attack volume.
    expect(collision.getAttackVolumes()).toBeNull();

    sprite.update(1 / 24 * 3 + 0.001, skeleton!);
    // Contact frame: armed.
    expect(collision.getAttackVolumes()).not.toBeNull();
  });
});

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
import { GenericAnimationComponent } from '../entities/components/GenericAnimationComponent';
import { AttackAtDistanceComponent } from '../entities/components/AttackAtDistanceComponent';
import { ChangeComponentsComponent } from '../entities/components/ChangeComponentsComponent';
import { GhostComponent } from '../entities/components/GhostComponent';
import { TimeSystem } from '../engine/TimeSystem';
import { InputSystem } from '../engine/InputSystem';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import type { RenderSystem } from '../engine/RenderSystem';
import type { GameObject } from '../entities/GameObject';
import type { GameComponent } from '../entities/GameComponent';
import { ActionType, HitType } from '../types';
import { SortConstants } from '../engine/SortConstants';
import { createPlayerAnimations } from '../data/playerAnimations';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

interface DrawCall {
  sprite: string;
  x: number;
  y: number;
  z: number;
}

/** Stands in for RenderSystem, recording what the components ask to draw. */
function createRecordingRenderSystem(): { system: RenderSystem; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const system = {
    // Every sprite "exists" so SpriteComponent never bails out on a missing asset.
    hasSprite: (): boolean => true,
    drawSprite: (sprite: string, x: number, y: number, _frame: number, z: number): void => {
      calls.push({ sprite, x, y, z });
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

  test('every ordinary campaign enemy uses the controller chosen by the Android factory', async () => {
    // spawnEnemyPinkNamazu and spawnObjectTurret are action-driven. The other
    // nine use EnemyAnimationComponent's movement/hiding/attack state machine.
    const remaining = new Set(['bat', 'sting', 'onion', 'karaguin', 'brobot',
      'skeleton', 'snailbomb', 'mudman', 'shadowslime', 'pink_namazu', 'turret']);
    const level = new LevelSystem();
    level.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
    for (const group of linearLevelTree) {
      for (const entry of group.levels) {
        expect(await level.loadLevel(resourceToLevelId[entry.resource]), entry.resource).toBe(true);
        manager.commitUpdates();
        for (const enemy of manager.getActiveObjects()) {
          const subType = enemy.subType;
          if (!remaining.has(subType)) continue;
          const actionDriven = subType === 'pink_namazu' || subType === 'turret';
          expect(Boolean(enemy.getComponent(GenericAnimationComponent)), subType).toBe(actionDriven);
          expect(Boolean(enemy.getComponent(EnemyAnimationComponent)), subType).toBe(!actionDriven);
          remaining.delete(subType);
        }
        if (remaining.size === 0) return;
      }
    }
    expect([...remaining], 'enemy types missing from the shipped campaign').toEqual([]);
  });

  test('turret AI firing art starts and stops on the action frame', async () => {
    const turret = (await loadLevelWithEnemy('turret'))!;
    const player = manager.getPlayer()!;
    const sprite = turret.getComponent(SpriteComponent)!;
    const time = new TimeSystem();
    sSystemRegistry.timeSystem = time;
    const position = turret.getPosition();
    player.setPosition(position.x + turret.facingDirection.x * 100, position.y + 100);
    time.update(2); // Initial attack delay has elapsed.
    turret.update(1 / 60, time.getGameTime());
    expect(turret.getCurrentAction()).toBe(ActionType.ATTACK);
    expect(sprite.getCurrentDraw()?.sprite).toBe('object_gunturret02');

    // Leaving range does not truncate its one-second automatic burst.
    player.setPosition(position.x + 2000, position.y);
    time.update(0.5);
    turret.update(0.5, time.getGameTime());
    expect(turret.getCurrentAction()).toBe(ActionType.ATTACK);
    expect(sprite.getCurrentAnimation()?.name).toBe('attack');
    time.update(0.51);
    turret.update(1 / 60, time.getGameTime());
    expect(turret.getCurrentAction()).toBe(ActionType.IDLE);
    expect(sprite.getCurrentDraw()?.sprite).toBe('object_gunturret01');
    expect(sprite.getCurrentAnimation()?.name).toBe('idle');
  });

  test('shipped sewer turrets retain the original vertical reach and facing boundary', async () => {
    const level = new LevelSystem();
    level.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
    expect(await level.loadLevel(resourceToLevelId.level_3_3_sewer)).toBe(true);
    manager.commitUpdates();
    const player = manager.getPlayer()!;
    const turrets = manager.getActiveObjects().filter(object => object.subType === 'turret');
    expect(turrets.length).toBeGreaterThan(0);
    const time = new TimeSystem();
    sSystemRegistry.timeSystem = time;
    for (const turret of turrets) {
      const control = componentOf<AttackAtDistanceComponent>(turret, AttackAtDistanceComponent)!;
      expect(control).not.toBeNull();
      for (const vertical of [-301, -299, 299, 301]) {
        player.setPosition(turret.getPosition().x + turret.facingDirection.x,
          turret.getPosition().y + turret.height + vertical - player.height);
        turret.setCurrentAction(ActionType.IDLE);
        time.update(2); // Previous burst/cooldown fully elapsed; no component reset.
        control.update(1 / 60, turret);
        expect(turret.getCurrentAction()).toBe(Math.abs(vertical) < 300
          ? ActionType.ATTACK : ActionType.IDLE);
      }
      player.setPosition(turret.getPosition().x,
        turret.getPosition().y + turret.height + 100 - player.height);
      turret.setCurrentAction(ActionType.IDLE);
      time.update(2);
      control.update(1 / 60, turret);
      expect(turret.getCurrentAction()).toBe(turret.facingDirection.x >= 0
        ? ActionType.ATTACK : ActionType.IDLE);
    }
  });

  test('possessed turret firing art follows Fly press/release without an extra frame', async () => {
    const turret = (await loadLevelWithEnemy('turret'))!;
    const sprite = turret.getComponent(SpriteComponent)!;
    const input = new InputSystem();
    sSystemRegistry.inputSystem = input;
    new GameObjectFactory(manager).setSystemRegistry(sSystemRegistry);
    // Stage only the already-possessed mode. possession.test.ts separately
    // reaches this swap through a real orb and checks repeated release.
    componentOf<ChangeComponentsComponent>(turret, ChangeComponentsComponent)!.activate(turret);
    expect(componentOf<GhostComponent>(turret, GhostComponent)).not.toBeNull();
    let time = 1;
    for (let burst = 0; burst < 3; burst++) {
      input.setVirtualButton('fly', true);
      turret.update(1 / 60, time += 1 / 60);
      expect(turret.getCurrentAction()).toBe(ActionType.ATTACK);
      expect(sprite.getCurrentDraw()?.sprite).toBe('object_gunturret02');
      for (let frame = 0; frame < 20; frame++) turret.update(1 / 60, time += 1 / 60);
      input.setVirtualButton('fly', false);
      turret.update(1 / 60, time += 1 / 60);
      expect(turret.getCurrentAction()).toBe(ActionType.IDLE);
      expect(sprite.getCurrentAnimation()?.name).toBe('idle');
      expect(sprite.getCurrentDraw()?.sprite).toBe('object_gunturret01');
    }
    const vulnerability = turret.getComponent(DynamicCollisionComponent)!.getVulnerabilityVolumes();
    expect(vulnerability).toHaveLength(1);
    expect(vulnerability![0].getHitType()).toBe(HitType.POSSESS);
  });

  test('rendering an enemy draws one of its own frames', async () => {
    const brobot = await loadLevelWithEnemy('brobot');
    const sprite = componentOf<SpriteComponent>(brobot!, SpriteComponent)!;

    calls.length = 0;
    sprite.update(1 / 60, brobot!);
    brobot!.render();

    expect(calls.length).toBe(1);
    expect(calls[0].sprite).toMatch(/^brobot_(idle|walk)0\d$/);
  });

  test('the drawn frame advances with the animation', async () => {
    const brobot = await loadLevelWithEnemy('brobot');
    const sprite = componentOf<SpriteComponent>(brobot!, SpriteComponent)!;

    calls.length = 0;
    for (let i = 0; i < 12; i++) {
      sprite.update(1 / 24, brobot!);
      brobot!.render();
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
    skeleton!.render();

    expect(calls[0].sprite).toMatch(/^skeleton_attack/);
  });

  test('single-loop objects draw themselves too', async () => {
    // Collectibles, blocks, signs and spawners have no state to select
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
      object!.render();
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
      object!.render();
      expect(calls.length, type).toBe(1);
      expect(calls[0].sprite, type).toMatch(
        type === 'door' ? /^object_door_(red|blue|green)0\d$/ : /^object_button_/
      );
    }
  });

  for (const shotType of [GameObjectType.ENERGY_BALL, GameObjectType.WANDA_SHOT]) {
    test(`a runtime-spawned ${shotType} draws exactly once above actors`, async () => {
      // Projectiles come from GameObjectFactory rather than level data, so they
      // need the same sprite attachment LevelSystem gives level-placed objects.
      const factory = new GameObjectFactory(manager);
      factory.setRenderSystem(sSystemRegistry.renderSystem!);
      const shot = factory.spawn(shotType, 100, 100);
      expect(shot, `factory did not spawn ${shotType}`).not.toBeNull();
      manager.commitUpdates();

      const sprite = componentOf<SpriteComponent>(shot!, SpriteComponent);
      expect(sprite, 'projectile has no SpriteComponent').not.toBeNull();

      calls.length = 0;
      sprite!.update(1 / 60, shot!);
      shot!.render();
      expect(calls.length).toBe(1);
      expect(calls[0].sprite).toMatch(/^energy_ball0\d$/);
      expect(calls[0].z).toBe(SortConstants.PROJECTILE);
      expect(sprite!.getCurrentAnimation()?.frames.map((frame) => frame.duration))
        .toEqual([1 / 24, 1 / 24, 1 / 24, 1 / 24]);
    });
  }

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

    // The wind-up (attack01) holds for 5 frames at 24 FPS in the original, so
    // the swing does not land until after that; advancing a generic 3 frames
    // is still inside the wind-up.
    sprite.update(1 / 24 * 3 + 0.001, skeleton!);
    expect(collision.getAttackVolumes(), 'still winding up').toBeNull();

    sprite.update(1 / 24 * 2 + 0.001, skeleton!);
    // Contact frame (attack03): armed.
    expect(collision.getAttackVolumes()).not.toBeNull();
  });
});

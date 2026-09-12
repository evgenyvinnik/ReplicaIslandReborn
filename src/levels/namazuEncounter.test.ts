import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CameraSystem } from '../engine/CameraSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObject } from '../entities/GameObject';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { SleeperComponent } from '../entities/components/SleeperComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { GenericAnimationComponent } from '../entities/components/GenericAnimationComponent';
import { EnemyAnimation, EnemyAnimationComponent } from '../entities/components/EnemyAnimationComponent';
import { createEnemyAnimations } from '../data/enemyAnimations';
import { resourceToLevelId } from '../data/levelTree';
import { ActionType } from '../types';
import { LevelSystem } from './LevelSystemNew';

const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const asset = file(join(import.meta.dir, '../../public', url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '')));
    return await asset.exists() ? new Response(await asset.arrayBuffer()) : new Response(null, { status: 404 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });
afterEach(() => { sSystemRegistry.reset(); });

async function encounter(resource = 'level_4_2_underground'): Promise<{
  enemy: GameObject;
  sprite: SpriteComponent;
  volumes: DynamicCollisionComponent;
  camera: CameraSystem;
  step: () => void;
}> {
  sSystemRegistry.reset();
  const manager = new GameObjectManager();
  const camera = new CameraSystem(480, 320);
  sSystemRegistry.cameraSystem = camera;
  const level = new LevelSystem();
  const collision = new CollisionSystem();
  expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  level.setSystems(collision, manager, new HotSpotSystem());
  expect(await level.loadLevel(resourceToLevelId[resource])).toBe(true);
  manager.commitUpdates();
  const found = manager.getActiveObjects().find(object => object.subType === 'pink_namazu');
  if (!found) throw new Error(`No Pink Namazu in ${resource}`);
  const enemy = found;
  const sprite = enemy.getComponent(SpriteComponent)!;
  const volumes = enemy.getComponent(DynamicCollisionComponent)!;
  camera.setPosition(enemy.getCenteredPositionX(), enemy.getCenteredPositionY());
  let time = 1;
  function step(): void {
    time += 1 / 60;
    // The authored enemy and terrain are unchanged; isolate its own cycle
    // from other enemies' camera shakes and the player's combat decisions.
    enemy.update(1 / 60, time);
    camera.update(1 / 60);
  }
  for (let i = 0; i < 120; i++) step();
  return { enemy, sprite, volumes, camera, step };
}

test('all seven shipped Pink Namazu encounters show their stationary wake-up warning', async () => {
  for (const resource of ['level_1_8_island', 'level_2_6_grass', 'level_2_7_grass',
    'level_3_1_grass', 'level_4_2_underground', 'level_4_8_underground', 'level_4_9_underground']) {
    const { enemy, sprite, camera, step } = await encounter(resource);
    camera.shake(15, 0.15);
    step();
    expect(enemy.getCurrentAction()).toBe(ActionType.MOVE);
    expect(sprite.getCurrentAnimation()?.name).toBe('walk');
    expect(sprite.getCurrentDraw()?.sprite).toBe('pinknamazu_eyeopen');
    expect(enemy.getComponent(GenericAnimationComponent), resource).not.toBeNull();
    expect(enemy.getComponent(EnemyAnimationComponent), resource).toBeNull();
    for (let i = 0; i < 60; i++) step();
    expect(enemy.getCurrentAction()).toBe(ActionType.MOVE);
    expect(sprite.getCurrentDraw()?.sprite).toBe('pinknamazu_stand');
    expect(sprite.animationFinished()).toBe(true);
  }
});

test('the wake blink plays once, then holds for the remaining warning delay', () => {
  const wake = createEnemyAnimations('pink_namazu')!.get(EnemyAnimation.MOVE)!;
  expect(wake.loop).toBe(false);
  expect(wake.frames.reduce((sum, frame) => sum + frame.duration!, 0)).toBe(0.5);
});

test('a shipped Namazu wakes, jumps, slams once, sleeps, and can repeat', async () => {
  const { enemy, sprite, volumes, camera, step } = await encounter('level_2_7_grass');
  const shakes: Array<[number, number]> = [];
  const shake = camera.shake.bind(camera);
  camera.shake = (magnitude, duration): void => { shakes.push([magnitude, duration]); shake(magnitude, duration); };
  expect(enemy.touchingGround()).toBe(true);
  for (let cycle = 0; cycle < 2; cycle++) {
    const startY = enemy.getPosition().y;
    shake(15, 0.15); // External stomp shake; subsequent shakes must belong to the slam.
    step();
    expect(enemy.getCurrentAction()).toBe(ActionType.MOVE);
    expect(sprite.getCurrentDraw()?.sprite).toBe('pinknamazu_eyeopen');
    for (let i = 0; i < 89; i++) step();
    expect(enemy.getCurrentAction()).toBe(ActionType.MOVE);
    expect(volumes.getAttackVolumes()).toBeNull();
    let minY = startY;
    let sawAttack = false;
    for (let i = 0; i < 120; i++) {
      step();
      minY = Math.min(minY, enemy.getPosition().y);
      if (enemy.getCurrentAction() === ActionType.ATTACK) {
        sawAttack = true;
        expect(sprite.getCurrentDraw()?.sprite).toBe('pinknamazu_jump');
        expect(volumes.getAttackVolumes()).toHaveLength(1);
      }
    }
    expect(sawAttack).toBe(true);
    expect(minY).toBeLessThan(startY - 20);
    expect(shakes).toHaveLength(cycle + 1);
    expect(shakes[cycle]).toEqual([25, 0.3]);
    expect(enemy.getCurrentAction()).toBe(ActionType.IDLE);
    expect(sprite.getCurrentAnimation()?.name).toBe('idle');
    expect(volumes.getAttackVolumes()).toBeNull();
    expect(enemy.touchingGround()).toBe(true);
  }
});

test('shake visibility tests the original feet anchor, not the head of the 128px sprite', () => {
  const camera = new CameraSystem(480, 320);
  camera.setPosition(240, 160); // View [0, 480] × [0, 320].
  sSystemRegistry.cameraSystem = camera;
  for (const [top, wakes] of [[-160, true], [300, false]] as const) {
    const enemy = new GameObject();
    enemy.width = enemy.height = 128;
    enemy.setPosition(200, top);
    camera.shake(15, 0.15);
    new SleeperComponent().update(1 / 60, enemy);
    expect(enemy.getCurrentAction()).toBe(wakes ? ActionType.MOVE : ActionType.IDLE);
  }
});

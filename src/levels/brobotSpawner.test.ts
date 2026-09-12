import { afterEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CameraSystem } from '../engine/CameraSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { TimeSystem } from '../engine/TimeSystem';
import { resourceToLevelId } from '../data/levelTree';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { LaunchProjectileComponent } from '../entities/components/LaunchProjectileComponent';
import { SolidSurfaceComponent, setSolidSurfaceSystemRegistry } from '../entities/components/SolidSurfaceComponent';
import { LevelSystem } from './LevelSystemNew';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; sSystemRegistry.reset(); });

test('both shipped Brobot machine surfaces match the original upright trapezoid', async () => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const path = String(input).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    return new Response(await file(join(import.meta.dir, '../../public', path)).arrayBuffer());
  }) as typeof fetch;
  const manager = new GameObjectManager();
  const collision = new CollisionSystem();
  const level = new LevelSystem();
  level.setSystems(collision, manager, new HotSpotSystem());
  sSystemRegistry.register(collision, 'collision');
  setSolidSurfaceSystemRegistry(sSystemRegistry);
  expect(await level.loadLevel(resourceToLevelId.level_0_3_lab)).toBe(true);
  manager.commitUpdates();
  const machines = manager.getActiveObjects().filter(o => o.subType === 'brobot_spawner');
  expect(machines).toHaveLength(2);
  for (const machine of machines) {
    const solid = machine.getComponent(
      SolidSurfaceComponent as unknown as new (...args: unknown[]) => SolidSurfaceComponent
    )!;
    const position = machine.getPosition();
    const surfaces = solid.getSurfaces();
    expect(surfaces.map(s => [s.start.x, s.start.y, s.end.x, s.end.y]))
      .toEqual([[0, 64, 8, 5], [8, 5, 61, 31], [61, 31, 61, 64]]);
    expect(surfaces[1].normal.y).toBeLessThan(0);
    expect(surfaces[1].normal.length()).toBeCloseTo(1, 5);
    solid.update(0, machine);
    collision.updateTemporarySurfaces();
    // A real swept body must land on the art's upper slope, in either facing.
    const hit = collision.sweepTemporaryBox(
      position.x + 24, position.y - 40, 16, 16, 0, 100, manager.getPlayer()!
    );
    expect(hit).not.toBeNull();
    expect(hit!.normalY).toBeLessThan(0);
    expect(hit!.y + 16).toBeGreaterThanOrEqual(position.y + 5);
    expect(hit!.y + 16).toBeLessThan(position.y + 32);
  }
});

function runtimeMachine(): { manager: GameObjectManager; advance: (dt: number) => void } {
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  const time = new TimeSystem();
  sSystemRegistry.gameObjectManager = manager;
  sSystemRegistry.gameObjectFactory = factory;
  sSystemRegistry.timeSystem = time;
  const machine = manager.createObject();
  machine.width = machine.height = 64;
  machine.setPosition(100, 100);
  machine.activationRadius = -1;
  const launcher = new LaunchProjectileComponent({
    objectTypeToSpawn: GameObjectType.ENEMY_BROBOT,
    delayBeforeFirstSet: 3, trackProjectiles: true, maxTrackedProjectiles: 1,
    offsetX: 36, offsetY: 50, velocityX: 100, velocityY: -300,
  });
  machine.addComponent(launcher);
  manager.add(machine);
  manager.commitUpdates();
  const advance = (dt: number): void => { time.update(dt); launcher.update(dt, machine); };
  advance(0);
  advance(3.01);
  return { manager, advance };
}

test('a pending launched Brobot still occupies its machine slot before commit', () => {
  const { manager, advance } = runtimeMachine();
  advance(0);
  advance(10);
  manager.commitUpdates();
  expect(manager.getActiveObjects().filter(o => o.subType === 'brobot')).toHaveLength(1);
});

test('live spawned Brobots survive camera deactivation and block duplicates until real removal', () => {
  const { manager, advance } = runtimeMachine();
  manager.commitUpdates();
  const robot = manager.getActiveObjects().find(o => o.subType === 'brobot')!;
  const originalId = robot.id;
  expect(robot.destroyOnDeactivation).toBe(false);
  manager.setCamera({
    getFocusPositionX: () => -108, getFocusPositionY: () => 4,
    getViewportWidth: () => 480, getViewportHeight: () => 320,
  } as CameraSystem);
  robot.setPosition(2000, 2000);
  manager.update(0, 3.01);
  expect(manager.getInactiveObjectCount()).toBe(1);
  advance(0);
  advance(10);
  manager.commitUpdates();
  expect(manager.getActiveObjects().filter(o => o.subType === 'brobot')).toHaveLength(0);
  expect(manager.getInactiveObjectCount()).toBe(1);
  robot.setPosition(200, 100);
  manager.update(0, 13.01);
  expect(manager.getActiveObjects().filter(o => o.subType === 'brobot')).toEqual([robot]);
  expect(robot.id).toBe(originalId);
  robot.setPosition(2000, 2000);
  manager.update(0, 13.01);
  manager.remove(robot);
  manager.commitUpdates();
  expect(manager.getInactiveObjectCount()).toBe(0);
  advance(0);
  advance(2.99);
  manager.commitUpdates();
  expect(manager.getActiveObjects().filter(o => o.subType === 'brobot')).toHaveLength(0);
  advance(0.02);
  manager.commitUpdates();
  const replacement = manager.getActiveObjects().filter(o => o.subType === 'brobot');
  expect(replacement).toHaveLength(1);
  expect(replacement[0].id).not.toBe(originalId);
});

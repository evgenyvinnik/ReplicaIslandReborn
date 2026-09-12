import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObject } from '../entities/GameObject';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { MovementComponent } from '../entities/components/MovementComponent';
import { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { ChangeComponentsComponent } from '../entities/components/ChangeComponentsComponent';
import { GhostComponent } from '../entities/components/GhostComponent';
import { SolidSurfaceComponent, setSolidSurfaceSystemRegistry } from '../entities/components/SolidSurfaceComponent';
import { resourceToLevelId } from '../data/levelTree';
import { HitType, Team } from '../types';
import { LevelSystem } from './LevelSystemNew';

const originalFetch = globalThis.fetch;
const ReactionClass = HitReactionComponent as unknown as new (...args: unknown[]) => HitReactionComponent;
const GhostClass = GhostComponent as unknown as new (...args: unknown[]) => GhostComponent;
const SwapClass = ChangeComponentsComponent as unknown as new (...args: unknown[]) => ChangeComponentsComponent;
beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const asset = file(join(import.meta.dir, '../../public', url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '')));
    return await asset.exists() ? new Response(await asset.arrayBuffer()) : new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });
afterEach(() => { sSystemRegistry.reset(); });

async function rig(resource?: string): Promise<{
  manager: GameObjectManager; factory: GameObjectFactory; collision: CollisionSystem;
}> {
  const manager = new GameObjectManager();
  const collision = new CollisionSystem();
  const factory = new GameObjectFactory(manager);
  factory.setCollisionSystem(collision);
  factory.setSystemRegistry(sSystemRegistry);
  sSystemRegistry.register(manager, 'gameObject');
  expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  if (resource) {
    const level = new LevelSystem();
    level.setSystems(collision, manager, new HotSpotSystem());
    expect(await level.loadLevel(resourceToLevelId[resource])).toBe(true);
    manager.commitUpdates();
  }
  // Keep the real loaded enemy configuration, but stage impacts in a closed test room.
  collision.setTileCollision(Array.from({ length: 400 }, (_, i) =>
    i % 20 === 0 || i % 20 === 19 || i < 20 || i >= 380 ? 1 : -1), 20, 20, 32, 32);
  return { manager, factory, collision };
}

function impact(enemy: GameObject, directionX: number, directionY: number): number {
  const movement = enemy.getComponent(MovementComponent)!;
  expect(movement).not.toBeNull();
  enemy.setPosition(300, 250);
  enemy.setVelocity(directionX * 300, directionY * 300);
  enemy.setAcceleration(0, 0);
  enemy.getImpulse().zero();
  for (let frame = 0; frame < 150; frame++) {
    enemy.setGameTime(1 + frame / 60);
    // Isolate response from AI/gravity; this is the production movement and collision path.
    movement.update(1 / 60, enemy);
    const outgoing = enemy.getVelocity().x * directionX + enemy.getVelocity().y * directionY;
    if (outgoing <= 0) return outgoing;
  }
  throw new Error(`No impact for ${enemy.subType} in direction ${directionX},${directionY}`);
}

const placed = [
  ['brobot', 'level_3_4_sewer', 0.4],
  ['onion', 'level_1_8_island', 0.2],
  ['snailbomb', 'level_3_4_sewer', 0.1],
  ['mudman', 'level_2_2_grass', 0.1],
  ['skeleton', 'level_2_2_grass', 0.1],
  ['pink_namazu', 'level_2_7_grass', 0.1],
  ['wanda', 'level_0_1_sewer_wanda', 0],
] as const;

for (const [subType, resource, bounce] of placed) {
  test(`shipped ${subType} retains its original collision restitution on all four sides`, async () => {
    const { manager } = await rig(resource);
    const enemy = manager.getActiveObjects().find(o => o.subType === subType)!;
    expect(enemy).toBeDefined();
    for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      expect(impact(enemy, x, y)).toBeCloseTo(-300 * bounce);
    }
  });
}

for (const [kind, bounce] of [[GameObjectType.ENEMY_BROBOT, 0.4], [GameObjectType.ENEMY_SNAILBOMB, 0.1]] as const) {
  test(`runtime ${kind} uses the same collision restitution as its level-placed version`, async () => {
    const { factory } = await rig();
    const enemy = factory.spawn(kind, 300, 250)!;
    for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      expect(impact(enemy, x, y)).toBeCloseTo(-300 * bounce);
    }
  });
}

for (const runtime of [false, true]) {
  test(`${runtime ? 'runtime' : 'placed'} Brobot possession swaps out bounce without replacing movement`, async () => {
    const { manager, factory } = await rig(runtime ? undefined : 'level_3_4_sewer');
    const robot = runtime ? factory.spawn(GameObjectType.ENEMY_BROBOT, 300, 250)!
      : manager.getActiveObjects().find(o => o.subType === 'brobot')!;
    const movement = robot.getComponent(MovementComponent)!;
    const reaction = robot.getComponent(ReactionClass)!;
    const orb = new GameObject();
    orb.team = Team.PLAYER;
    expect(reaction.receivedHit(robot, orb, HitType.POSSESS)).toBe(true);
    expect(robot.getComponent(GhostClass)).not.toBeNull();
    expect(robot.getComponent(MovementComponent)).toBe(movement);
    expect(impact(robot, 1, 0)).toBeCloseTo(0);
    expect(impact(robot, 0, 1)).toBeCloseTo(0);
    // Exercise the reverse swap in isolation. Normal lethal release is covered separately.
    robot.getComponent(SwapClass)!.activate(robot);
    expect(robot.getComponent(GhostClass)).toBeNull();
    expect(robot.getComponent(MovementComponent)).toBe(movement);
    expect(impact(robot, 1, 0)).toBeCloseTo(-120);
    expect(impact(robot, 0, 1)).toBeCloseTo(-120);
  });
}

test('a solid-object wall reflects a Brobot normally and stops it while possessed', async () => {
  const { factory, collision } = await rig();
  sSystemRegistry.register(collision, 'collision');
  setSolidSurfaceSystemRegistry(sSystemRegistry);
  const wall = new GameObject();
  wall.setPosition(400, 0);
  const surface = new SolidSurfaceComponent();
  surface.createRectangle(32, 640);
  wall.addComponent(surface);
  wall.update(0, 0);
  collision.updateTemporarySurfaces();
  const robot = factory.spawn(GameObjectType.ENEMY_BROBOT, 300, 250)!;
  expect(impact(robot, 1, 0)).toBeCloseTo(-120);
  expect(robot.getPosition().x + 48).toBeLessThanOrEqual(400);
  const orb = new GameObject();
  orb.team = Team.PLAYER;
  expect(robot.getComponent(ReactionClass)!.receivedHit(robot, orb, HitType.POSSESS)).toBe(true);
  expect(impact(robot, 1, 0)).toBeCloseTo(0);
  expect(robot.getPosition().x + 48).toBeLessThanOrEqual(400);
});

/**
 * Reloading a level - which is what dying does - has to leave it fresh.
 *
 * Death runs `levelSys.loadLevel(currentLevel)` again on the same
 * LevelSystem, GameObjectManager and CollisionSystem. If any of them keeps
 * something from the previous attempt, the level degrades every time you die:
 * objects accumulate, the player fails to respawn, or collision tiles from the
 * old load survive. None of that raises an error - the level just gets
 * gradually stranger, which is the worst kind of bug to report.
 */

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { ChannelSystem } from '../engine/ChannelSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import type { GameObject } from '../entities/GameObject';

const pub = join(import.meta.dir, '../../public');
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = (async (i: Parameters<typeof fetch>[0]): Promise<Response> => {
    const raw = typeof i === 'string' ? i : i instanceof URL ? i.pathname : new URL(i.url).pathname;
    const p = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const f = file(join(pub, p));
    if (!(await f.exists())) return new Response(null, { status: 404 });
    return new Response(await f.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });

test('reloading the same level ten times leaves it identical each time', async () => {
  sSystemRegistry.reset();
  const collision = new CollisionSystem();
  const manager = new GameObjectManager();
  const hotSpots = new HotSpotSystem();
  const camera = new CameraSystem(480, 320);
  const levelSystem = new LevelSystem();
  levelSystem.setSystems(collision, manager, hotSpots);
  manager.setCamera(camera);
  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(new GameObjectCollisionSystem(), 'gameObjectCollision');
  sSystemRegistry.register(new ChannelSystem(), 'channel');
  sSystemRegistry.register(new TimeSystem(), 'time');
  expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);

  const levelId = resourceToLevelId.level_0_2_lab;
  const counts: number[] = [];
  const spawns: string[] = [];

  for (let attempt = 0; attempt < 10; attempt++) {
    expect(await levelSystem.loadLevel(levelId), `reload ${attempt}`).toBe(true);
    manager.commitUpdates();

    // Everything the level placed, active or culled.
    let total = 0;
    manager.forEach(() => { total++; });
    total += manager.getInactiveObjectCount();
    counts.push(total);

    const player = manager.getPlayer() as GameObject | null;
    expect(player, `reload ${attempt} lost the player`).toBeTruthy();
    if (player) {
      const p = player.getPosition();
      spawns.push(`${Math.round(p.x)},${Math.round(p.y)}`);
    }
  }

  // Every reload produced the same population and the same spawn point.
  expect(new Set(counts).size, `object count drifted across reloads: ${counts.join(',')}`).toBe(1);
  expect(new Set(spawns).size, `spawn point drifted: ${spawns.join(' ')}`).toBe(1);
});

test('the collision grid is rebuilt, not appended to, on reload', async () => {
  sSystemRegistry.reset();
  const collision = new CollisionSystem();
  const manager = new GameObjectManager();
  const hotSpots = new HotSpotSystem();
  const camera = new CameraSystem(480, 320);
  const levelSystem = new LevelSystem();
  levelSystem.setSystems(collision, manager, hotSpots);
  manager.setCamera(camera);
  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(new ChannelSystem(), 'channel');
  sSystemRegistry.register(new TimeSystem(), 'time');
  expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);

  // Load a wide level, then a different one, then back. A grid that is not
  // rebuilt leaves the previous level's walls in place - the classic symptom
  // is invisible geometry after a death or a level change.
  const solidityOf = async (resource: string): Promise<string> => {
    expect(await levelSystem.loadLevel(resourceToLevelId[resource])).toBe(true);
    manager.commitUpdates();
    const { width, height } = levelSystem.getLevelSize();
    let signature = '';
    for (let y = 0; y < Math.round(height / 32); y += 3) {
      for (let x = 0; x < Math.round(width / 32); x += 3) {
        signature += collision.isTileSolid(x, y) ? '1' : '0';
      }
    }
    return signature;
  };

  const first = await solidityOf('level_0_2_lab');
  await solidityOf('level_1_1_island');
  const firstAgain = await solidityOf('level_0_2_lab');

  expect(firstAgain, 'the collision grid kept state from another level').toBe(first);
});

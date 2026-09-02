/**
 * Draw order, checked against the original's SortConstants.
 *
 * The port used to leave every object's priority at 0, so things drew in
 * whatever order the object manager held them. That looked right often enough
 * to hide the problem, but gave no way to express "in front of that" - which
 * is exactly what the glow halo, the jet fire and The Source's layers need.
 *
 * Each expectation here is the setPriority() call in the matching spawn
 * function of GameObjectFactory.java.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { SortConstants } from '../engine/SortConstants';
import { LevelSystem } from './LevelSystemNew';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import type { RenderSystem } from '../engine/RenderSystem';
import type { GameObject } from '../entities/GameObject';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

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

describe('draw order', () => {
  let manager: GameObjectManager;

  beforeEach(() => {
    sSystemRegistry.reset();
    manager = new GameObjectManager();
    manager.setCamera(new CameraSystem(480, 320));
    sSystemRegistry.register(
      { hasSprite: (): boolean => true, drawSprite: (): void => {} } as unknown as RenderSystem,
      'render'
    );
    sSystemRegistry.register(manager, 'gameObject');
  });

  interface SpawnRecord {
    type: string;
    subType: string;
    priority: number | null;
  }

  function priorityOf(object: GameObject): number | null {
    const sprite = object.getComponent(
      SpriteComponent as unknown as new (...a: unknown[]) => SpriteComponent
    );
    return sprite?.getCurrentDraw()?.priority ?? null;
  }

  /**
   * What every object in the campaign draws at. The priority is read while the
   * level is still loaded - `manager.reset()` clears the objects' components,
   * so holding the GameObjects themselves gives back empty shells.
   */
  async function collectSpawnedObjects(): Promise<SpawnRecord[]> {
    const seen: SpawnRecord[] = [];
    for (const group of linearLevelTree) {
      for (const entry of group.levels) {
        const levelSystem = new LevelSystem();
        levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
        if (!(await levelSystem.loadLevel(resourceToLevelId[entry.resource]))) continue;
        manager.commitUpdates();
        for (const object of manager.getActiveObjects()) {
          seen.push({
            type: object.type,
            subType: object.subType,
            priority: priorityOf(object),
          });
        }
        manager.reset();
      }
    }
    return seen;
  }

  test('the constants match the original', () => {
    // Straight from SortConstants.java.
    expect(SortConstants.BACKGROUND_START).toBe(-100);
    expect(SortConstants.THE_SOURCE_START).toBe(-5);
    expect(SortConstants.FOREGROUND).toBe(0);
    expect(SortConstants.EFFECT).toBe(5);
    expect(SortConstants.GENERAL_OBJECT).toBe(10);
    expect(SortConstants.GENERAL_ENEMY).toBe(15);
    expect(SortConstants.NPC).toBe(15);
    expect(SortConstants.PLAYER).toBe(20);
    expect(SortConstants.FOREGROUND_EFFECT).toBe(30);
    expect(SortConstants.PROJECTILE).toBe(40);
    expect(SortConstants.FOREGROUND_OBJECT).toBe(50);
    expect(SortConstants.OVERLAY).toBe(70);
    expect(SortConstants.HUD).toBe(100);
    expect(SortConstants.FADE).toBe(200);
  });

  test('spawned objects carry the original\'s priorities', async () => {
    const objects = await collectSpawnedObjects();
    expect(objects.length).toBeGreaterThan(50);

    // subType -> the SortConstants value its spawn function sets.
    const expected: Record<string, number> = {
      // spawnEnemy* : GENERAL_ENEMY
      brobot: SortConstants.GENERAL_ENEMY,
      skeleton: SortConstants.GENERAL_ENEMY,
      karaguin: SortConstants.GENERAL_ENEMY,
      // spawnEnemyWanda / Kyle / Kabocha : NPC
      wanda: SortConstants.NPC,
      kyle: SortConstants.NPC,
      kabocha: SortConstants.NPC,
      // spawnObjectTurret : GENERAL_OBJECT, despite being an enemy
      turret: SortConstants.GENERAL_OBJECT,
    };

    const checked = new Set<string>();
    for (const object of objects) {
      const want = expected[object.subType];
      if (want === undefined || object.priority === null) continue;
      expect(object.priority, `${object.subType} draws at the wrong priority`).toBe(want);
      checked.add(object.subType);
    }
    // Guard against the assertions silently matching nothing.
    expect(checked.size).toBeGreaterThan(3);
  });

  test('doors draw in front of ordinary objects', async () => {
    const objects = await collectSpawnedObjects();
    const door = objects.find((o) => o.type === 'door' && o.priority !== null);
    expect(door, 'no level spawns a door').toBeDefined();
    // Original: spawnObjectDoor uses FOREGROUND_OBJECT.
    expect(door!.priority).toBe(SortConstants.FOREGROUND_OBJECT);
  });

  test('collectibles draw as general objects', async () => {
    const objects = await collectSpawnedObjects();
    let checked = 0;
    for (const type of ['coin', 'ruby', 'diary']) {
      const item = objects.find((o) => o.type === type && o.priority !== null);
      if (!item) continue;
      expect(item.priority, `${type} draws at the wrong priority`)
        .toBe(SortConstants.GENERAL_OBJECT);
      checked++;
    }
    expect(checked, 'no collectibles were checked').toBeGreaterThan(0);
  });

  test('the layering an object needs is expressible', () => {
    // The three cases that motivated this: each has to sit next to its owner,
    // which a flat priority of 0 cannot express.
    expect(SortConstants.PLAYER - 1).toBeLessThan(SortConstants.PLAYER);      // jet fire
    expect(SortConstants.PLAYER + 1).toBeGreaterThan(SortConstants.PLAYER);   // glow, sparks
    expect(SortConstants.THE_SOURCE_START + 4).toBeLessThan(SortConstants.FOREGROUND);

    // And the broad ordering the game depends on.
    expect(SortConstants.BACKGROUND_START).toBeLessThan(SortConstants.FOREGROUND);
    expect(SortConstants.GENERAL_ENEMY).toBeLessThan(SortConstants.PLAYER);
    expect(SortConstants.PLAYER).toBeLessThan(SortConstants.PROJECTILE);
    expect(SortConstants.PROJECTILE).toBeLessThan(SortConstants.FOREGROUND_OBJECT);
    expect(SortConstants.FOREGROUND_OBJECT).toBeLessThan(SortConstants.HUD);
    expect(SortConstants.HUD).toBeLessThan(SortConstants.FADE);
  });
});

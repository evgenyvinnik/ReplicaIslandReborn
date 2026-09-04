/**
 * Object activation radii, checked against GameObjectFactory.java.
 *
 * The original derives four values from the screen size in its constructor:
 *
 *   screenSizeRadius = hypot(gameWidth / 2, gameHeight / 2)   // 288.4 at 480x320
 *   tight  = screenSizeRadius + 128                           // 416.4
 *   normal = screenSizeRadius * 1.25                          // 360.6
 *   wide   = screenSizeRadius * 2                             // 576.9
 *   always = -1
 *
 * and every spawn function picks one. The port had invented its own numbers -
 * 100 for collectibles, 200 for most enemies, 2000 for story NPCs - all far
 * tighter than the original's, so enemies stayed frozen until the player was
 * nearly touching them instead of waking a screen away. The player himself was
 * left at the default of 0.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

const SCREEN_SIZE_RADIUS = Math.sqrt(240 * 240 + 160 * 160);
const TIGHT = SCREEN_SIZE_RADIUS + 128;
const NORMAL = SCREEN_SIZE_RADIUS * 1.25;
const ALWAYS = -1;

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const raw = typeof input === 'string'
      ? input
      : input instanceof URL ? input.pathname : new URL(input.url).pathname;
    const pathname = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const f = file(join(publicDirectory, pathname));
    if (!(await f.exists())) return new Response(null, { status: 404 });
    return new Response(await f.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });

/** Every object the campaign spawns, with the radius it was given. */
async function spawnedRadii(): Promise<Map<string, Set<number>>> {
  const found = new Map<string, Set<number>>();
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      sSystemRegistry.reset();
      const manager = new GameObjectManager();
      manager.setCamera(new CameraSystem(480, 320));
      sSystemRegistry.register(manager, 'gameObject');
      const levelSystem = new LevelSystem();
      levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
      if (!(await levelSystem.loadLevel(resourceToLevelId[entry.resource]))) continue;
      manager.commitUpdates();
      for (const object of manager.getActiveObjects()) {
        // Key by both: `terminal:kabocha` shares its subType with the NPC.
        const key = `${object.type}:${object.subType}`;
        if (!found.has(key)) found.set(key, new Set());
        found.get(key)!.add(object.activationRadius);
      }
    }
  }
  return found;
}

describe('activation radii', () => {
  test('the constants match the original\'s formulas', () => {
    expect(SCREEN_SIZE_RADIUS).toBeCloseTo(288.44, 1);
    expect(TIGHT).toBeCloseTo(416.44, 1);
    expect(NORMAL).toBeCloseTo(360.55, 1);
  });

  test('every spawned object uses one of the original\'s four values', async () => {
    const found = await spawnedRadii();
    expect(found.size).toBeGreaterThan(10);

    const allowed = [TIGHT, NORMAL, SCREEN_SIZE_RADIUS * 2, ALWAYS];
    const wrong: string[] = [];
    for (const [key, radii] of found) {
      for (const radius of radii) {
        if (!allowed.some((a) => Math.abs(a - radius) < 0.01)) {
          wrong.push(`${key}: ${radius.toFixed(1)}`);
        }
      }
    }
    expect(wrong, 'objects with an invented activation radius').toEqual([]);
  });

  test('the objects the original keeps always active are always active', async () => {
    const found = await spawnedRadii();
    // spawnPlayer, spawnEnemyWanda / Kyle / Kabocha, spawnObjectTheSource.
    for (const key of ['player:', 'npc:wanda', 'npc:kyle', 'npc:kabocha', 'enemy:the_source']) {
      const radii = found.get(key);
      if (!radii) continue;
      expect([...radii], `${key} should be always-active`).toEqual([ALWAYS]);
    }
  });

  test('ordinary enemies use the normal radius, not a tighter invented one', async () => {
    const found = await spawnedRadii();
    for (const key of ['enemy:brobot', 'enemy:skeleton', 'enemy:bat', 'enemy:sting',
                       'enemy:onion', 'enemy:karaguin', 'enemy:mudman']) {
      const radii = found.get(key);
      if (!radii) continue;
      for (const radius of radii) {
        expect(radius, `${key} activates at ${radius.toFixed(0)}`).toBeCloseTo(NORMAL, 1);
      }
    }
  });

  test('nothing the campaign spawns is left with the default radius of zero', () => {
    // GameObject.activationRadius defaults to 0, and updateActivation() tests
    // `dx*dx + dy*dy < radius*radius`, so 0 does not mean "always on" - it
    // means "never in range". An object that never gets one assigned is
    // deactivated on its first update and recycled: it comes back 0x0 with no
    // components, which looks like the object simply not existing.
    //
    // This is how the player's ghost was broken: configureGhost never set a
    // radius, so charging the ghost produced something that was destroyed
    // before it could be steered into anything.
    return spawnedRadii().then((found) => {
      const zeroed: string[] = [];
      for (const [key, radii] of found) {
        for (const radius of radii) {
          if (radius === 0) zeroed.push(key);
        }
      }
      expect([...new Set(zeroed)], 'these spawn with activationRadius 0').toEqual([]);
    });
  }, 60_000);
});

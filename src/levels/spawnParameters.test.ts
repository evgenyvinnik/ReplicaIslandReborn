/**
 * Per-object spawn parameters, against GameObjectFactory.java.
 *
 * Sizes, hit points, teams and background-collision boxes decide whether an
 * enemy fits through a gap, how many stomps it takes and who can hurt it. They
 * are transcribed by hand from fifteen separate spawn functions, and a wrong
 * one is quiet: the enemy still spawns, it is just the wrong shape.
 *
 * The collision boxes need converting. `bgcollision.setOffset(x, y)` measures
 * from the object's *bottom* in the original's Y-up space, so the Y-down
 * equivalent is `height - (offsetY + boxHeight)` - a brobot's setOffset(16, 0)
 * on a 64px object with a 48px box becomes an offset of 16, not 0.
 *
 * These are checked against objects the levels really spawn, not against the
 * source table, so a value that never reaches an object still fails.
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
import { Team } from '../types';
import type { GameObject } from '../entities/GameObject';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const raw = typeof input === 'string'
      ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
    const pathname = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const f = file(join(publicDirectory, pathname));
    if (!(await f.exists())) return new Response(null, { status: 404 });
    return new Response(await f.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });

/** One representative of each subType the campaign spawns. */
async function oneOfEach(): Promise<Map<string, GameObject>> {
  const found = new Map<string, GameObject>();
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
      for (const object of manager.getActiveObjects() as GameObject[]) {
        const key = `${object.type}:${object.subType}`;
        if (!found.has(key)) found.set(key, object);
      }
    }
  }
  return found;
}

/** object.width / object.height / object.life / object.team in the original. */
const EXPECTED: Record<string, { w: number; h: number; life: number; team?: Team }> = {
  'enemy:brobot': { w: 64, h: 64, life: 1, team: Team.ENEMY },
  'enemy:snailbomb': { w: 64, h: 64, life: 1, team: Team.ENEMY },
  'enemy:shadowslime': { w: 64, h: 64, life: 1, team: Team.ENEMY },
  'enemy:mudman': { w: 128, h: 128, life: 1, team: Team.ENEMY },
  'enemy:skeleton': { w: 64, h: 64, life: 1, team: Team.ENEMY },
  'enemy:karaguin': { w: 32, h: 32, life: 1, team: Team.ENEMY },
  'enemy:pink_namazu': { w: 128, h: 128, life: 1, team: Team.ENEMY },
  'enemy:bat': { w: 64, h: 32, life: 1, team: Team.ENEMY },
  'enemy:sting': { w: 64, h: 64, life: 1, team: Team.ENEMY },
  'enemy:onion': { w: 64, h: 64, life: 1, team: Team.ENEMY },
  'npc:wanda': { w: 64, h: 128, life: 1 },
  'npc:kyle': { w: 64, h: 128, life: 1 },
  'npc:kabocha': { w: 64, h: 128, life: 1 },
  // The bosses are the only three-hit enemies in the game.
  'enemy:evil_kabocha': { w: 128, h: 128, life: 3, team: Team.ENEMY },
  'enemy:rokudou': { w: 128, h: 128, life: 3, team: Team.ENEMY },
};

describe('spawn parameters', () => {
  test('sizes and hit points match the original', async () => {
    const found = await oneOfEach();
    expect(found.size).toBeGreaterThan(10);

    const wrong: string[] = [];
    let checked = 0;
    for (const [key, want] of Object.entries(EXPECTED)) {
      const object = found.get(key);
      if (!object) continue;
      checked++;
      if (object.width !== want.w || object.height !== want.h) {
        wrong.push(`${key}: ${object.width}x${object.height}, expected ${want.w}x${want.h}`);
      }
      if (object.life !== want.life) {
        wrong.push(`${key}: life ${object.life}, expected ${want.life}`);
      }
      if (want.team !== undefined && object.team !== want.team) {
        wrong.push(`${key}: team ${object.team}, expected ${want.team}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(checked, 'no spawned objects matched the table').toBeGreaterThan(6);
  }, 60_000);

  test('only the bosses take more than one hit', async () => {
    const found = await oneOfEach();
    const tough: string[] = [];
    for (const [key, object] of found) {
      if (!key.startsWith('enemy:')) continue;
      // The Source is a three-hit boss too, handled by its own component.
      if (key.endsWith('the_source')) continue;
      if (object.life > 1 && !key.includes('kabocha') && !key.includes('rokudou')) {
        tough.push(`${key}: life ${object.life}`);
      }
    }
    expect(tough, 'ordinary enemies should die in one stomp').toEqual([]);
  }, 60_000);

  test('flying enemies get no background collision box', async () => {
    // spawnEnemyKaraguin, Bat and Sting call no bgcollision.setSize at all -
    // they pass through terrain. Giving them a box would wedge them in walls.
    const found = await oneOfEach();
    for (const key of ['enemy:karaguin', 'enemy:bat', 'enemy:sting']) {
      const object = found.get(key);
      if (!object) continue;
      // Their movement component, if any, must not carry a tile box.
      const components = object.getComponents()
        .filter((c) => c.constructor.name === 'MovementComponent') as unknown as
          Array<{ boxWidth: number | null }>;
      for (const movement of components) {
        expect(movement.boxWidth, `${key} should not have a collision box`).toBeNull();
      }
    }
  }, 60_000);
});

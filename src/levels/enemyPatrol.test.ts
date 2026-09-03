/**
 * Every enemy the campaign spawns, simulated for ten seconds.
 *
 * This is the blast-radius guard for changes to movement and tile collision.
 * `PatrolComponent` turns enemies around off the wall-touch stamps that
 * `MovementComponent` leaves behind, so anything that changes when a wall is
 * reported - the slope handling in `checkTileCollision()`, for instance - can
 * quietly send an enemy walking through a wall, off the bottom of the level, or
 * into a NaN position. None of that shows up in a level-loading test, because
 * the level loads fine.
 */

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { GameFlowEvent } from '../engine/GameFlowEvent';
import { TimeSystem } from '../engine/TimeSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
const originalFetch = globalThis.fetch;
const pub = join(import.meta.dir, '../../public');
const FRAME = 1 / 60;
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
test('every enemy in the campaign stays in its level and most of them move', async () => {
  const bad: string[] = [];
  let checked = 0, moved = 0;
  for (const g of linearLevelTree) for (const e of g.levels) {
    sSystemRegistry.reset();
    const collision = new CollisionSystem(), manager = new GameObjectManager();
    const hotSpots = new HotSpotSystem(), camera = new CameraSystem(480, 320);
    const time = new TimeSystem(), oc = new GameObjectCollisionSystem();
    const levelSystem = new LevelSystem();
    levelSystem.setSystems(collision, manager, hotSpots); manager.setCamera(camera);
    sSystemRegistry.register(collision,'collision'); sSystemRegistry.register(manager,'gameObject');
    sSystemRegistry.register(hotSpots,'hotSpot'); sSystemRegistry.register(camera,'camera');
    sSystemRegistry.register(new InputSystem(),'input'); sSystemRegistry.register(new SoundSystem(),'sound');
    sSystemRegistry.register(oc,'gameObjectCollision'); sSystemRegistry.register(new GameFlowEvent(),'gameFlowEvent');
    sSystemRegistry.register(time,'time');
    await collision.loadCollisionData('/assets/collision.json');
    if (!(await levelSystem.loadLevel(resourceToLevelId[e.resource]))) continue;
    manager.commitUpdates();
    const w = levelSystem.getLevelWidth(), h = levelSystem.getLevelHeight();
    const enemies = manager.getActiveObjects().filter(o => o.type === 'enemy');
    const start = new Map(enemies.map(o => [o, { x: o.getPosition().x, y: o.getPosition().y }]));
    // Park the camera on each enemy region so they stay active.
    for (let i = 0; i < 600; i++) {
      time.update(FRAME); const gt = time.getGameTime();
      if (enemies.length) { const a = enemies[i % enemies.length];
        camera.setPosition(a.getPosition().x, a.getPosition().y); }
      manager.update(FRAME, gt); oc.update(FRAME);
    }
    for (const en of enemies) {
      checked++;
      const p = en.getPosition(), s = start.get(en)!;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { bad.push(`${e.resource}/${en.subType}: NaN`); continue; }
      if (p.y > h + 256) bad.push(`${e.resource}/${en.subType}: fell out (y=${Math.round(p.y)} vs ${h})`);
      if (p.x < -256 || p.x > w + 256) bad.push(`${e.resource}/${en.subType}: left the world (x=${Math.round(p.x)})`);
      if (Math.abs(p.x - s.x) > 4 || Math.abs(p.y - s.y) > 4) moved++;
    }
  }
  // No enemy may leave the world or corrupt its position.
  expect(bad).toEqual([]);
  // Sanity: the campaign really does spawn a lot of enemies, and the AI is
  // actually running rather than every one of them sitting still.
  expect(checked).toBeGreaterThan(200);
  expect(moved / checked).toBeGreaterThan(0.5);
}, 300_000);

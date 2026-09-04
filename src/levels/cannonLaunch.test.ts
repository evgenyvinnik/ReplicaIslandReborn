/**
 * Do cannons fire Andou?
 *
 * CLAUDE.md flags the trap: Andou's vulnerability volume is left *untyped*,
 * which is what lets a cannon's LAUNCH attack volume reach him at all. Typing
 * it HIT - a change that looks like a tightening - silently stops every cannon
 * in the game working, with no error and no visible difference until you stand
 * on one and nothing happens.
 *
 * That is worth an executable check rather than a note, because a cannon is
 * often the only way across a gap.
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
import { ChannelSystem } from '../engine/ChannelSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { PlayerComponent } from '../entities/components/PlayerComponent';
import { createPlayerVolumeSets } from '../entities/playerCollisionVolumes';
import { HitType } from '../types';
import type { GameObject } from '../entities/GameObject';

const pub = join(import.meta.dir, '../../public');
const originalFetch = globalThis.fetch;
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

test("Andou's vulnerability volume stays untyped, so LAUNCH can reach him", () => {
  // The original leaves it untyped; a typed volume accepts only its own hit
  // type, so typing this HIT would make every cannon inert.
  const sets = createPlayerVolumeSets();
  const types = (sets.normal.vulnerability ?? []).map((v) => v.getHitType());
  expect(types).toEqual([HitType.INVALID]);
});

test('a cannon launches the player upward in the levels that ship one', async () => {
  const failures: string[] = [];
  let checked = 0;

  const seen = new Set<string>();
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      if (seen.has(entry.resource)) continue;
      seen.add(entry.resource);

      sSystemRegistry.reset();
      const collision = new CollisionSystem(), manager = new GameObjectManager();
      const hotSpots = new HotSpotSystem(), camera = new CameraSystem(480, 320);
      const time = new TimeSystem(), oc = new GameObjectCollisionSystem();
      const input = new InputSystem(), sound = new SoundSystem();
      const levelSystem = new LevelSystem();
      levelSystem.setSystems(collision, manager, hotSpots);
      manager.setCamera(camera);
      sSystemRegistry.register(collision, 'collision');
      sSystemRegistry.register(manager, 'gameObject');
      sSystemRegistry.register(hotSpots, 'hotSpot');
      sSystemRegistry.register(camera, 'camera');
      sSystemRegistry.register(input, 'input');
      sSystemRegistry.register(sound, 'sound');
      sSystemRegistry.register(oc, 'gameObjectCollision');
      sSystemRegistry.register(new GameFlowEvent(), 'gameFlowEvent');
      sSystemRegistry.register(new ChannelSystem(), 'channel');
      sSystemRegistry.register(time, 'time');
      if (!(await collision.loadCollisionData('/assets/collision.json'))) continue;
      const levelId = resourceToLevelId[entry.resource];
      if (levelId === undefined || !(await levelSystem.loadLevel(levelId))) continue;
      manager.commitUpdates();

      const player = manager.getPlayer();
      if (!player) continue;
      const component = player.getComponent(PlayerComponent) as PlayerComponent;
      component.setSystems(input, collision, sound, levelSystem);

      const cannons: GameObject[] = [];
      const { width, height } = levelSystem.getLevelSize();
      for (let x = 0; x < width; x += 240) {
        for (let y = 0; y < height; y += 240) {
          camera.setPosition(x, y);
          manager.update(FRAME, time.getGameTime());
          oc.update(FRAME);
          for (const o of manager.getActiveObjects() as GameObject[]) {
            if (o.type === 'cannon' && !cannons.includes(o)) cannons.push(o);
          }
        }
      }
      if (cannons.length === 0) continue;

      for (const cannon of cannons) {
        const target = cannon.getPosition();
        camera.setPosition(target.x, target.y);
        let launched = false;
        for (let i = 0; i < 300 && !launched; i++) {
          // Sit in the barrel. The cannon's LAUNCH volume is an 80px-tall box.
          player.setPosition(
            target.x + cannon.width / 2 - player.width / 2,
            target.y + cannon.height - player.height - 8
          );
          player.getVelocity().set(0, 0);
          player.setGameTime(time.getGameTime());
          cannon.setGameTime(time.getGameTime());
          time.update(FRAME);
          manager.update(FRAME, time.getGameTime());
          oc.update(FRAME);
          // A launch throws him upward: negative Y in canvas space.
          if (player.getVelocity().y < -300) launched = true;
          if (player.lastReceivedHitType === HitType.LAUNCH) launched = true;
        }
        checked++;
        if (!launched) failures.push(`${entry.resource}: a cannon never launched the player`);
      }
    }
  }

  expect(checked, 'no cannons were found in the campaign').toBeGreaterThan(0);
  expect(failures, 'these cannons never fired').toEqual([]);
}, 180_000);

/**
 * Can Andou break the blocks that are in his way?
 *
 * Like doors, breakable blocks are objects rather than collision tiles, so
 * `levelReachable.test.ts` floods straight through them. If the break never
 * lands, a level stays walled off while every geometry check passes.
 *
 * A block carries a HIT vulnerability volume and one hit point; Andou's stomp
 * carries the HIT attack volume. That is the whole mechanism, and it depends
 * on the stomp volume actually reaching below his feet.
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
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
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

test('every breakable block the campaign ships can be broken by a stomp', async () => {
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

      // Blocks out of range sit inactive; sweep the camera to find them.
      const blocks: GameObject[] = [];
      const { width, height } = levelSystem.getLevelSize();
      for (let x = 0; x < width; x += 240) {
        for (let y = 0; y < height; y += 240) {
          camera.setPosition(x, y);
          manager.update(FRAME, time.getGameTime());
          oc.update(FRAME);
          for (const o of manager.getActiveObjects() as GameObject[]) {
            if (o.type === 'breakable_block' && !blocks.includes(o)) blocks.push(o);
          }
        }
      }
      if (blocks.length === 0) continue;

      for (const block of blocks) {
        const target = block.getPosition();
        camera.setPosition(target.x, target.y);
        let broken = false;
        for (let i = 0; i < 90 && !broken; i++) {
          // A stomp coming down on the block. The HIT volume is only live
          // while stomping, which is what makes this the block's only answer.
          component.stomping = true;
          component.currentState = PlayerState.STOMP;
          player.setPosition(
            target.x + block.width / 2 - player.width / 2,
            target.y - player.height + 20
          );
          player.setGameTime(time.getGameTime());
          block.setGameTime(time.getGameTime());
          time.update(FRAME);
          manager.update(FRAME, time.getGameTime());
          oc.update(FRAME);
          if (block.life <= 0) broken = true;
        }
        checked++;
        if (!broken) {
          failures.push(`${entry.resource}: a breakable block survived a stomp`);
        }
      }
    }
  }

  expect(checked, 'no breakable blocks were found in the campaign').toBeGreaterThan(3);
  expect(failures, 'these blocks could not be broken').toEqual([]);
}, 180_000);

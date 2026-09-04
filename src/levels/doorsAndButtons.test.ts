/**
 * Do buttons actually open doors, in a real level?
 *
 * `levelReachable.test.ts` floods the collision *tiles*, so it treats a door
 * as open ground - doors are objects, not tiles. That is the right call for
 * reachability, but it means a broken door mechanism would leave a level
 * genuinely impassable while every geometry check still passed.
 *
 * The chain is: Andou's DEPRESS attack volume reaches the button's DEPRESS
 * vulnerability volume, HitReactionComponent stamps the hit,
 * ButtonAnimationComponent writes its channel, and DoorAnimationComponent
 * reads that channel and retracts the door's solid surface.
 *
 * `buttonsAndDoors.test.ts` covers the pieces against hand-built objects.
 * This runs the whole thing against the doors and buttons the campaign
 * actually ships.
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
import { SolidSurfaceComponent } from '../entities/components/SolidSurfaceComponent';
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

interface Rig {
  manager: GameObjectManager; time: TimeSystem; camera: CameraSystem;
  oc: GameObjectCollisionSystem; collision: CollisionSystem;
  levelSystem: LevelSystem; channels: ChannelSystem;
}

async function load(resource: string): Promise<Rig | null> {
  sSystemRegistry.reset();
  const collision = new CollisionSystem(), manager = new GameObjectManager();
  const hotSpots = new HotSpotSystem(), camera = new CameraSystem(480, 320);
  const time = new TimeSystem(), oc = new GameObjectCollisionSystem();
  const channels = new ChannelSystem();
  const levelSystem = new LevelSystem();
  levelSystem.setSystems(collision, manager, hotSpots);
  manager.setCamera(camera);
  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(new InputSystem(), 'input');
  sSystemRegistry.register(new SoundSystem(), 'sound');
  sSystemRegistry.register(oc, 'gameObjectCollision');
  sSystemRegistry.register(new GameFlowEvent(), 'gameFlowEvent');
  sSystemRegistry.register(channels, 'channel');
  sSystemRegistry.register(time, 'time');
  if (!(await collision.loadCollisionData('/assets/collision.json'))) return null;
  const levelId = resourceToLevelId[resource];
  if (levelId === undefined || !(await levelSystem.loadLevel(levelId))) return null;
  manager.commitUpdates();
  return { manager, time, camera, oc, collision, levelSystem, channels };
}

/** Everything of a type in the level, including objects culled by distance. */
function allOfType(rig: Rig, predicate: (o: GameObject) => boolean): GameObject[] {
  const found: GameObject[] = [];
  const { width, height } = rig.levelSystem.getLevelSize();
  for (let x = 0; x < width; x += 240) {
    for (let y = 0; y < height; y += 240) {
      rig.camera.setPosition(x, y);
      rig.manager.update(FRAME, rig.time.getGameTime());
      rig.oc.update(FRAME);
      for (const o of rig.manager.getActiveObjects() as GameObject[]) {
        if (predicate(o) && !found.includes(o)) found.push(o);
      }
    }
  }
  return found;
}

test('every button the campaign ships can be pressed by standing on it', async () => {
  const failures: string[] = [];
  let checked = 0;

  const seen = new Set<string>();
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      if (seen.has(entry.resource)) continue;
      seen.add(entry.resource);

      const rig = await load(entry.resource);
      if (!rig) continue;
      const player = rig.manager.getPlayer();
      if (!player) continue;
      // Andou's collision volumes come off his animation frames, so
      // PlayerComponent has to be able to run - Game.tsx injects these.
      const component = player.getComponent(PlayerComponent) as PlayerComponent;
      component.setSystems(
        sSystemRegistry.inputSystem!, rig.collision,
        sSystemRegistry.soundSystem!, rig.levelSystem
      );

      const buttons = allOfType(rig, (o) => o.type === 'button');
      if (buttons.length === 0) continue;

      for (const button of buttons) {
        const target = button.getPosition();
        rig.camera.setPosition(target.x, target.y);
        let pressed = false;
        for (let i = 0; i < 60 && !pressed; i++) {
          // Stand on it: Andou's DEPRESS volume is the bottom 16px of his body.
          player.setPosition(
            target.x + button.width / 2 - player.width / 2,
            target.y - player.height + 10
          );
          player.setGameTime(rig.time.getGameTime());
          button.setGameTime(rig.time.getGameTime());
          rig.time.update(FRAME);
          rig.manager.update(FRAME, rig.time.getGameTime());
          rig.oc.update(FRAME);
          if (button.lastReceivedHitType === HitType.DEPRESS) pressed = true;
        }
        checked++;
        if (!pressed) {
          failures.push(`${entry.resource}: a ${button.subType || 'button'} never registered DEPRESS`);
        }
      }
    }
  }

  expect(checked, 'no buttons were found in the campaign').toBeGreaterThan(3);
  expect(failures, 'these buttons could not be pressed').toEqual([]);
}, 180_000);

test('pressing a button opens the door on its channel', async () => {
  // The second half of the chain. A button that registers DEPRESS but never
  // moves its door leaves the level exactly as impassable as one that ignores
  // the player: ButtonAnimationComponent writes the channel,
  // DoorAnimationComponent reads it and removes the door's SolidSurfaceComponent.
  const failures: string[] = [];
  let checked = 0;

  const seen = new Set<string>();
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      if (seen.has(entry.resource)) continue;
      seen.add(entry.resource);

      const rig = await load(entry.resource);
      if (!rig) continue;
      const player = rig.manager.getPlayer();
      if (!player) continue;
      const component = player.getComponent(PlayerComponent) as PlayerComponent;
      component.setSystems(
        sSystemRegistry.inputSystem!, rig.collision,
        sSystemRegistry.soundSystem!, rig.levelSystem
      );

      const buttons = allOfType(rig, (o) => o.type === 'button');
      const doors = allOfType(rig, (o) => o.type === 'door');
      if (buttons.length === 0 || doors.length === 0) continue;

      // Test each door once, pressing any button on its colour. Iterating
      // buttons instead re-tests the same door in levels that field two of a
      // colour, which reads as a failure that is really a duplicate.
      for (const door of doors) {
        const button = buttons.find((b) => b.subType === door.subType);
        if (!button) continue;
        if (!door.getComponents().some((c) => c instanceof SolidSurfaceComponent)) continue; // non-blocking door

        // Press the button with the camera on it, then walk the camera over to
        // the door - which is how it happens in play, and the only way both
        // objects are ever inside their activation radius. GameObject.update()
        // no-ops on a deactivated object, so a door across the level simply
        // does not run until the player approaches it.
        const buttonPos = button.getPosition();
        rig.camera.setPosition(buttonPos.x, buttonPos.y);
        for (let i = 0; i < 30; i++) {
          player.setPosition(
            buttonPos.x + button.width / 2 - player.width / 2,
            buttonPos.y - player.height + 10
          );
          player.setGameTime(rig.time.getGameTime());
          button.setGameTime(rig.time.getGameTime());
          rig.time.update(FRAME);
          rig.manager.update(FRAME, rig.time.getGameTime());
          rig.oc.update(FRAME);
        }

        const doorPos = door.getPosition();
        rig.camera.setPosition(doorPos.x, doorPos.y);
        let opened = false;
        for (let i = 0; i < 120 && !opened; i++) {
          rig.time.update(FRAME);
          rig.manager.update(FRAME, rig.time.getGameTime());
          rig.oc.update(FRAME);
          if (!door.getComponents().some((c) => c instanceof SolidSurfaceComponent)) opened = true;
        }

        checked++;
        if (!opened) {
          failures.push(`${entry.resource}: the ${door.subType} door never opened`);
        }
      }
    }
  }

  expect(checked, 'no button/door pairs were found').toBeGreaterThan(2);
  expect(failures, 'these doors stayed shut').toEqual([]);
}, 180_000);


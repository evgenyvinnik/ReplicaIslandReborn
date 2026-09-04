/**
 * Can Andou actually kill the things he is supposed to kill?
 *
 * Reported from play: "in the first level I cannot pass it because enemy
 * robots seem to be invincible, even when I stomp on them."
 *
 * The collision pipeline has plenty of unit coverage - volumes, hit types,
 * sweep-and-prune - but nothing asserted the end of the chain: put a stomping
 * player on top of an enemy and watch its life reach zero. This does that for
 * every enemy the campaign spawns, and states which ones are *meant* to shrug
 * a stomp off, since three of them are:
 *
 *   - mudman and pink_namazu carry no vulnerability volume at all
 *   - the turret's is typed POSSESS
 *   - the brobot spawner's is typed POSSESS
 *
 * Those four have to be taken over with the ghost instead, which is faithful
 * but reads exactly like "this robot is invincible" if you don't know it.
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
import { PlayerComponent } from '../entities/components/PlayerComponent';
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

/** Enemies the original deliberately makes immune to a stomp. */
const NOT_STOMPABLE = new Set([
  'mudman',        // no vulnerability volume
  'pink_namazu',   // no vulnerability volume
  'turret',        // vulnerability typed POSSESS
  'turret_left',
  'brobot_spawner',
  'brobot_spawner_left',
  'the_source',
  'evil_kabocha',  // bosses run their own scripted fight
  'rokudou',
]);

interface Harness {
  manager: GameObjectManager; input: InputSystem; time: TimeSystem;
  camera: CameraSystem; oc: GameObjectCollisionSystem;
  collision: CollisionSystem; levelSystem: LevelSystem; sound: SoundSystem;
}

function harness(): Harness {
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
  sSystemRegistry.register(time, 'time');
  return { manager, input, time, camera, oc, collision, levelSystem, sound };
}

/**
 * Drop a stomping Andou onto `victim` and report whether it died.
 *
 * The stomp is driven through the real input path rather than by setting
 * flags: PlayerComponent needs an attack *edge* while airborne, and
 * touchingGround() stays true for 0.3s after the last floor contact, so the
 * button is pulsed until one lands.
 */
function stompOnto(h: Harness, player: GameObject, victim: GameObject): boolean {
  const component = player.getComponent(PlayerComponent) as PlayerComponent;
  component.setSystems(h.input, h.collision, h.sound, h.levelSystem);

  // getPosition() hands back the live vector, so `target` tracks a victim that
  // patrols away mid-test.
  const target = victim.getPosition();

  // Sweep Andou down through the victim while he holds a stomp.
  //
  // This asks one question only: can this enemy be damaged by a HIT at all?
  // It deliberately does not model the fall, because the interesting failures
  // there are terrain (dropping him from a height lands him on whatever ledge
  // sits between) rather than combat. The stomp box's *placement* on Andou is
  // pinned separately, in playerCollisionVolumes.test.ts.
  for (let i = 0; i < 240; i++) {
    player.setGameTime(h.time.getGameTime());
    h.camera.setPosition(target.x, target.y);
    h.input.setVirtualButton('stomp', i > 2 && i % 6 < 3);
    const sweep = (i % 40) / 40;
    player.setPosition(
      target.x + victim.width / 2 - player.width / 2,
      target.y - player.height + sweep * (victim.height + player.height)
    );
    h.time.update(FRAME);
    h.manager.update(FRAME, h.time.getGameTime());
    h.oc.update(FRAME);
    if (victim.life <= 0) return true;
  }
  return false;
}

test('every stompable enemy in the campaign dies to a stomp', async () => {
  // One representative of each enemy subType the campaign spawns.
  const seen = new Set<string>();
  const survivors: string[] = [];
  const killed: string[] = [];

  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      const levelId = resourceToLevelId[entry.resource];
      if (levelId === undefined) continue;

      // Cheap pre-pass: which subTypes does this level offer that we still need?
      const probe = harness();
      if (!(await probe.levelSystem.loadLevel(levelId))) continue;
      probe.manager.commitUpdates();
      const wanted = (probe.manager.getActiveObjects() as GameObject[])
        .filter((o) => o.type === 'enemy' && o.subType && !seen.has(o.subType)
          && !NOT_STOMPABLE.has(o.subType))
        .map((o) => o.subType as string);
      if (wanted.length === 0) continue;

      for (const subType of [...new Set(wanted)]) {
        seen.add(subType);
        const h = harness();
        expect(await h.collision.loadCollisionData('/assets/collision.json')).toBe(true);
        expect(await h.levelSystem.loadLevel(levelId)).toBe(true);
        h.manager.commitUpdates();
        const player = h.manager.getPlayer();
        const victim = (h.manager.getActiveObjects() as GameObject[])
          .find((o) => o.subType === subType);
        if (!player || !victim) continue;
        if (stompOnto(h, player, victim)) killed.push(subType);
        else survivors.push(`${subType} (in ${entry.resource})`);
      }
    }
  }

  expect(killed.length, 'no stompable enemy was actually tested').toBeGreaterThan(2);
  expect(survivors, 'these enemies survived a stomp').toEqual([]);
}, 120_000);

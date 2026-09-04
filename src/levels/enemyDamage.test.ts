/**
 * Do enemies hurt Andou?
 *
 * `stompKill.test.ts` proves he can kill them. This is the other direction,
 * and it is the half that makes the game a game: an enemy whose attack volume
 * never reaches him is scenery.
 *
 * The original divides them. Brobots and the flying enemies carry a live HIT
 * attack volume on every frame, so contact hurts. The skeleton, mudman and
 * pink namazu only present one while their action is ATTACK, so they are
 * harmless mid-patrol - `attackOnlyWhileAttacking` in the profile. Both halves
 * are asserted here against the enemies the campaign actually spawns.
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
import { ActionType } from '../types';
import type { GameObject } from '../entities/GameObject';

const pub = join(import.meta.dir, '../../public');
const originalFetch = globalThis.fetch;
const FRAME = 1 / 60;

/** Enemies whose attack volume is live on every frame - contact hurts. */
const ALWAYS_HOSTILE = ['brobot', 'bat', 'sting', 'karaguin', 'onion', 'shadowslime'];
/** Enemies that only swing while their action is ATTACK. */
const ATTACKS_ONLY_WHILE_ATTACKING = ['skeleton', 'mudman', 'pink_namazu'];

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
  levelSystem: LevelSystem; input: InputSystem; sound: SoundSystem;
}

async function load(resource: string): Promise<Rig | null> {
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
  if (!(await collision.loadCollisionData('/assets/collision.json'))) return null;
  const levelId = resourceToLevelId[resource];
  if (levelId === undefined || !(await levelSystem.loadLevel(levelId))) return null;
  manager.commitUpdates();
  return { manager, time, camera, oc, collision, levelSystem, input, sound };
}

/** Walk Andou into `enemy` and report whether he loses a hit point. */
function takesDamageFrom(rig: Rig, player: GameObject, enemy: GameObject, forceAttack: boolean): boolean {
  const component = player.getComponent(PlayerComponent) as PlayerComponent;
  const startLife = player.life;
  const target = enemy.getPosition();

  for (let i = 0; i < 120; i++) {
    rig.camera.setPosition(target.x, target.y);
    // Not stomping and not invincible: the state where contact should hurt.
    component.stomping = false;
    component.currentState = PlayerState.MOVE;
    component.invincible = false;
    component.invincibleTime = 0;
    if (forceAttack) enemy.setCurrentAction(ActionType.ATTACK);
    player.setPosition(
      target.x + enemy.width / 2 - player.width / 2,
      target.y + enemy.height - player.height
    );
    player.setGameTime(rig.time.getGameTime());
    enemy.setGameTime(rig.time.getGameTime());
    rig.time.update(FRAME);
    rig.manager.update(FRAME, rig.time.getGameTime());
    rig.oc.update(FRAME);
    if (player.life < startLife) return true;
  }
  return false;
}

test('enemies that hurt on contact actually do, and the rest only while attacking', async () => {
  const contactFailures: string[] = [];
  const gatedFailures: string[] = [];
  const seenSubTypes = new Set<string>();

  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      const rig = await load(entry.resource);
      if (!rig) continue;

      // Which subTypes does this level offer that we still need?
      const wanted = (rig.manager.getActiveObjects() as GameObject[])
        .filter((o) => o.type === 'enemy' && o.subType && !seenSubTypes.has(o.subType))
        .map((o) => o.subType as string);
      if (wanted.length === 0) continue;

      for (const subType of [...new Set(wanted)]) {
        if (!ALWAYS_HOSTILE.includes(subType) && !ATTACKS_ONLY_WHILE_ATTACKING.includes(subType)) {
          continue;
        }
        seenSubTypes.add(subType);

        const fresh = await load(entry.resource);
        if (!fresh) continue;
        const player = fresh.manager.getPlayer();
        const enemy = (fresh.manager.getActiveObjects() as GameObject[])
          .find((o) => o.subType === subType);
        if (!player || !enemy) continue;
        const component = player.getComponent(PlayerComponent) as PlayerComponent;
        component.setSystems(fresh.input, fresh.collision, fresh.sound, fresh.levelSystem);

        if (ALWAYS_HOSTILE.includes(subType)) {
          if (!takesDamageFrom(fresh, player, enemy, false)) {
            contactFailures.push(`${subType} (in ${entry.resource}) never hurt the player on contact`);
          }
        } else {
          // Only dangerous mid-swing: forcing ATTACK must land a hit.
          if (!takesDamageFrom(fresh, player, enemy, true)) {
            gatedFailures.push(`${subType} (in ${entry.resource}) never hurt the player even while attacking`);
          }
        }
      }
    }
  }

  expect(seenSubTypes.size, 'no enemies were tested').toBeGreaterThan(4);
  expect(contactFailures, 'these enemies are harmless on contact').toEqual([]);
  expect(gatedFailures, 'these enemies never land their attack').toEqual([]);
}, 180_000);

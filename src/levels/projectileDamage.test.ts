/**
 * Do enemy projectiles hurt Andou?
 *
 * The last combat path with no end-to-end cover. A turret whose bullets pass
 * straight through the player is worse than a turret that does not fire: the
 * level looks dangerous and is not, and the one thing a turret is for - forcing
 * you to possess it - stops mattering.
 *
 * Every enemy projectile carries a HIT attack volume and Team.ENEMY. This
 * spawns each type through the real factory and walks it into the player.
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
import { resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
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

test('every enemy projectile type takes a hit point off the player', async () => {
  const failures: string[] = [];

  const kinds: Array<[string, GameObjectType]> = [
    ['turret bullet', GameObjectType.TURRET_BULLET],
    ['energy ball', GameObjectType.ENERGY_BALL],
    ['cannon ball', GameObjectType.CANNON_BALL],
  ];

  for (const [name, typeIndex] of kinds) {
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
    expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
    expect(await levelSystem.loadLevel(resourceToLevelId.level_0_2_lab)).toBe(true);
    manager.commitUpdates();

    const player = manager.getPlayer() as GameObject;
    const component = player.getComponent(PlayerComponent) as PlayerComponent;
    component.setSystems(input, collision, sound, levelSystem);

    // Spawn it on the player, so it is inside its activation radius from the
    // first frame - a projectile spawned across the level is culled and
    // recycled before it can touch anything.
    const factory = new GameObjectFactory(manager);
    sSystemRegistry.register(factory, 'factory');
    const playerPos = player.getPosition();
    const shot = factory.spawn(typeIndex, playerPos.x, playerPos.y);
    if (!shot) { failures.push(`${name}: could not be spawned`); continue; }
    manager.commitUpdates();

    const startLife = player.life;
    let hurt = false;
    for (let i = 0; i < 120 && !hurt; i++) {
      component.stomping = false;
      component.currentState = PlayerState.MOVE;
      component.invincible = false;
      component.invincibleTime = 0;
      shot.setPosition(
        playerPos.x + player.width / 2 - shot.width / 2,
        playerPos.y + player.height / 2 - shot.height / 2
      );
      camera.setPosition(playerPos.x, playerPos.y);
      player.setGameTime(time.getGameTime());
      shot.setGameTime(time.getGameTime());
      time.update(FRAME);
      manager.update(FRAME, time.getGameTime());
      oc.update(FRAME);
      if (player.life < startLife) hurt = true;
    }
    if (!hurt) failures.push(`${name}: passed straight through the player`);
  }

  expect(failures, 'these projectiles do no damage').toEqual([]);
}, 60_000);

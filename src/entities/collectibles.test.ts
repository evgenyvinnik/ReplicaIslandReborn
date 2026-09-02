/**
 * Collectibles, picked up the way the original picks them up.
 *
 * Game.tsx used to detect every pick-up with its own AABB overlap test against
 * the player. The original uses two different mechanisms, and this port now
 * uses both:
 *
 *  - Coins carry a HitPlayerComponent: a plain radius test (32px), because
 *    coins are numerous and cheap to check that way. `spawnCoin` even leaves
 *    the dynamic-collision line commented out.
 *  - Rubies and diaries carry a COLLECT vulnerability volume and are reached by
 *    Andou's COLLECT attack volume through GameObjectCollisionSystem.
 *
 * Both end at HitReactionComponent's dieOnCollect, which drops the object's
 * life to zero; Game.tsx turns that into inventory, score and the win check.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObjectManager } from './GameObjectManager';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObject } from './GameObject';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { HitPlayerComponent } from './components/HitPlayerComponent';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { createPlayerVolumeSets } from './playerCollisionVolumes';
import { HitType, Team } from '../types';

describe('collectibles', () => {
  let system: GameObjectCollisionSystem;
  let manager: GameObjectManager;

  beforeEach(() => {
    sSystemRegistry.reset();
    system = new GameObjectCollisionSystem();
    manager = new GameObjectManager();
    manager.setCamera(new CameraSystem(480, 320));
    sSystemRegistry.register(system, 'gameObjectCollision');
    sSystemRegistry.register(manager, 'gameObject');
  });

  function makePlayer(x = 100, y = 100): GameObject {
    const player = new GameObject();
    player.type = 'player';
    player.team = Team.PLAYER;
    player.width = 32;
    player.height = 48;
    player.life = 3;
    player.getPosition().set(x, y);

    const sets = createPlayerVolumeSets();
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(sets.normal.attack, sets.normal.vulnerability);
    const reaction = new HitReactionComponent();
    collision.setHitReactionComponent(reaction);
    player.addComponent(collision);
    player.addComponent(reaction);
    manager.setPlayer(player);
    return player;
  }

  /** A coin, as LevelSystem.attachCollectible builds it. */
  function makeCoin(x: number, y: number): GameObject {
    const coin = new GameObject();
    coin.type = 'coin';
    coin.width = 32;
    coin.height = 32;
    coin.life = 1;
    coin.getPosition().set(x, y);

    const reaction = new HitReactionComponent({ dieOnCollect: true, forceInvincibility: true });
    const hitPlayer = new HitPlayerComponent();
    hitPlayer.setup({
      distance: 32,
      hitReaction: reaction,
      hitType: HitType.COLLECT,
      hitPlayer: false,
    });
    coin.addComponent(reaction);
    coin.addComponent(hitPlayer);
    return coin;
  }

  /** A ruby or diary, which uses the volume pipeline instead. */
  function makeVolumeCollectible(type: string, x: number, y: number): GameObject {
    const object = new GameObject();
    object.type = type;
    object.width = 32;
    object.height = 32;
    object.life = 1;
    object.getPosition().set(x, y);

    const reaction = new HitReactionComponent({ dieOnCollect: true, forceInvincibility: true });
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(null, [new SphereCollisionVolume(16, 16, 16, HitType.COLLECT)]);
    collision.setHitReactionComponent(reaction);
    object.addComponent(collision);
    object.addComponent(reaction);
    return object;
  }

  function runFrame(objects: GameObject[], time = 1): void {
    for (const object of objects) {
      object.setGameTime(time);
      object.update(1 / 60, time);
    }
    system.update(1 / 60);
  }

  test('a coin within the radius is collected', () => {
    const player = makePlayer(100, 100);
    const coin = makeCoin(105, 105);

    runFrame([player, coin]);

    expect(coin.life).toBe(0);
  });

  test('a coin out of range is left alone', () => {
    const player = makePlayer(100, 100);
    const coin = makeCoin(500, 100);

    runFrame([player, coin]);

    expect(coin.life).toBe(1);
  });

  test('collecting a coin costs the player nothing', () => {
    const player = makePlayer(100, 100);
    const coin = makeCoin(105, 105);

    runFrame([player, coin]);

    expect(player.life).toBe(3);
  });

  for (const type of ['ruby', 'diary']) {
    test(`a ${type} is collected through the COLLECT volume`, () => {
      const player = makePlayer(100, 100);
      const item = makeVolumeCollectible(type, 100, 100);

      runFrame([player, item]);

      expect(item.life).toBe(0);
    });

    test(`a distant ${type} is left alone`, () => {
      const player = makePlayer(100, 100);
      const item = makeVolumeCollectible(type, 800, 100);

      runFrame([player, item]);

      expect(item.life).toBe(1);
    });
  }

  test('a stomping player still collects', () => {
    // The COLLECT volume is present in every player state, so a pick-up
    // mid-stomp still registers.
    const player = new GameObject();
    player.type = 'player';
    player.team = Team.PLAYER;
    player.width = 32;
    player.height = 48;
    player.life = 3;
    player.getPosition().set(100, 100);
    const sets = createPlayerVolumeSets();
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(sets.stomping.attack, sets.stomping.vulnerability);
    player.addComponent(collision);
    manager.setPlayer(player);

    const ruby = makeVolumeCollectible('ruby', 100, 100);
    runFrame([player, ruby]);

    expect(ruby.life).toBe(0);
  });
});

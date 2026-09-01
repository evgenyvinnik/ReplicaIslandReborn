/**
 * Boss fights, checked against how the original assembles them.
 *
 * The port previously gave Evil Kabocha and Rokudou bespoke "boss AI"
 * components with invented state machines, and resolved their damage through
 * inline `subType` string checks. The original has no boss AI at all: both are
 * NPCs driven by the arena's hot-spot script, damaged through
 * GameObjectCollisionSystem via a vulnerability volume and a
 * HitReactionComponent, whose death posts an ending cutscene.
 *
 * Reference: Original/src/com/replica/replicaisland/GameObjectFactory.java,
 * spawnEnemyEvilKabocha() and spawnEnemyRokudou().
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { ChannelSystem } from '../engine/ChannelSystem';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { gameFlowEvent, GameFlowEventType } from '../engine/GameFlowEvent';
import { LevelSystem } from './LevelSystemNew';
import { resourceToLevelId } from '../data/levelTree';
import { NPCComponent } from '../entities/components/NPCComponent';
import { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { LaunchProjectileComponent } from '../entities/components/LaunchProjectileComponent';
import { MovementComponent } from '../entities/components/MovementComponent';
import { createPlayerVolumeSets } from '../entities/playerCollisionVolumes';
import { applyPlayerAttack } from '../entities/applyPlayerAttack';
import { GameObject } from '../entities/GameObject';
import type { GameComponent } from '../entities/GameComponent';
import { ActionType, Team } from '../types';
import type { CutsceneType } from '../data/cutscenes';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');
const BOSS_LEVEL = 'level_final_boss_lab';

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.pathname
        : new URL(input.url).pathname;
    const pathname = rawUrl.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const requestedFile = file(join(publicDirectory, pathname));
    if (!(await requestedFile.exists())) {
      return new Response(null, { status: 404 });
    }
    return new Response(await requestedFile.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

interface Arena {
  manager: GameObjectManager;
  collision: GameObjectCollisionSystem;
}

async function loadBossLevel(): Promise<Arena> {
  sSystemRegistry.reset();
  gameFlowEvent.reset();

  const manager = new GameObjectManager();
  const objectCollision = new GameObjectCollisionSystem();
  const camera = new CameraSystem(480, 320);
  const hotSpots = new HotSpotSystem();
  const levelSystem = new LevelSystem();
  levelSystem.setSystems(new CollisionSystem(), manager, hotSpots);
  manager.setCamera(camera);

  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(objectCollision, 'gameObjectCollision');
  // NPCComponent reads the arena's script from here; without it the bosses
  // never get a target velocity.
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.channelSystem = new ChannelSystem();

  expect(await levelSystem.loadLevel(resourceToLevelId[BOSS_LEVEL])).toBe(true);
  manager.commitUpdates();

  return { manager, collision: objectCollision };
}

function findBoss(manager: GameObjectManager, subType: string): GameObject {
  const boss = manager.getActiveObjects().find((object) => object.subType === subType);
  expect(boss, `${subType} missing from ${BOSS_LEVEL}`).toBeDefined();
  return boss as GameObject;
}

function componentOf<T extends GameComponent>(object: GameObject, ctor: unknown): T | null {
  return object.getComponent(ctor as new (...args: unknown[]) => T) as T | null;
}

/** A stomping player parked on top of the boss. */
function makeStompingPlayer(target: GameObject): GameObject {
  const player = new GameObject();
  player.type = 'player';
  player.team = Team.PLAYER;
  player.width = 32;
  player.height = 48;
  const position = target.getPosition();
  player.getPosition().set(position.x + target.width / 2, position.y + target.height / 2);

  const sets = createPlayerVolumeSets();
  const collision = new DynamicCollisionComponent();
  collision.setCollisionVolumes(sets.stomping.attack, sets.stomping.vulnerability);
  player.addComponent(collision);
  return player;
}

/** One frame of the real pipeline: components register volumes, system resolves. */
function resolveHit(arena: Arena, player: GameObject, boss: GameObject, time: number): void {
  player.setGameTime(time);
  boss.setGameTime(time);
  player.update(1 / 60, time);
  boss.update(1 / 60, time);
  arena.collision.update(1 / 60);
}

describe('boss fight composition', () => {
  for (const [subType, label] of [['evil_kabocha', 'Evil Kabocha'], ['rokudou', 'Rokudou']] as const) {
    test(`${label} is a scripted NPC, not a bespoke boss AI`, async () => {
      const arena = await loadBossLevel();
      const boss = findBoss(arena.manager, subType);

      // The original drives both bosses entirely through NPCComponent and the
      // arena's hot spots.
      expect(componentOf<NPCComponent>(boss, NPCComponent)).not.toBeNull();
      expect(boss.life).toBe(3);
      expect(boss.team).toBe(Team.ENEMY);
    });

    test(`${label} can be damaged through the collision pipeline`, async () => {
      const arena = await loadBossLevel();
      const boss = findBoss(arena.manager, subType);

      const collision = componentOf<DynamicCollisionComponent>(boss, DynamicCollisionComponent);
      expect(collision, 'boss needs a vulnerability volume to be hittable').not.toBeNull();
      expect(collision?.getVulnerabilityVolumes()).not.toBeNull();

      const reaction = componentOf<HitReactionComponent>(boss, HitReactionComponent);
      expect(reaction, 'boss needs a HitReactionComponent to receive hits').not.toBeNull();
    });

    test(`${label} takes three stomps, not one`, async () => {
      const arena = await loadBossLevel();
      const boss = findBoss(arena.manager, subType);
      const player = makeStompingPlayer(boss);
      const reaction = componentOf<HitReactionComponent>(boss, HitReactionComponent);

      let time = 0;
      const lives: number[] = [];
      for (let hit = 0; hit < 3; hit++) {
        // Clear the post-hit invincibility window between stomps.
        reaction?.setInvincible(false);
        time += 1;
        resolveHit(arena, player, boss, time);
        lives.push(boss.life);
      }

      expect(lives).toEqual([2, 1, 0]);
    });

    test(`${label} is not double-damaged by the inline stomp path`, async () => {
      const arena = await loadBossLevel();
      const boss = findBoss(arena.manager, subType);
      const player = makeStompingPlayer(boss);

      resolveHit(arena, player, boss, 1);
      const afterCollision = boss.life;
      // Game.tsx also runs its inline stomp check on the same frame.
      const result = applyPlayerAttack(boss);

      expect(boss.life).toBe(afterCollision);
      expect(result.isBoss).toBe(true);
      expect(boss.isMarkedForRemoval()).toBe(false);
    });
  }

  for (const [subType, label] of [['evil_kabocha', 'Evil Kabocha'], ['rokudou', 'Rokudou']] as const) {
    test(`${label} can actually move`, async () => {
      // Game.tsx's inline enemy physics used to zero evil_kabocha's velocity
      // every frame, so the boss could never walk its hot-spot script. Both
      // bosses are moved by MovementComponent now.
      const arena = await loadBossLevel();
      const boss = findBoss(arena.manager, subType);
      expect(componentOf<MovementComponent>(boss, MovementComponent)).not.toBeNull();

      let time = 0;
      for (let frame = 0; frame < 10; frame++) {
        time += 1 / 60;
        boss.setGameTime(time);
        boss.update(1 / 60, time);
      }

      // NPCComponent sets a target velocity from the arena's hot spots and
      // MovementComponent interpolates towards it.
      expect(Math.abs(boss.getTargetVelocity().x)).toBeGreaterThan(0);
      expect(Math.abs(boss.getVelocity().x)).toBeGreaterThan(0);
    });
  }

  test('Rokudou carries both of the original guns', async () => {
    const arena = await loadBossLevel();
    const rokudou = findBoss(arena.manager, 'rokudou');

    // The original gives Rokudou two LaunchProjectileComponents: a 1.5s energy
    // ball and a five-round burst.
    const guns = rokudou
      .getComponents()
      .filter((component) => component instanceof LaunchProjectileComponent);
    expect(guns).toHaveLength(2);
  });

  test('Rokudou holds fire until the hot-spot script sets ATTACK', async () => {
    const arena = await loadBossLevel();
    const rokudou = findBoss(arena.manager, 'rokudou');
    const before = arena.manager.getActiveObjects().length;

    // Both guns set requiredAction=ATTACK, so nothing should spawn while he is
    // merely flying his patrol route.
    rokudou.setCurrentAction(ActionType.MOVE);
    for (let frame = 0; frame < 300; frame++) {
      rokudou.update(1 / 60, frame / 60);
    }
    arena.manager.commitUpdates();

    expect(arena.manager.getActiveObjects().length).toBe(before);
  });
});

describe('boss death posts its ending cutscene', () => {
  let events: Array<{ event: GameFlowEventType; index: number }>;

  beforeEach(() => {
    events = [];
  });

  for (const [subType, label, expected] of [
    ['evil_kabocha', 'Evil Kabocha', 3],
    ['rokudou', 'Rokudou', 2],
  ] as const) {
    test(`${label} posts SHOW_ANIMATION ${expected} on death`, async () => {
      const arena = await loadBossLevel();
      const boss = findBoss(arena.manager, subType);

      const listener = (event: GameFlowEventType, index: number): void => {
        events.push({ event, index });
      };
      gameFlowEvent.addListener(listener);

      const npc = componentOf<NPCComponent>(boss, NPCComponent) as NPCComponent;
      boss.life = 0;
      boss.getVelocity().set(0, 0);

      // NPCComponent needs the object grounded and still, and waits out
      // DEATH_FADE_DELAY (4s) before posting - plus a frame to enter the DEATH
      // action in the first place.
      let time = 0;
      for (let frame = 0; frame < 400; frame++) {
        time += 1 / 60;
        boss.setGameTime(time);
        boss.setLastTouchedFloorTime(time);
        boss.getVelocity().set(0, 0);
        npc.update(1 / 60, boss);
        gameFlowEvent.update();
      }
      gameFlowEvent.removeListener(listener);

      const animations = events.filter((e) => e.event === GameFlowEventType.SHOW_ANIMATION);
      expect(animations.length).toBeGreaterThan(0);
      expect(animations[0].index).toBe(expected as unknown as CutsceneType);
    });
  }
});

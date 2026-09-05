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
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { gameFlowEvent, GameFlowEventType } from '../engine/GameFlowEvent';
import { LevelSystem } from './LevelSystemNew';
import { resourceToLevelId } from '../data/levelTree';
import { NPCComponent } from '../entities/components/NPCComponent';
import { NPCAnimation, NPCAnimationComponent } from '../entities/components/NPCAnimationComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { LaunchProjectileComponent } from '../entities/components/LaunchProjectileComponent';
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { MovementComponent } from '../entities/components/MovementComponent';
import { createPlayerVolumeSets } from '../entities/playerCollisionVolumes';
import { applyPlayerAttack } from '../entities/applyPlayerAttack';
import { GameObject } from '../entities/GameObject';
import type { GameComponent } from '../entities/GameComponent';
import { ActionType, Team } from '../types';
import type { CutsceneType } from '../data/cutscenes';
import { TimeSystem } from '../engine/TimeSystem';
import { TheSourceComponent } from '../entities/components/TheSourceComponent';
import type { EffectsSystem } from '../engine/EffectsSystem';

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
  time: TimeSystem;
}

async function loadBossLevel(onBossDeath?: (ending: string) => void): Promise<Arena> {
  sSystemRegistry.reset();
  gameFlowEvent.reset();

  const manager = new GameObjectManager();
  const objectCollision = new GameObjectCollisionSystem();
  const time = new TimeSystem();
  const camera = new CameraSystem(480, 320);
  const hotSpots = new HotSpotSystem();
  const levelSystem = new LevelSystem();
  const tileCollision = new CollisionSystem();
  levelSystem.setSystems(tileCollision, manager, hotSpots);
  if (onBossDeath) levelSystem.setOnBossDeathCallback(onBossDeath);
  manager.setCamera(camera);

  sSystemRegistry.register(tileCollision, 'collision');
  sSystemRegistry.register(levelSystem, 'level');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(objectCollision, 'gameObjectCollision');
  sSystemRegistry.register(time, 'time');
  // NPCComponent reads the arena's script from here; without it the bosses
  // never get a target velocity.
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.channelSystem = new ChannelSystem();

  expect(await levelSystem.loadLevel(resourceToLevelId[BOSS_LEVEL])).toBe(true);
  manager.commitUpdates();

  const factory = new GameObjectFactory(manager);
  factory.setSystemRegistry(sSystemRegistry);
  sSystemRegistry.register(factory, 'factory');

  return { manager, collision: objectCollision, time };
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

    test(`${label} dies to three real stomps from the level's own player`, async () => {
      // The tests above build a synthetic player and hand it the stomp volume
      // set directly. This uses the player the arena actually spawns, with
      // PlayerComponent running and choosing his volumes off the stomp
      // animation - the path the game takes. It answers "is the fight
      // winnable with the real player", not "is the stomp box in the right
      // place"; that placement is pinned in playerCollisionVolumes.test.ts and
      // felt in doorsAndButtons and breakableBlocks.
      const arena = await loadBossLevel();
      const boss = findBoss(arena.manager, subType);
      const player = arena.manager.getPlayer();
      expect(player, 'the boss arena should spawn a player').toBeTruthy();
      if (!player) return;

      const component = player.getComponent(PlayerComponent) as PlayerComponent;
      // Andou's collision volumes come off his animation frames, so
      // PlayerComponent has to be able to run - Game.tsx injects these.
      component.setSystems(
        new InputSystem(), sSystemRegistry.collisionSystem as CollisionSystem,
        new SoundSystem(), sSystemRegistry.levelSystem as unknown as LevelSystem
      );
      const reaction = componentOf<HitReactionComponent>(boss, HitReactionComponent);
      const startLife = boss.life;
      expect(startLife).toBe(3);

      const target = boss.getPosition();
      let time = 0;
      for (let hit = 0; hit < 3 && boss.life > 0; hit++) {
        reaction?.setInvincible(false);
        // Sweep him down through the boss while stomping, as a landed stomp does.
        for (let i = 0; i < 40 && boss.life > startLife - hit - 1; i++) {
          component.stomping = true;
          component.currentState = PlayerState.STOMP;
          const sweep = (i % 20) / 20;
          player.setPosition(
            target.x + boss.width / 2 - player.width / 2,
            target.y - player.height + sweep * (boss.height + player.height)
          );
          time += 1 / 60;
          player.setGameTime(time);
          boss.setGameTime(time);
          player.update(1 / 60, time);
          boss.update(1 / 60, time);
          arena.collision.update(1 / 60);
        }
      }

      expect(boss.life, `${label} survived three stomps`).toBe(0);
    });
  }

  test('Rokudou animation treats vertical travel as flight, not a jump', async () => {
    const arena = await loadBossLevel();
    const rokudou = findBoss(arena.manager, 'rokudou');
    const animator = componentOf<NPCAnimationComponent>(rokudou, NPCAnimationComponent);
    const sprite = componentOf<SpriteComponent>(rokudou, SpriteComponent);

    rokudou.setGameTime(10);
    rokudou.setCurrentAction(ActionType.MOVE);
    rokudou.setVelocity(50, -100);
    animator?.update(1 / 60, rokudou);

    expect(sprite?.getCurrentAnimationIndex()).toBe(NPCAnimation.WALK);
  });

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
    const guns = rokudou
      .getComponents()
      .filter((component): component is LaunchProjectileComponent =>
        component instanceof LaunchProjectileComponent
      );

    // Both guns set requiredAction=ATTACK, so nothing should spawn while he is
    // merely flying his patrol route.
    arena.time.update(10);
    rokudou.setCurrentAction(ActionType.MOVE);
    for (const gun of guns) gun.update(0, rokudou);
    arena.manager.commitUpdates();

    expect(arena.manager.getActiveObjects().length).toBe(before);
  });

  test('Rokudou fires both finale shots downward in Canvas space', async () => {
    const arena = await loadBossLevel();
    const rokudou = findBoss(arena.manager, 'rokudou');
    const guns = rokudou
      .getComponents()
      .filter((component): component is LaunchProjectileComponent =>
        component instanceof LaunchProjectileComponent
      );

    arena.time.update(1);
    rokudou.setCurrentAction(ActionType.ATTACK);
    for (const gun of guns) gun.update(0, rokudou);
    arena.manager.commitUpdates();

    const shots = arena.manager.findObjectsByType('projectile');
    expect(shots).toHaveLength(2);
    expect(shots.map((shot) => shot.getVelocity().y)).toEqual([300, 300]);
    for (const shot of shots) {
      expect(componentOf<DynamicCollisionComponent>(shot, DynamicCollisionComponent))
        .not.toBeNull();
    }
  });
});

describe('boss death posts its ending cutscene', () => {
  let events: Array<{ event: GameFlowEventType; index: number }>;

  beforeEach(() => {
    events = [];
  });

  test('three real enemy shots collapse The Source and trigger Wanda ending exactly once', async () => {
    const endings: string[] = [];
    const arena = await loadBossLevel((ending) => { endings.push(ending); });
    const source = findBoss(arena.manager, 'the_source');
    const behavior = componentOf<TheSourceComponent>(source, TheSourceComponent)!;
    const camera = sSystemRegistry.cameraSystem!;
    camera.setTarget(arena.manager.getPlayer());
    const explosions: string[] = [];
    sSystemRegistry.register({
      spawnExplosion: (_x: number, _y: number, kind: string): void => { explosions.push(kind); },
    } as unknown as EffectsSystem, 'effects');
    const factory = sSystemRegistry.gameObjectFactory!;

    const frame = (): void => {
      arena.time.update(1 / 60);
      source.update(1 / 60, arena.time.getGameTime());
      arena.collision.update(1 / 60);
    };
    for (let hit = 0; hit < 3; hit++) {
      // Factory shots carry the real team, attack sphere and hit reaction.
      // Place a shot inside the core; no life assignment or forced HIT_REACT.
      const shot = factory.spawn(
        GameObjectType.ENERGY_BALL,
        source.getPosition().x + source.width / 2 - 16,
        source.getPosition().y + source.height / 2 - 16
      )!;
      expect(shot).toBeTruthy();
      arena.time.update(1 / 60);
      shot.update(1 / 60, arena.time.getGameTime());
      source.update(1 / 60, arena.time.getGameTime());
      arena.collision.update(1 / 60);
      expect(source.life).toBe(2 - hit);
      frame(); // Source consumes the collision's HIT_REACT on the next frame.
      if (hit < 2) {
        expect(behavior.isDead()).toBe(false);
        for (let i = 0; i < 60; i++) frame(); // Real 0.6s invincibility expires.
      }
    }

    expect(behavior.isDead()).toBe(true);
    expect(sSystemRegistry.channelSystem?.registerChannel('SURPRISED')?.value)
      .toEqual({ value: true });
    expect(camera.getTarget()).toBe(source);
    const startY = source.getPosition().y;
    for (let i = 0; i < 29 * 60; i++) frame();
    expect(endings).toEqual([]);
    expect(source.getPosition().y - startY).toBeCloseTo(29 * 20, 5);
    expect(explosions.length).toBeGreaterThan(200);
    expect(new Set(explosions)).toEqual(new Set(['giant']));
    for (let i = 0; i < 3 * 60; i++) frame();
    expect(endings).toEqual(['WANDA_ENDING']);
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

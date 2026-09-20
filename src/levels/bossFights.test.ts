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

import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem, HotSpotType } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { ChannelSystem } from '../engine/ChannelSystem';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { gameFlowEvent, GameFlowEventType } from '../engine/GameFlowEvent';
import { LevelSystem } from './LevelSystemNew';
import { restorePlayerCamera } from './LevelView';
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
import { ActionType, HitType, Team } from '../types';
import { GhostComponent } from '../entities/components/GhostComponent';
import { resolveEnemyDeath } from '../entities/resolveEnemyDeath';
import { getInventory, setInventory } from '../entities/components/InventoryComponent';
import { useGameStore } from '../stores/useGameStore';
import type { CutsceneType } from '../data/cutscenes';
import { TimeSystem } from '../engine/TimeSystem';
import { TheSourceComponent } from '../entities/components/TheSourceComponent';
import { ScreenFade } from '../engine/ScreenFade';
import { GravityComponent } from '../entities/components/GravityComponent';
import { OrbitalMagnetComponent } from '../entities/components/OrbitalMagnetComponent';
import { FadeDrawableComponent } from '../entities/components/FadeDrawableComponent';
import { SortConstants } from '../engine/SortConstants';
import type { RenderSystem } from '../engine/RenderSystem';

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
  level: LevelSystem;
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
  expect(await tileCollision.loadCollisionData('/assets/collision.json')).toBe(true);
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
  sSystemRegistry.screenFade = new ScreenFade(() => time.getRealTime());

  expect(await levelSystem.loadLevel(resourceToLevelId[BOSS_LEVEL])).toBe(true);
  manager.commitUpdates();

  const factory = new GameObjectFactory(manager);
  factory.setSystemRegistry(sSystemRegistry);
  sSystemRegistry.register(factory, 'factory');

  return { manager, collision: objectCollision, time, level: levelSystem };
}

function findBoss(manager: GameObjectManager, subType: string): GameObject {
  const boss = manager.getActiveObjects().find((object) => object.subType === subType);
  expect(boss, `${subType} missing from ${BOSS_LEVEL}`).toBeDefined();
  return boss as GameObject;
}

test('a possessed Brobot striking the Source returns control before its body is reclaimed', async () => {
  const arena = await loadBossLevel();
  const player = arena.manager.getPlayer()!;
  const playerControl = player.getComponent(PlayerComponent)!;
  const source = findBoss(arena.manager, 'the_source');
  const factory = sSystemRegistry.gameObjectFactory!;
  const brobot = factory.spawn(GameObjectType.ENEMY_BROBOT, 1700, 704)!;
  const orb = factory.spawnGhost(1716, 720, 2)!;
  arena.manager.commitUpdates();

  // Stage a charged body and overlap the actual orb/Brobot volumes. Charging
  // and steering are covered by possession.test; this isolates collision death.
  playerControl.ghostActive = true;
  playerControl.currentState = PlayerState.FROZEN;
  arena.time.update(1 / 60);
  brobot.update(0, arena.time.getGameTime());
  orb.update(0, arena.time.getGameTime());
  arena.collision.update(0);
  expect(brobot.lastReceivedHitType).toBe(HitType.POSSESS);
  componentOf<GhostComponent>(orb, GhostComponent)!.transferControl(orb);
  const driving = componentOf<GhostComponent>(brobot, GhostComponent)!;
  expect(driving.isReleased()).toBe(false);
  expect(brobot.team).toBe(Team.ENEMY);

  // A controlled Brobot retains Android's HIT/vulnerability volumes. The
  // Source takes a hit and kills it in the same collision pass, without a
  // release-button press or assigning either actor's health.
  brobot.setPosition(source.getPosition().x + 256, source.getPosition().y + 224);
  arena.time.update(1 / 60);
  source.update(0, arena.time.getGameTime());
  brobot.update(0, arena.time.getGameTime());
  arena.collision.update(0);
  expect(source.life).toBe(2);
  expect(brobot.life).toBe(0);
  expect(playerControl.ghostActive).toBe(true);
  const inventory = { ...getInventory() };
  const recordDefeat = spyOn(useGameStore.getState(), 'recordEnemyDefeat').mockImplementation(() => {});
  try {
    expect(resolveEnemyDeath(brobot)).toBe(true);
    expect(driving.isReleased()).toBe(true);
    expect(playerControl.ghostActive).toBe(false);
    expect<PlayerState>(playerControl.currentState).toBe(PlayerState.POST_GHOST_DELAY);
    expect(brobot.isMarkedForRemoval()).toBe(true);
    expect(resolveEnemyDeath(brobot)).toBe(false);
    expect(recordDefeat).toHaveBeenCalledTimes(1);
    expect(getInventory().score).toBe(inventory.score + 25);
    arena.manager.commitUpdates();
    expect(arena.manager.getActiveObjects().filter(object => object.subType === 'explosion_giant')).toHaveLength(1);
    playerControl.setSystems(new InputSystem(), sSystemRegistry.collisionSystem!, new SoundSystem(), arena.level);
    for (let frame = 0; frame < 100; frame++) {
      arena.time.update(1 / 60);
      player.update(1 / 60, arena.time.getGameTime());
    }
    expect<PlayerState>(playerControl.currentState).toBe(PlayerState.MOVE);
    expect(player.isVisible()).toBe(true);
    expect(playerControl.ghostActive).toBe(false);
    const game = await file(new URL('../components/Game.tsx', import.meta.url)).text();
    expect(game.includes('possessedCollision?.setCollisionVolumes(null, null)')).toBe(false);
  } finally {
    recordDefeat.mockRestore();
    setInventory(inventory);
  }
});

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

/** Let both the hit animation and invincibility expire between staged attacks. */
function recoverBoss(arena: Arena, boss: GameObject, time: number): number {
  for (let frame = 0; frame < 120; frame++) {
    time += 1 / 60;
    boss.update(1 / 60, time);
    arena.collision.update(1 / 60);
  }
  return time;
}

describe('boss fight composition', () => {
  for (const rendered of [false, true]) {
    test(`runtime Source matches the authored boss (renderer: ${rendered})`, async () => {
      const arena = await loadBossLevel();
      const factory = sSystemRegistry.gameObjectFactory!;
      const draws: Array<{ name: string; priority: number }> = [];
      if (rendered) factory.setRenderSystem({
        hasSprite: () => true,
        drawSprite: (name: string, _x: number, _y: number, _frame: number, priority: number) => {
          draws.push({ name, priority });
        },
      } as unknown as RenderSystem);
      const source = factory.spawn(GameObjectType.THE_SOURCE, 800, 200)!;
      expect([source.type, source.subType]).toEqual(['enemy', 'the_source']);
      expect([source.width, source.height, source.life, source.maxLife, source.team, source.activationRadius])
        .toEqual([512, 512, 3, 3, Team.PLAYER, -1]);
      expect(componentOf<OrbitalMagnetComponent>(source, OrbitalMagnetComponent)).not.toBeNull();
      expect(componentOf<MovementComponent>(source, MovementComponent)).toBeNull();
      expect(source.getComponents().filter(component => component instanceof FadeDrawableComponent)).toHaveLength(5);
      const sprites = source.getComponents().filter(component => component instanceof SpriteComponent);
      expect(sprites).toHaveLength(5);
      expect(sprites.map(sprite => sprite.getCurrentDraw()?.sprite)).toEqual([
        'source_spikes', 'source_body', 'source_black', 'source_spots', 'source_core',
      ]);
      const collision = componentOf<DynamicCollisionComponent>(source, DynamicCollisionComponent)!;
      expect(collision.getAttackVolumes()).toHaveLength(1);
      expect(collision.getVulnerabilityVolumes()).toHaveLength(1);
      for (const sprite of sprites) {
        expect(sprite.getCurrentAnimation()?.frames[0].width).toBe(512);
        expect(sprite.getCurrentAnimation()?.frames[0].height).toBe(512);
      }
      arena.time.update(0.1);
      source.update(0.1, arena.time.getGameTime());
      source.render();
      expect(source.getPosition()).toMatchObject({ x: 800, y: 200 });
      if (rendered) {
        expect(draws.length).toBeGreaterThan(0);
        for (const draw of draws) expect(draw.priority).toBe(
          SortConstants.THE_SOURCE_START + ['source_spikes', 'source_body', 'source_black', 'source_spots', 'source_core'].indexOf(draw.name)
        );
      }
    });
  }

  test('finale combat patrols repeat while the entrance copies obey their authored stops', async () => {
    const arena = await loadBossLevel();
    const bosses = arena.manager.getActiveObjects().filter(object =>
      object.subType === 'evil_kabocha' || object.subType === 'rokudou');
    expect(bosses).toHaveLength(4); // The shipped map has two of each rival.
    // The two entrance copies walk into the central room's STOP tiles. They
    // are not the roaming counterparts in the upper-right and left arenas.
    const entranceBosses = new Set(bosses.filter(boss =>
      boss.getPosition().x > 1000 && boss.getPosition().y > 900));
    expect(entranceBosses.size).toBe(2);
    const player = arena.manager.getPlayer()!;
    // Keep the original actors, terrain and hot spots, but simulate the whole
    // arena without camera culling or player combat. This checks sustained
    // scripts, not a normal-input boss victory or activation-radius behavior.
    const shooters = bosses.filter(boss => boss.subType === 'rokudou');
    const shots = shooters.flatMap(() => [new Set<number>(), new Set<number>()]);
    const previousShotCounts = shots.map(() => 0);
    // Attribute each real factory spawn to the actor currently updating, so
    // one healthy gun/duplicate boss cannot hide another stalled shooter.
    let updatingObject: GameObject | null = null;
    const factory = sSystemRegistry.gameObjectFactory!;
    const spawn = factory.spawn.bind(factory);
    factory.spawn = (...args: Parameters<typeof factory.spawn>): ReturnType<typeof factory.spawn> => {
      const shot = spawn(...args);
      const shooter = updatingObject ? shooters.indexOf(updatingObject) : -1;
      if (shot && shooter >= 0) {
        const gun = shot.subType === 'energy_ball' ? 0 : shot.subType === 'turret_bullet' ? 1 : -1;
        if (gun >= 0) shots[shooter * 2 + gun].add(shot.id);
      }
      return shot;
    };
    const directions = bosses.map(() => new Set<number>());
    const minX = bosses.map(() => Infinity);
    const maxX = bosses.map(() => -Infinity);
    for (let frame = 0; frame < 60 * 60; frame++) {
      arena.time.update(1 / 60);
      for (const object of arena.manager.getActiveObjects()) {
        if (object === player) continue;
        updatingObject = object;
        object.update(1 / 60, arena.time.getGameTime());
        updatingObject = null;
        if (object.type === 'npc') componentOf<NPCComponent>(object, NPCComponent)?.checkHotSpotsPostPhysics(object, 1 / 60);
      }
      arena.collision.update(1 / 60);
      arena.manager.commitUpdates();
      bosses.forEach((boss, index) => {
        directions[index].add(Math.sign(boss.getVelocity().x));
        minX[index] = Math.min(minX[index], boss.getPosition().x);
        maxX[index] = Math.max(maxX[index], boss.getPosition().x);
      });
      if (frame % 600 === 599) {
        bosses.forEach((boss, index) => {
          expect(boss.life).toBe(3);
          expect(boss.getPosition().y).toBeLessThan(1280);
          if (entranceBosses.has(boss)) {
            expect(sSystemRegistry.hotSpotSystem!.getHotSpot(boss.getCenteredPositionX(),
              boss.getPosition().y + boss.height - 10)).toBe(HotSpotType.NPC_STOP);
            expect(boss.getVelocity().x).toBe(0);
            expect(boss.getTargetVelocity().x).toBe(0);
            if (frame > 599) expect(maxX[index] - minX[index]).toBe(0);
          } else {
            expect(directions[index].has(-1)).toBe(true);
            expect(directions[index].has(1)).toBe(true);
            expect(maxX[index] - minX[index]).toBeGreaterThan(100);
          }
          directions[index].clear();
          minX[index] = Infinity;
          maxX[index] = -Infinity;
        });
        shots.forEach((ids, index) => {
          if (entranceBosses.has(shooters[Math.floor(index / 2)])) expect(ids.size).toBe(0);
          else expect(ids.size).toBeGreaterThan(previousShotCounts[index]);
          previousShotCounts[index] = ids.size;
        });
      }
    }
  }, 60000);

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
      let time = 0;
      const lives: number[] = [];
      for (let hit = 0; hit < 3; hit++) {
        if (hit > 0) time = recoverBoss(arena, boss, time);
        const player = makeStompingPlayer(boss);
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
      const startLife = boss.life;
      expect(startLife).toBe(3);

      const target = boss.getPosition();
      let time = 0;
      for (let hit = 0; hit < 3 && boss.life > 0; hit++) {
        // This stages separate attacks; do not carry the previous stomp's
        // completed landing/recovery state into the next sweep.
        component.reset();
        if (hit > 0) time = recoverBoss(arena, boss, time);
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

  for (const subType of ['evil_kabocha', 'rokudou']) {
    test(`${subType} stays unharmed by collapse blasts while surprised`, async () => {
      const arena = await loadBossLevel();
      const boss = findBoss(arena.manager, subType);
      sSystemRegistry.channelSystem!.registerChannel('SURPRISED')!.value = { value: true };
      // Keep the real NPC controller, animator and collision path running for
      // longer than the four-second surprise frame. Aim real factory blasts
      // at the moving boss so this does not depend on random Source offsets.
      for (let frame = 0; frame < 31 * 60; frame++) {
        arena.time.update(1 / 60);
        boss.update(1 / 60, arena.time.getGameTime());
        if (frame % 20 === 0) {
          sSystemRegistry.gameObjectFactory!.spawn(GameObjectType.EXPLOSION_GIANT,
            boss.getCenteredPositionX() - 32, boss.getCenteredPositionY() - 32);
        }
        arena.manager.commitUpdates();
        for (const blast of arena.manager.getActiveObjects().filter(o => o.subType === 'explosion_giant')) {
          blast.update(1 / 60, arena.time.getGameTime());
          if (blast.isMarkedForRemoval()) arena.manager.remove(blast);
        }
        arena.collision.update(1 / 60);
        arena.manager.commitUpdates();
        expect(boss.life).toBe(3);
        expect(componentOf<SpriteComponent>(boss, SpriteComponent)!.getCurrentAnimationIndex())
          .toBe(NPCAnimation.SURPRISED);
        expect(componentOf<DynamicCollisionComponent>(boss, DynamicCollisionComponent)!.getVulnerabilityVolumes())
          .toBeNull();
      }
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

  test('an airborne Rokudou gains death gravity, lands and reaches Kabocha ending', async () => {
    const arena = await loadBossLevel();
    const boss = findBoss(arena.manager, 'rokudou');
    const player = arena.manager.getPlayer()!;
    expect(componentOf<GravityComponent>(boss, GravityComponent)).toBeNull();
    // Stage the last hit above the arena's central pillar, without ground
    // contact or downward velocity. The other tests cover all three hits.
    boss.setPosition(player.getPosition().x - 48, player.getPosition().y - 160);
    boss.getVelocity().set(0, 0);
    boss.getTargetVelocity().set(0, 0);
    boss.setLastTouchedFloorTime(-100);
    boss.life = 1;
    const initialY = boss.getPosition().y;
    const blast = sSystemRegistry.gameObjectFactory!.spawn(GameObjectType.EXPLOSION_GIANT,
      boss.getCenteredPositionX() - 32, boss.getCenteredPositionY() - 32)!;
    const listener = (event: GameFlowEventType, index: number): void => { events.push({ event, index }); };
    gameFlowEvent.addListener(listener);
    let landed = false;
    try {
      for (let frame = 0; frame < 15 * 60; frame++) {
        arena.time.update(1 / 60);
        boss.update(1 / 60, arena.time.getGameTime());
        if (!blast.isMarkedForRemoval()) blast.update(1 / 60, arena.time.getGameTime());
        arena.collision.update(1 / 60);
        if (frame === 0) expect(boss.life).toBe(0);
        if (frame === 5) expect(componentOf<GravityComponent>(boss, GravityComponent)).not.toBeNull();
        if (boss.touchingGround()) landed = true;
        sSystemRegistry.screenFade!.update();
        gameFlowEvent.update();
      }
    } finally {
      gameFlowEvent.removeListener(listener);
    }
    expect(landed).toBe(true);
    expect(boss.getPosition().y).toBeGreaterThan(initialY);
    expect(boss.getComponents().filter(component => component instanceof GravityComponent)).toHaveLength(1);
    expect(events.filter(({ event }) => event === GameFlowEventType.SHOW_ANIMATION))
      .toEqual([{ event: GameFlowEventType.SHOW_ANIMATION, index: 2 }]);
  });

  for (const runtime of [false, true]) test(`three real enemy shots collapse The Source and trigger Wanda ending exactly once (runtime: ${runtime})`, async () => {
    const endings: string[] = [];
    const arena = await loadBossLevel(runtime ? undefined : (ending): void => { endings.push(ending); });
    let source = findBoss(arena.manager, 'the_source');
    const endingListener = (event: GameFlowEventType, index: number): void => {
      if (event === GameFlowEventType.SHOW_ANIMATION && index === 1) endings.push('WANDA_ENDING');
    };
    if (runtime) {
      const { x, y } = source.getPosition();
      arena.manager.remove(source);
      arena.manager.commitUpdates();
      source = sSystemRegistry.gameObjectFactory!.spawn(GameObjectType.THE_SOURCE, x, y)!;
      arena.manager.commitUpdates();
      gameFlowEvent.addListener(endingListener);
    }
    const rivals = ['evil_kabocha', 'rokudou'].map(name => findBoss(arena.manager, name));
    const behavior = componentOf<TheSourceComponent>(source, TheSourceComponent)!;
    const camera = sSystemRegistry.cameraSystem!;
    camera.setTarget(arena.manager.getPlayer());
    const factory = sSystemRegistry.gameObjectFactory!;
    const explosions = new Set<number>();

    const frame = (): void => {
      arena.time.update(1 / 60);
      source.update(1 / 60, arena.time.getGameTime());
      for (const rival of rivals) rival.update(1 / 60, arena.time.getGameTime());
      // Include the real end-of-frame fallback: it must not undo the Source's
      // scripted takeover after possession has returned the player camera.
      restorePlayerCamera(camera, arena.manager.getPlayer());
      if (behavior.isDead()) expect(camera.getTarget() === source).toBe(true);
      arena.manager.commitUpdates();
      const liveBlasts = arena.manager.getActiveObjects().filter((obj) => obj.subType === 'explosion_giant');
      expect(liveBlasts.length).toBeLessThanOrEqual(7);
      for (const effect of liveBlasts) {
        if (!explosions.has(effect.id)) {
          explosions.add(effect.id);
          expect(effect.team).toBe(Team.PLAYER);
          expect(componentOf<DynamicCollisionComponent>(effect, DynamicCollisionComponent)?.getAttackVolumes()).toHaveLength(1);
        }
        // Run real animation, sound, collision registration and expiry during
        // the whole collapse, including repeated reuse of pooled objects.
        effect.update(1 / 60, arena.time.getGameTime());
        if (effect.isMarkedForRemoval()) arena.manager.remove(effect);
      }
      arena.collision.update(1 / 60);
      expect(rivals.map(rival => rival.life)).toEqual([3, 3]);
      arena.manager.commitUpdates();
      sSystemRegistry.screenFade!.update();
      gameFlowEvent.update();
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
    expect(explosions.size).toBeGreaterThan(200);
    for (let i = 0; i < 90; i++) frame();
    expect(endings).toEqual([]);
    expect(sSystemRegistry.screenFade!.getOpacity()).toBeGreaterThan(0);
    expect(sSystemRegistry.screenFade!.getOpacity()).toBeLessThan(1);
    for (let i = 0; i < 90; i++) frame();
    expect(endings).toEqual(['WANDA_ENDING']);
    for (let i = 0; i < 120; i++) frame();
    expect(endings).toEqual(['WANDA_ENDING']);
    gameFlowEvent.removeListener(endingListener);
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
        arena.time.update(1 / 60);
        time += 1 / 60;
        boss.setGameTime(time);
        boss.setLastTouchedFloorTime(time);
        boss.getVelocity().set(0, 0);
        npc.update(1 / 60, boss);
        sSystemRegistry.screenFade!.update();
        gameFlowEvent.update();
        if (frame === 300) {
          expect(events).toEqual([]); // 4s death delay, then a 1.5s fade.
          expect(sSystemRegistry.screenFade!.getOpacity()).toBeGreaterThan(0);
          expect(sSystemRegistry.screenFade!.getOpacity()).toBeLessThan(1);
        }
      }
      gameFlowEvent.removeListener(listener);

      const animations = events.filter((e) => e.event === GameFlowEventType.SHOW_ANIMATION);
      expect(animations).toHaveLength(1);
      expect(animations[0].index).toBe(expected as unknown as CutsceneType);
    });
  }
});

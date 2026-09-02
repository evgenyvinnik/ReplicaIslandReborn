/**
 * Headless gameplay simulation over the shipped campaign.
 *
 * `campaignLevels.test.ts` proves every level parses and spawns. This file goes
 * one step further and actually *runs* the frame loop against the real
 * components, which is where "loads fine but is unplayable" regressions show up:
 * an object type that throws on its first update, a player that sinks through
 * the floor, or input that never reaches PlayerComponent.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { GameFlowEvent, GameFlowEventType } from '../engine/GameFlowEvent';
import { TimeSystem } from '../engine/TimeSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { DifficultySettings } from '../stores/useGameStore';
import { LevelSystem } from './LevelSystemNew';
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
import { ActionType, HitType } from '../types';
import { GravityComponent } from '../entities/components/GravityComponent';
import { ChangeComponentsComponent } from '../entities/components/ChangeComponentsComponent';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { LauncherComponent } from '../entities/components/LauncherComponent';
import { SolidSurfaceComponent } from '../entities/components/SolidSurfaceComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { NPCAnimation } from '../entities/components/NPCAnimationComponent';
import { GameObjectTypeIndex } from '../types/GameObjectTypes';
import type { GameObject } from '../entities/GameObject';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

const FRAME = 1 / 60;

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

interface Harness {
  levelSystem: LevelSystem;
  manager: GameObjectManager;
  collision: CollisionSystem;
  input: InputSystem;
  flow: GameFlowEvent;
  time: TimeSystem;
  run: (frames: number) => void;
}

/**
 * Build the subset of the runtime that gameplay actually needs. No canvas, no
 * audio device: SoundSystem no-ops without an AudioContext and CameraSystem only
 * needs a viewport to decide activation.
 */
function createHarness(): Harness {
  sSystemRegistry.reset();

  const collision = new CollisionSystem();
  const manager = new GameObjectManager();
  const hotSpots = new HotSpotSystem();
  const camera = new CameraSystem(480, 320);
  const input = new InputSystem();
  const sound = new SoundSystem();
  const objectCollision = new GameObjectCollisionSystem();
  const flow = new GameFlowEvent();
  const time = new TimeSystem();

  const levelSystem = new LevelSystem();
  levelSystem.setSystems(collision, manager, hotSpots);
  manager.setCamera(camera);

  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(input, 'input');
  sSystemRegistry.register(sound, 'sound');
  sSystemRegistry.register(objectCollision, 'gameObjectCollision');
  sSystemRegistry.register(flow, 'gameFlowEvent');
  sSystemRegistry.register(time, 'time');

  let gameTime = 0;
  const run = (frames: number): void => {
    for (let i = 0; i < frames; i++) {
      time.update(FRAME);
      gameTime = time.getGameTime();
      const player = manager.getPlayer();
      if (player) {
        player.setGameTime(gameTime);
        const component = player.getComponent(PlayerComponent);
        if (component && !component.hasSystemsInjected()) {
          component.setSystems(input, collision, sound, levelSystem);
        }
      }
      // Keep the camera on the player so activation radii behave like the game.
      if (player) {
        camera.setPosition(
          player.getPosition().x + player.width / 2,
          player.getPosition().y + player.height / 2
        );
      }
      manager.update(FRAME, gameTime);
      // Mirrors Game.tsx: volumes are submitted at FRAME_END, resolved here.
      objectCollision.update(FRAME);
      flow.update();
    }
  };

  return { levelSystem, manager, collision, input, flow, time, run };
}

/** Levels that spawn a controllable player, in campaign order. */
async function playableLevels(): Promise<Array<{ resource: string; levelId: number }>> {
  const result: Array<{ resource: string; levelId: number }> = [];
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      const source = await file(
        join(publicDirectory, `assets/levels/${entry.resource}.json`)
      ).json() as { layers: Array<{ type: string; world: { tiles: number[][] } }> };
      const hasPlayer = source.layers
        .find((layer) => layer.type === 'objects')
        ?.world.tiles.some((row) => row.includes(0)) ?? false;
      if (hasPlayer) {
        result.push({ resource: entry.resource, levelId: resourceToLevelId[entry.resource] });
      }
    }
  }
  return result;
}

describe('campaign gameplay simulation', () => {
  test('every playable level survives a second of simulation with input held', async () => {
    const levels = await playableLevels();
    expect(levels.length).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const { resource, levelId } of levels) {
      const harness = createHarness();
      expect(await harness.collision.loadCollisionData('/assets/collision.json'), resource).toBe(true);
      expect(await harness.levelSystem.loadLevel(levelId), resource).toBe(true);
      harness.manager.commitUpdates();

      const player = harness.manager.getPlayer();
      if (!player) {
        failures.push(`${resource}: no player after load`);
        continue;
      }

      harness.input.setVirtualAxis('horizontal', 1);
      harness.input.setVirtualButton('fly', true);

      try {
        harness.run(60);
      } catch (error) {
        failures.push(`${resource}: threw during update -> ${(error as Error).message}`);
        continue;
      }

      const position = player.getPosition();
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        failures.push(`${resource}: player position became ${position.x},${position.y}`);
      }

      const { height: levelHeight } = harness.levelSystem.getLevelSize();
      if (position.y > levelHeight + 512) {
        failures.push(`${resource}: player fell far below the level (y=${position.y.toFixed(0)})`);
      }
    }

    expect(failures).toEqual([]);
  }, 60_000);

  test('every enemy the campaign spawns is wired into the collision pipeline', async () => {
    const levels = await playableLevels();
    const seen = new Set<string>();
    const unwired: string[] = [];

    for (const { resource, levelId } of levels) {
      const harness = createHarness();
      expect(await harness.levelSystem.loadLevel(levelId), resource).toBe(true);
      harness.manager.commitUpdates();

      for (const object of harness.manager.getActiveObjects()) {
        if (object.type !== 'enemy') continue;
        seen.add(object.subType);

        // Either the shared profile wired it, or it is a boss that configures
        // its own volumes. Anything else can neither hit nor be hit.
        const collision = object.getComponent(
          DynamicCollisionComponent as unknown as new (...args: unknown[]) => DynamicCollisionComponent
        );
        const reaction = object.getComponent(
          HitReactionComponent as unknown as new (...args: unknown[]) => HitReactionComponent
        );
        if (!collision || !reaction) {
          const key = `${object.subType} (${resource})`;
          if (!unwired.includes(key)) unwired.push(key);
        }
      }
    }

    expect(seen.size).toBeGreaterThan(5);
    expect(unwired).toEqual([]);
  }, 60_000);

  test('solid-bodied campaign enemies retain their original surface geometry', async () => {
    const expectedSurfaceCounts: Readonly<Record<string, number>> = {
      skeleton: 2,
      mudman: 4,
      pink_namazu: 5,
    };
    const seen = new Set<string>();

    for (const group of linearLevelTree) {
      for (const entry of group.levels) {
        const harness = createHarness();
        expect(
          await harness.levelSystem.loadLevel(resourceToLevelId[entry.resource]),
          entry.resource
        ).toBe(true);
        harness.manager.commitUpdates();

        for (const object of harness.manager.getActiveObjects()) {
          const expectedCount = expectedSurfaceCounts[object.subType];
          if (expectedCount === undefined) continue;
          seen.add(object.subType);
          const surface = object.getComponent(
            SolidSurfaceComponent as unknown as new (...args: unknown[]) => SolidSurfaceComponent
          );
          expect(surface, `${object.subType} in ${entry.resource}`).not.toBeNull();
          expect(surface!.getSurfaces(), `${object.subType} in ${entry.resource}`)
            .toHaveLength(expectedCount);
        }
      }
    }

    expect([...seen].sort()).toEqual(Object.keys(expectedSurfaceCounts).sort());
  }, 60_000);

  test('repeated attempts at a level quietly boost the player', async () => {
    const levels = await playableLevels();

    const spawnWithAttempts = async (attempts: number): Promise<GameObject> => {
      const harness = createHarness();
      harness.levelSystem.setPlayerMaxLife(DifficultySettings.kids.playerMaxLife);
      expect(await harness.levelSystem.loadLevel(levels[0].levelId)).toBe(true);
      harness.manager.commitUpdates();
      const player = harness.manager.getPlayer() as GameObject;
      const component = player.getComponent(PlayerComponent) as PlayerComponent;
      component.applyDifficulty(DifficultySettings.kids, attempts, player);
      return player;
    };

    const firstTry = await spawnWithAttempts(1);
    expect(firstTry.life).toBe(DifficultySettings.kids.playerMaxLife);

    const struggling = await spawnWithAttempts(DifficultySettings.kids.ddaStage1Attempts);
    expect(struggling.life).toBe(
      DifficultySettings.kids.playerMaxLife + DifficultySettings.kids.ddaStage1LifeBoost
    );

    const reallyStruggling = await spawnWithAttempts(DifficultySettings.kids.ddaStage2Attempts);
    expect(reallyStruggling.life).toBe(
      DifficultySettings.kids.playerMaxLife + DifficultySettings.kids.ddaStage2LifeBoost
    );
  });

  test("the player's GameObject action tracks its state", async () => {
    // The original sets this in gotoMove/gotoStomp/stateDead/gotoFrozen.
    // Leaving it at INVALID means anything gating on requiredAction can never
    // fire for Andou.
    const levels = await playableLevels();
    const harness = createHarness();
    expect(await harness.levelSystem.loadLevel(levels[0].levelId)).toBe(true);
    harness.manager.commitUpdates();

    const player = harness.manager.getPlayer() as GameObject;
    const component = player.getComponent(PlayerComponent) as PlayerComponent;

    harness.run(10);
    expect(player.getCurrentAction()).toBe(ActionType.MOVE);

    component.currentState = PlayerState.STOMP;
    harness.run(1);
    expect(player.getCurrentAction()).toBe(ActionType.ATTACK);

    component.currentState = PlayerState.FROZEN;
    harness.run(1);
    expect(player.getCurrentAction()).toBe(ActionType.FROZEN);
  });

  test('possessable enemies get their possession swap at spawn', async () => {
    // attachPossession() reads the vulnerability volumes, so they have to be
    // primed at spawn rather than on the first update - otherwise every enemy
    // silently loses the ability to be possessed.
    const levels = await playableLevels();
    let checked = 0;

    for (const { resource, levelId } of levels) {
      const harness = createHarness();
      expect(await harness.levelSystem.loadLevel(levelId), resource).toBe(true);
      harness.manager.commitUpdates();

      for (const object of harness.manager.getActiveObjects()) {
        if (object.subType !== 'brobot' && object.subType !== 'turret') continue;
        const swap = object.getComponent(
          ChangeComponentsComponent as unknown as new (...args: unknown[]) => ChangeComponentsComponent
        );
        expect(swap, `${object.subType} in ${resource} cannot be possessed`).not.toBeNull();
        checked++;
      }
      if (checked > 0) break;
    }

    expect(checked).toBeGreaterThan(0);
  }, 60_000);

  test('a scripted NPC walks its hot-spot route under component physics', async () => {
    // Wanda's intro run used to be driven by an inline copy of gravity,
    // velocity interpolation and tile snapping in Game.tsx. She now moves on
    // GravityComponent + MovementComponent like everything else, so this pins
    // that the cutscene still plays.
    const harness = createHarness();
    expect(await harness.levelSystem.loadLevel(resourceToLevelId.level_0_1_sewer)).toBe(true);
    harness.manager.commitUpdates();

    const wanda = harness.manager
      .getActiveObjects()
      .find((object) => object.subType === 'wanda') as GameObject;
    expect(wanda).toBeDefined();

    const startX = wanda.getPosition().x;
    const startY = wanda.getPosition().y;
    harness.run(60);
    // Gravity should have dropped her out of her spawn perch.
    expect(wanda.getPosition().y).toBeGreaterThan(startY);

    harness.run(360);
    // The NPC_GO_RIGHT hot spot on her landing tile should have her walking.
    expect(wanda.getPosition().x).toBeGreaterThan(startX + 100);
  });

  test('both NPC-only opening scenes traverse their route and end the level', async () => {
    for (const resource of ['level_0_1_sewer', 'level_0_1_sewer_wanda'] as const) {
      const harness = createHarness();
      expect(await harness.collision.loadCollisionData('/assets/collision.json')).toBe(true);
      expect(await harness.levelSystem.loadLevel(resourceToLevelId[resource]), resource).toBe(true);
      harness.manager.commitUpdates();

      const events: Array<{ event: GameFlowEventType; index: number }> = [];
      harness.flow.addListener((event, index) => events.push({ event, index }));

      // These scenes are authored as autonomous NPC routes. Sixty seconds is
      // comfortably beyond their walk/wait/dialog sequence while still
      // catching a character stuck at a missed hot spot.
      harness.run(60 * 60);

      const wanda = harness.manager.getActiveObjects().find(
        (object) => object.subType === 'wanda'
      );
      const wandaState = wanda
        ? `${wanda.getPosition().x.toFixed(1)},${wanda.getPosition().y.toFixed(1)} ` +
          `action=${wanda.getCurrentAction()} velocity=${wanda.getVelocity().x.toFixed(1)},` +
          `${wanda.getVelocity().y.toFixed(1)}`
        : 'missing';

      expect(
        events.some(({ event }) => event === GameFlowEventType.GO_TO_NEXT_LEVEL),
        `${resource} never reached its END_LEVEL hot spot; Wanda=${wandaState}; ` +
          `events=${JSON.stringify(events)}`
      ).toBe(true);
    }
  }, 60_000);

  test('touching Kabocha opens the conversation selected under Kabocha, once', async () => {
    const harness = createHarness();
    expect(await harness.levelSystem.loadLevel(resourceToLevelId.level_0_2_lab)).toBe(true);
    harness.manager.commitUpdates();

    const player = harness.manager.getPlayer() as GameObject;
    const kabocha = harness.manager
      .getActiveObjects()
      .find((object) => object.subType === 'kabocha') as GameObject;
    expect(player).toBeDefined();
    expect(kabocha).toBeDefined();

    const events: Array<{ event: GameFlowEventType; index: number }> = [];
    harness.flow.addListener((event, index) => events.push({ event, index }));

    // Let NPCComponent read the NPC_SELECT_DIALOG tile beneath Kabocha, then
    // overlap Andou's COLLECT volume with Kabocha's vulnerability volume.
    harness.run(120);
    // Kabocha crosses WALK_AND_TALK on the way down, producing the automatic
    // opening line. The collision below is the separate touch conversation.
    events.length = 0;
    player.setPosition(kabocha.getPosition().x, kabocha.getPosition().y + 40);
    player.getVelocity().zero();
    player.getTargetVelocity().zero();
    harness.run(2);

    expect(events).toEqual([
      { event: GameFlowEventType.SHOW_DIALOG_CHARACTER2, index: 0 },
    ]);

    // Continuous body contact must not reopen the same dialog every frame.
    harness.run(120);
    expect(events).toHaveLength(1);
  });

  test('every shipped story touch target is connected to COLLECT collision', async () => {
    const seen = new Set<string>();
    const unwired: string[] = [];

    for (const group of linearLevelTree) {
      for (const entry of group.levels) {
        const harness = createHarness();
        const levelId = resourceToLevelId[entry.resource];
        expect(await harness.levelSystem.loadLevel(levelId), entry.resource).toBe(true);
        harness.manager.commitUpdates();

        for (const object of harness.manager.getActiveObjects()) {
          const isStoryNpc = object.type === 'npc' &&
            ['wanda', 'kyle', 'kabocha'].includes(object.subType);
          const isTouchTarget = isStoryNpc ||
            object.type === 'terminal' ||
            object.type === 'hint_sign' ||
            object.subType === 'kyle_dead';
          if (!isTouchTarget) continue;

          seen.add(object.subType || object.type);
          const collision = object.getComponent(
            DynamicCollisionComponent as unknown as new (...args: unknown[]) => DynamicCollisionComponent
          );
          const reaction = object.getComponent(
            HitReactionComponent as unknown as new (...args: unknown[]) => HitReactionComponent
          );
          const acceptsCollect = collision?.getVulnerabilityVolumes()?.some(
            (volume) => volume.getHitType() === HitType.COLLECT
          );
          if (!collision || !reaction || !acceptsCollect) {
            unwired.push(`${entry.resource}: ${object.subType || object.type}`);
          }
        }
      }
    }

    expect([...seen].sort()).toEqual(['kabocha', 'kyle', 'kyle_dead', 'rokudou', 'wanda']);
    expect(unwired).toEqual([]);
  }, 60_000);

  test('Kyle dash frames hit and launch Andou', async () => {
    const harness = createHarness();
    expect(await harness.levelSystem.loadLevel(resourceToLevelId.level_2_1_grass)).toBe(true);
    harness.manager.commitUpdates();

    const player = harness.manager.getPlayer() as GameObject;
    const kyle = harness.manager
      .getActiveObjects()
      .find((object) => object.subType === 'kyle') as GameObject;
    expect(player).toBeDefined();
    expect(kyle).toBeDefined();
    // Kyle starts far enough from this level's camera to deactivate on the
    // first frame, so retain the spawned object before priming Andou's frames.
    harness.run(2);

    const sprite = kyle.getComponent(
      SpriteComponent as unknown as new (...args: unknown[]) => SpriteComponent
    ) as SpriteComponent;
    const kyleCollision = kyle.getComponent(
      DynamicCollisionComponent as unknown as new (...args: unknown[]) => DynamicCollisionComponent
    ) as DynamicCollisionComponent;
    const playerCollision = player.getComponent(
      DynamicCollisionComponent as unknown as new (...args: unknown[]) => DynamicCollisionComponent
    ) as DynamicCollisionComponent;
    const launcher = kyle.getComponent(
      LauncherComponent as unknown as new (...args: unknown[]) => LauncherComponent
    ) as LauncherComponent;

    const dash = sprite.findAnimation(NPCAnimation.RUN);
    expect(dash).not.toBeNull();
    for (const frame of dash!.frames) {
      expect(frame.attackVolumes?.map((volume) => volume.getHitType())).toEqual([
        HitType.HIT,
        HitType.COLLECT,
      ]);
      expect(frame.vulnerabilityVolumes?.map((volume) => volume.getHitType())).toEqual([
        HitType.COLLECT,
      ]);
    }

    // Apply the dash frame, register both bodies, and resolve the same dynamic
    // collision pipeline the game uses after FRAME_END.
    sprite.playAnimation(NPCAnimation.RUN);
    sprite.update(0, kyle);
    player.setPosition(kyle.getPosition().x, kyle.getPosition().y + 40);
    player.getVelocity().zero();
    kyleCollision.update(0, kyle);
    playerCollision.update(0, player);
    sSystemRegistry.gameObjectCollisionSystem?.update(0);

    expect(launcher.getLoadedShot()).toBe(player);
    harness.time.update(FRAME);
    launcher.update(0, kyle);
    // Kyle starts facing left in this level. Andou should leave the impact
    // moving left and upward, not with the flattened Y velocity the port had.
    expect(player.getVelocity().x).toBeLessThan(-900);
    expect(player.getVelocity().y).toBeLessThan(-100);
  });

  test('an enemy falls and rests on the ground under component physics', async () => {
    const levels = await playableLevels();
    for (const { resource, levelId } of levels) {
      const harness = createHarness();
      expect(await harness.levelSystem.loadLevel(levelId), resource).toBe(true);
      harness.manager.commitUpdates();

      const grounded = harness.manager
        .getActiveObjects()
        .find((object) => object.type === 'enemy'
          && object.getComponent(
            GravityComponent as unknown as new (...args: unknown[]) => GravityComponent
          ) !== null);
      if (!grounded) continue;

      const startY = grounded.getPosition().y;
      harness.run(120);
      // It either fell to the floor or was already standing on it, but it must
      // not have sunk through the world.
      expect(grounded.getPosition().y, resource).toBeGreaterThanOrEqual(startY);
      expect(grounded.getPosition().y, resource)
        .toBeLessThan(harness.levelSystem.getLevelHeight() + 64);
      return;
    }
  });

  test('a grounded player walks when the movement axis is held', async () => {
    const harness = createHarness();
    const levels = await playableLevels();
    const first = levels[0];
    expect(await harness.levelSystem.loadLevel(first.levelId)).toBe(true);
    harness.manager.commitUpdates();

    const player = harness.manager.getPlayer() as GameObject;
    // Let the player settle onto the floor before measuring.
    harness.run(30);
    const startX = player.getPosition().x;

    harness.input.setVirtualAxis('horizontal', 1);
    harness.run(30);

    expect(player.getPosition().x).toBeGreaterThan(startX);
  });

  test('a new level keeps grounded controls when the game clock is already advanced', async () => {
    const harness = createHarness();
    // Game.tsx owns one TimeSystem for the whole session; loading a level does
    // not reset it. Reproduce a transition after several minutes of play.
    harness.time.update(180);
    expect(await harness.levelSystem.loadLevel(resourceToLevelId.level_0_2_lab)).toBe(true);
    harness.manager.commitUpdates();

    const player = harness.manager.getPlayer() as GameObject;
    harness.run(120);
    expect(player.touchingGround()).toBe(true);

    const restingY = player.getPosition().y;
    harness.input.setVirtualButton('fly', true);
    harness.run(2);
    expect(player.getVelocity().y).toBeLessThan(0);
    expect(player.getPosition().y).toBeLessThan(restingY);
  });

  test('a player holding fly leaves the ground and burns fuel', async () => {
    const harness = createHarness();
    const levels = await playableLevels();
    expect(await harness.levelSystem.loadLevel(levels[0].levelId)).toBe(true);
    harness.manager.commitUpdates();

    const player = harness.manager.getPlayer() as GameObject;
    const component = player.getComponent(PlayerComponent) as PlayerComponent;
    harness.run(30);

    const restingY = player.getPosition().y;
    harness.input.setVirtualButton('fly', true);
    harness.run(60);

    expect(player.getPosition().y).toBeLessThan(restingY);
    expect(component.fuel).toBeLessThan(1);
  });

  test('the player spawns with the difficulty\'s hit points, not a hardcoded 1', async () => {
    const levels = await playableLevels();

    for (const life of [2, 3, 5]) {
      const harness = createHarness();
      harness.levelSystem.setPlayerMaxLife(life);
      expect(await harness.levelSystem.loadLevel(levels[0].levelId)).toBe(true);
      harness.manager.commitUpdates();

      const player = harness.manager.getPlayer() as GameObject;
      // HitReactionComponent stops reacting once life hits 0, so a player pinned
      // at life 1 silently loses knockback and invincibility after one hit.
      expect(player.life).toBe(life);
      expect(player.maxLife).toBe(life);
    }
  });

  test('every object type present in shipped level data has a spawn implementation', async () => {
    const { readdirSync } = await import('node:fs');
    const levelFiles = readdirSync(join(publicDirectory, 'assets/levels'))
      .filter((name) => name.endsWith('.json'));

    const usedTypes = new Set<number>();
    for (const name of levelFiles) {
      const data = await file(join(publicDirectory, 'assets/levels', name)).json() as {
        layers?: Array<{ type: string; world: { tiles: number[][] } }>;
      };
      const objects = data.layers?.find((layer) => layer.type === 'objects');
      if (!objects) continue;
      for (const row of objects.world.tiles) {
        for (const tile of row) {
          if (tile >= 0) usedTypes.add(tile);
        }
      }
    }

    const source = await file(join(import.meta.dir, 'LevelSystemNew.ts')).text();
    const handledNames = new Set(
      [...source.matchAll(/case GameObjectTypeIndex\.([A-Z0-9_]+)/g)].map((match) => match[1])
    );
    const handledIndices = new Set(
      [...handledNames]
        .map((name) => (GameObjectTypeIndex as Record<string, number>)[name])
        .filter((value): value is number => typeof value === 'number')
    );

    // Guard against the scan silently matching nothing and passing vacuously.
    expect(usedTypes.size).toBeGreaterThan(20);
    expect(handledIndices.size).toBeGreaterThan(20);

    const unimplemented = [...usedTypes].filter((type) => !handledIndices.has(type)).sort((a, b) => a - b);
    expect(unimplemented).toEqual([]);
  });

  test('stomping from the air enters the STOMP state and drives the player down', async () => {
    const harness = createHarness();
    const levels = await playableLevels();
    expect(await harness.levelSystem.loadLevel(levels[0].levelId)).toBe(true);
    harness.manager.commitUpdates();

    const player = harness.manager.getPlayer() as GameObject;
    const component = player.getComponent(PlayerComponent) as PlayerComponent;

    harness.run(30);
    harness.input.setVirtualButton('fly', true);
    harness.run(60);
    harness.input.setVirtualButton('fly', false);

    harness.input.setVirtualButton('stomp', true);
    harness.run(2);

    expect(component.currentState).toBe(PlayerState.STOMP);
    expect(player.getVelocity().y).toBeGreaterThan(0);
  });
});

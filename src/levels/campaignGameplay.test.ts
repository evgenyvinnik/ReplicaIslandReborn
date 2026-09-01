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
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
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

  const levelSystem = new LevelSystem();
  levelSystem.setSystems(collision, manager, hotSpots);
  manager.setCamera(camera);

  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.register(camera, 'camera');
  sSystemRegistry.register(input, 'input');
  sSystemRegistry.register(sound, 'sound');

  let gameTime = 0;
  const run = (frames: number): void => {
    for (let i = 0; i < frames; i++) {
      gameTime += FRAME;
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
    }
  };

  return { levelSystem, manager, collision, input, run };
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

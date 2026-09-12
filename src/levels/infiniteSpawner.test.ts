import { afterEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { LevelParser } from './LevelParser';
import { LevelSystem } from './LevelSystemNew';
import { resourceToLevelId } from '../data/levelTree';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory } from '../entities/GameObjectFactory';
import type { GameObject } from '../entities/GameObject';
import { LaunchProjectileComponent } from '../entities/components/LaunchProjectileComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { SolidSurfaceComponent } from '../entities/components/SolidSurfaceComponent';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { TimeSystem } from '../engine/TimeSystem';
import type { RenderSystem } from '../engine/RenderSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { Team } from '../types';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; sSystemRegistry.reset(); });

async function benchmark(): Promise<{
  manager: GameObjectManager; machine: GameObject; time: TimeSystem; advance: (dt: number) => void;
}> {
  // Exercise the actual original benchmark through the converted-level loader,
  // without adding this debug map to the campaign or changing shipped assets.
  const native = new LevelParser().parseLevelData(new Uint8Array(await file(
    join(import.meta.dir, '../../Original/res/raw/performancetest4.bin')
  ).arrayBuffer()))!;
  const data = {
    format: 'replica-island-level', version: 1,
    background: native.backgroundImage, backgroundId: native.backgroundIndex,
    layers: native.layers.map(layer => ({
      type: ['background', 'collision', 'objects', 'hotspots'][layer.type],
      typeId: layer.type, theme: 'grass', themeId: layer.themeIndex,
      scrollSpeed: layer.scrollSpeed,
      world: { width: layer.world.width, height: layer.world.height,
        tiles: Array.from({ length: layer.world.height }, (_, y) =>
          Array.from({ length: layer.world.width }, (_, x) => layer.world.tiles[x][y])),
      },
    })),
  };
  globalThis.fetch = (async () => new Response(JSON.stringify(data))) as unknown as typeof fetch;
  const manager = new GameObjectManager();
  const time = new TimeSystem();
  sSystemRegistry.gameObjectManager = manager;
  sSystemRegistry.gameObjectFactory = new GameObjectFactory(manager);
  sSystemRegistry.timeSystem = time;
  const level = new LevelSystem();
  level.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
  expect(await level.loadLevel(resourceToLevelId.level_0_3_lab)).toBe(true);
  manager.commitUpdates();
  const machines = manager.getActiveObjects().filter(object => object.type === 'spawner');
  expect(machines).toHaveLength(1);
  const machine = machines[0];
  const launcher = machine.getComponent(
    LaunchProjectileComponent as unknown as new (...args: unknown[]) => LaunchProjectileComponent
  )!;
  const advance = (dt: number): void => {
    time.update(dt);
    launcher.update(dt, machine);
    manager.commitUpdates();
  };
  return { manager, machine, time, advance };
}

test('the original benchmark machine retains its visible, vertically flipped solid body', async () => {
  const { machine } = await benchmark();
  expect([machine.width, machine.height]).toEqual([64, 64]);
  expect(machine.team).toBe(Team.ENEMY);
  expect([machine.facingDirection.x, machine.facingDirection.y]).toEqual([1, -1]);
  const solid = machine.getComponent(
    SolidSurfaceComponent as unknown as new (...args: unknown[]) => SolidSurfaceComponent
  );
  expect(solid?.getSurfaces()).toHaveLength(3);
  const sprite = machine.getComponent(SpriteComponent)!;
  const calls: Parameters<RenderSystem['drawSprite']>[] = [];
  sprite.setRenderSystem({
    hasSprite: () => true,
    drawSprite: (...args: Parameters<RenderSystem['drawSprite']>): void => { calls.push(args); },
  } as unknown as RenderSystem);
  sprite.render(machine);
  expect(calls).toHaveLength(1);
  expect(calls[0][0]).toBe('object_brobot_machine');
  expect(calls[0][6]).toBe(1);
  expect(calls[0][7]).toBe(-1);
});

test('the original benchmark emits one delayed 60-shot burst, not endless slow stationary robots', async () => {
  const { manager, machine, time, advance } = await benchmark();
  const robots = (): GameObject[] => manager.getActiveObjects().filter(o => o.subType === 'brobot');
  advance(0);
  advance(2.99);
  expect(robots()).toHaveLength(0);
  advance(0.02);
  expect(robots()).toHaveLength(1);
  const first = robots()[0];
  expect(first.getVelocity().x).toBe(100);
  expect(first.getVelocity().y).toBe(-300);
  // Vertical facing mirrors the muzzle, not the inherited launch velocity.
  expect(first.getPosition().x).toBe(machine.getPosition().x + 36 - 32);
  expect(first.getPosition().y).toBe(machine.getPosition().y + 50 - 32);
  time.pause();
  for (let i = 0; i < 60; i++) advance(1);
  expect(robots()).toHaveLength(1);
  time.resume();
  advance(0.149);
  expect(robots()).toHaveLength(1);
  advance(0.002);
  expect(robots()).toHaveLength(2);
  // Existing robots stay alive: this variant deliberately disables tracking.
  for (let i = 2; i < 60; i++) advance(0.151);
  expect(robots()).toHaveLength(60);
  expect(robots().every(o => o.life > 0)).toBe(true);
  for (let i = 0; i < 100; i++) advance(1);
  expect(robots()).toHaveLength(60);
});

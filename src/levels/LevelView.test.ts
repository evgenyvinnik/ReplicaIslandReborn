import { afterEach, beforeEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CameraSystem } from '../engine/CameraSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObjectManager } from '../entities/GameObjectManager';
import { resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { focusLevelCamera, LevelBackgroundLoader } from './LevelView';

const originalFetch = globalThis.fetch;
const originalImage = globalThis.Image;
class PendingImage {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { images.push(this); }
}
let images: PendingImage[] = [];

beforeEach(() => {
  images = [];
  globalThis.Image = PendingImage as unknown as typeof Image;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
    return new Response(await file(join(import.meta.dir, '../../public', path.replace(/^\//, ''))).arrayBuffer());
  }) as typeof fetch;
  sSystemRegistry.reset();
});
afterEach(() => {
  globalThis.Image = originalImage;
  globalThis.fetch = originalFetch;
  sSystemRegistry.reset();
});

test('background changes clear the previous scene and ignore out-of-order loads', () => {
  const published: (HTMLImageElement | null)[] = [];
  const loader = new LevelBackgroundLoader(image => { published.push(image); });
  loader.load('background_lab');
  loader.load('background_island');
  expect(published).toEqual([null, null]);
  expect(images[1].src).toEndWith('/assets/sprites/background_island.png');
  images[1].onload?.();
  expect(published[published.length - 1]).toBe(images[1] as unknown as HTMLImageElement);
  images[0].onload?.();
  images[0].onerror?.();
  expect(published[published.length - 1]).toBe(images[1] as unknown as HTMLImageElement);
  loader.load('missing');
  images[2].onerror?.();
  expect(published[published.length - 1]).toBeNull();
  loader.load(undefined);
  expect(images).toHaveLength(3);
  expect(published[published.length - 1]).toBeNull();
});

test('disposed background loaders cannot publish into a replacement game', () => {
  const published: (HTMLImageElement | null)[] = [];
  const loader = new LevelBackgroundLoader(image => { published.push(image); });
  loader.load('background_lab');
  loader.dispose();
  images[0].onload?.();
  images[0].onerror?.();
  loader.load('background_island');
  expect(published).toEqual([null]);
  expect(images).toHaveLength(1);
});

test('campaign transitions and retries focus newly loaded players or NPCs', async () => {
  const manager = new GameObjectManager();
  const level = new LevelSystem();
  const camera = new CameraSystem(480, 320);
  level.setSystems(new CollisionSystem(), manager);
  sSystemRegistry.register(manager, 'gameObject');
  let previousTarget = camera.getTarget();
  try {
    for (const resource of ['level_0_1_sewer', 'level_0_2_lab', 'level_0_2_lab', 'level_0_1_sewer'] as const) {
      expect(await level.loadLevel(resourceToLevelId[resource])).toBe(true);
      manager.commitUpdates();
      focusLevelCamera(level, manager, camera, 320);
      const player = manager.getPlayer();
      const target = player ?? manager.getActiveObjects().find(object => object.type === 'npc');
      expect(target).toBeTruthy();
      expect(camera.getTarget()).toBe(target!);
      expect(camera.getTarget()).not.toBe(previousTarget);
      expect(camera.isNPCFocusMode()).toBe(!player);
      expect(Boolean(player)).toBe(resource === 'level_0_2_lab');
      const expectedX = Math.max(0, Math.min(target!.getCenteredPositionX() - 240, level.getLevelWidth() - 480));
      const expectedY = player
        ? Math.max(0, Math.min(player.getCenteredPositionY() - 160, level.getLevelHeight() - 320))
        : level.getLevelHeight() - 320;
      expect(camera.getPosition().x).toBe(expectedX);
      expect(camera.getPosition().y).toBe(expectedY);
      previousTarget = camera.getTarget();
    }
  } finally {
    level.dispose();
  }
});

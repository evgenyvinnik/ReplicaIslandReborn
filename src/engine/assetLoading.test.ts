import { expect, test } from 'bun:test';
import { RenderSystem } from './RenderSystem';
import { EffectsSystem } from './EffectsSystem';

test('required tileset failures propagate and a fresh initialization can retry', async () => {
  const originalImage = globalThis.Image;
  let failLab = true;
  globalThis.Image = class {
    width = 256;
    height = 256;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(path: string) {
      if (failLab && path.endsWith('/lab.png')) this.onerror?.();
      else this.onload?.();
    }
  } as unknown as typeof Image;
  const canvas = { getContext: () => ({}) } as unknown as HTMLCanvasElement;
  try {
    const failed = new RenderSystem(canvas);
    await expect(failed.loadAllTilesets()).rejects.toThrow('Failed to load sprite: lab');
    expect(failed.hasSprite('lab')).toBe(false);
    failLab = false;
    const retry = new RenderSystem(canvas);
    await retry.loadAllTilesets();
    for (const name of ['grass', 'island', 'sewage', 'cave', 'lab', 'tutorial', 'titletileset']) {
      expect(retry.hasSprite(name)).toBe(true);
    }
  } finally {
    globalThis.Image = originalImage;
  }
});

test('required individual sprite failures identify the missing image', async () => {
  const originalImage = globalThis.Image;
  globalThis.Image = class {
    onerror: (() => void) | null = null;
    set src(_path: string) { this.onerror?.(); }
  } as unknown as typeof Image;
  try {
    const renderer = new RenderSystem({ getContext: () => ({}) } as unknown as HTMLCanvasElement);
    await expect(renderer.loadSingleImage('coin01', '/missing.png')).rejects.toThrow('Failed to load image: coin01');
    expect(renderer.hasSprite('coin01')).toBe(false);
  } finally {
    globalThis.Image = originalImage;
  }
});

test('failed effects preloading remains retryable instead of marking missing sprites loaded', async () => {
  let shouldFail = true;
  let loads = 0;
  const effects = new EffectsSystem();
  effects.setRenderSystem({
    loadSingleImage: async (): Promise<void> => {
      loads++;
      if (shouldFail) throw new Error('Effect unavailable');
    },
  } as unknown as RenderSystem);
  await expect(effects.preloadSprites()).rejects.toThrow('Effect unavailable');
  const failedLoads = loads;
  shouldFail = false;
  await effects.preloadSprites();
  expect(loads).toBeGreaterThan(failedLoads);
  const successfulLoads = loads;
  await effects.preloadSprites();
  expect(loads).toBe(successfulLoads);
});

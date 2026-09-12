import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { GameObject } from './GameObject';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { LauncherComponent } from './components/LauncherComponent';
import { TimeSystem } from '../engine/TimeSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { SortConstants } from '../engine/SortConstants';
import { RenderSystem } from '../engine/RenderSystem';
import { EffectsSystem } from '../engine/EffectsSystem';
import { ActionType, Team } from '../types';

afterEach(() => sSystemRegistry.reset());

test('flash uses preloaded original PNGs and reaches the canvas with valid source rectangles', async () => {
  const originalImage = globalThis.Image;
  globalThis.Image = class {
    width = 0;
    height = 0;
    private path = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    get src(): string { return this.path; }
    set src(path: string) {
      this.path = path;
      const png = readFileSync(join(import.meta.dir, '../../public', path));
      this.width = png.readUInt32BE(16);
      this.height = png.readUInt32BE(20);
      this.onload?.();
    }
  } as unknown as typeof Image;
  const drawn: string[] = [];
  const context = {
    save: (): void => {}, restore: (): void => {}, translate: (): void => {},
    drawImage: (image: HTMLImageElement, ...rectangle: number[]): void => {
      drawn.push(image.src);
      expect(image.width).toBe(64);
      expect(image.height).toBe(64);
      expect(rectangle).toEqual([0, 0, 64, 64, 100, 200, 64, 64]);
    },
  };
  try {
    const renderer = new RenderSystem({ getContext: () => context } as unknown as HTMLCanvasElement);
    const effects = new EffectsSystem();
    effects.setRenderSystem(renderer);
    await effects.preloadSprites();
    const manager = new GameObjectManager();
    const factory = new GameObjectFactory(manager);
    factory.setRenderSystem(renderer);
    const flash = factory.spawn(GameObjectType.FLASH, 100, 200)!;
    const sprite = flash.getComponent(SpriteComponent)!;
    for (let i = 0; i < 3; i++) {
      manager.update(i === 0 ? 0 : 1 / 24, i / 24);
      sprite.render(flash);
      renderer.swap(0, 0);
    }
    expect(drawn).toEqual([1, 2, 3].map(i => `/assets/sprites/effect_crush_back0${i}.png`));
  } finally {
    globalThis.Image = originalImage;
  }
});

test('flash draws three original 24 FPS frames, stays non-damaging and expires after 3/24 seconds', () => {
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  const flash = factory.spawn(GameObjectType.FLASH, 100, 200);
  expect(flash).not.toBeNull();
  if (!flash) throw new Error('Expected flash spawn');
  expect(flash.type).toBe('effect');
  expect(flash.subType).toBe('flash');
  expect(flash.team).toBe(Team.NONE);
  expect(flash.width).toBe(64);
  expect(flash.height).toBe(64);
  expect(flash.activationRadius).toBe(-1);
  expect(flash.getComponent(DynamicCollisionComponent)).toBeNull();
  const sprite = flash.getComponent(SpriteComponent)!;
  const animation = sprite.getCurrentAnimation()!;
  expect(animation.loop).toBe(false);
  expect(animation.frames).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    const frame = animation.frames[i];
    expect(frame.sprite).toBe(`effect_crush_back0${i + 1}.png`);
    expect(frame.width).toBe(64);
    expect(frame.height).toBe(64);
    expect(frame.duration).toBe(1 / 24);
    expect(frame.attackVolumes ?? null).toBeNull();
    expect(frame.vulnerabilityVolumes ?? null).toBeNull();
    manager.update(i === 0 ? 0 : 1 / 24, i / 24);
    expect(sprite.getCurrentDraw()?.sprite).toBe(frame.sprite);
    expect(sprite.getCurrentDraw()?.priority).toBe(SortConstants.EFFECT);
    expect(manager.getActiveObjects()).toContain(flash);
    expect(flash.getPosition()).toMatchObject({ x: 100, y: 200 });
  }
  manager.update(1 / 24 - 0.001, 3 / 24 - 0.001);
  expect(manager.getActiveObjects()).toContain(flash);
  manager.update(0.001 + 1e-9, 3 / 24 + 1e-9);
  manager.commitUpdates();
  expect(manager.getActiveObjects()).toHaveLength(0);
  const recycled = manager.createObject();
  expect(recycled).toBe(flash);
  expect(recycled.getComponents()).toHaveLength(0);
});

for (const facing of [-1, 1]) {
  test(`launcher places one flash at the original bottom-relative offsets facing ${facing}`, () => {
    const manager = new GameObjectManager();
    const factory = new GameObjectFactory(manager);
    const time = new TimeSystem();
    sSystemRegistry.register(factory, 'factory');
    sSystemRegistry.register(time, 'time');
    const parent = new GameObject();
    parent.setPosition(300, 200);
    parent.width = 64;
    parent.height = 128;
    parent.facingDirection.x = facing;
    const player = new GameObject();
    player.life = 3;
    player.setCurrentAction(ActionType.HIT_REACT);
    const launcher = new LauncherComponent({
      angle: Math.PI * 0.55, magnitude: 1000, launchDelay: 0,
      postLaunchDelay: 0, driveActions: false,
      launchEffect: GameObjectType.FLASH, launchEffectOffsetX: 70, launchEffectOffsetY: 50,
    });
    launcher.prepareToLaunch(player, parent);
    time.update(1 / 60);
    launcher.update(1 / 60, parent);
    manager.commitUpdates();
    const flashes = manager.getActiveObjects().filter(object => object.subType === 'flash');
    expect(flashes).toHaveLength(1);
    expect(flashes[0].getPosition()).toMatchObject({ x: 300 + 70 * facing, y: 214 });
    expect(player.getVelocity().x * facing).toBeGreaterThan(900);
    expect(player.getVelocity().y).toBeLessThan(-100);
    expect(player.getCurrentAction()).toBe(ActionType.HIT_REACT);
    launcher.update(1 / 60, parent);
    manager.commitUpdates();
    expect(manager.getActiveObjects().filter(object => object.subType === 'flash')).toHaveLength(1);
  });
}

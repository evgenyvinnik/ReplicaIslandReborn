import { afterEach, expect, spyOn, test } from 'bun:test';
import { GameLoop } from './GameLoop';
import { sSystemRegistry } from './SystemRegistry';
import { RenderSystem } from './RenderSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { MotionBlurComponent } from '../entities/components/MotionBlurComponent';
import { MultiSpriteAnimComponent } from '../entities/components/MultiSpriteAnimComponent';
import type { GameObject } from '../entities/GameObject';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { AABoxCollisionVolume } from './collision/AABoxCollisionVolume';

afterEach(() => sSystemRegistry.reset());

interface Scene {
  draws: Array<{ sprite: string; x: number; alpha: number }>;
  manager: GameObjectManager;
  object: GameObject;
  sprite: SpriteComponent;
  loop: GameLoop;
  collisions: () => number;
}

function scene(): Scene {
  sSystemRegistry.reset();
  const draws: Array<{ sprite: string; x: number; alpha: number }> = [];
  let collisionSubmissions = 0;
  const renderer = {
    hasSprite: () => true,
    drawSprite: (sprite: string, x: number, _y: number, _frame: number, _z: number, alpha: number) => {
      draws.push({ sprite, x, alpha });
    },
  } as unknown as RenderSystem;
  sSystemRegistry.register(renderer, 'render');

  const manager = new GameObjectManager();
  const object = manager.createObject();
  object.width = 32;
  object.height = 32;
  object.activationRadius = -1;
  const collision = new DynamicCollisionComponent();
  collision.setCollisionSystem({
    registerForCollisions: () => { collisionSubmissions++; },
  } as unknown as Parameters<DynamicCollisionComponent['setCollisionSystem']>[0]);
  object.addComponent(collision);
  const sprite = new SpriteComponent();
  sprite.setRenderSystem(renderer);
  sprite.addAnimation('walk', {
    loop: true,
    frames: ['walk01', 'walk02'].map((name) => ({
      x: 0, y: 0, width: 32, height: 32, duration: 0.1, sprite: name,
      vulnerabilityVolumes: [new AABoxCollisionVolume(0, 0, 32, 32)],
    })),
  });
  sprite.playAnimation('walk');
  object.addComponent(sprite);
  manager.add(object);
  manager.commitUpdates();

  const loop = new GameLoop();
  let time = 1;
  loop.setUpdateCallback((dt) => { time += dt; manager.update(dt, time); });
  loop.setRenderCallback(() => { manager.render(); });
  return { draws, manager, object, sprite, loop, collisions: (): number => collisionSubmissions };
}

test('separate-image projectiles redraw without advancing their animation', () => {
  const { draws, manager, loop } = scene();
  const shot = manager.createObject();
  shot.activationRadius = -1;
  const animation = new MultiSpriteAnimComponent();
  animation.setRenderSystem(sSystemRegistry.renderSystem as RenderSystem);
  animation.setSpriteSequence(['energy_ball01', 'energy_ball02'], 0.1);
  shot.addComponent(animation);
  manager.add(shot);
  manager.commitUpdates();

  loop.step(8, false);
  expect(draws).toEqual([]);
  expect(animation.getCurrentSpriteName()).toBe('energy_ball02');
  for (let frame = 0; frame < 3; frame++) {
    draws.length = 0;
    loop.step(0);
    expect(draws.filter((draw) => draw.sprite === 'energy_ball02')).toHaveLength(1);
  }
});

test('display frames redraw the frozen world without advancing animation or collision', () => {
  const { draws, loop, sprite, collisions } = scene();
  loop.step(8);
  expect(draws).toHaveLength(1);
  const visibleFrame = { ...draws[0] };
  const animationTime = sprite.getCurrentAnimationTime();
  const submitted = collisions();

  for (let frame = 0; frame < 120; frame++) {
    draws.length = 0;
    // Dialogue, pause, and 120Hz displays all have render-only frames.
    loop.step(0);
    expect(draws).toEqual([visibleFrame]);
  }
  expect(sprite.getCurrentAnimationTime()).toBe(animationTime);
  expect(collisions()).toBe(submitted);
});

test('several physics steps draw only the final state and preserve a paused motion trail', () => {
  const { draws, loop, object, sprite } = scene();
  const blur = new MotionBlurComponent();
  blur.setTarget(sprite);
  object.addComponent(blur);
  loop.step(40, false);
  expect(draws).toEqual([]);
  loop.step(0);
  expect(draws).toHaveLength(5); // one body and four trail samples
  const frozen = draws.map((draw) => ({ ...draw }));
  draws.length = 0;
  loop.step(0);
  expect(draws).toEqual(frozen);

  object.setVisible(false);
  draws.length = 0;
  loop.step(0);
  expect(draws).toEqual([]);
});

test('30/60/120/144Hz displays advance UI by elapsed time and keep rendering while paused', () => {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const now = spyOn(performance, 'now').mockReturnValue(0);
  let pending: Parameters<typeof requestAnimationFrame>[0] | undefined;
  globalThis.requestAnimationFrame = (callback): number => { pending = callback; return 1; };
  globalThis.cancelAnimationFrame = (): void => { pending = undefined; };

  try {
    for (const hz of [30, 60, 120, 144]) {
      const loop = new GameLoop();
      let physicsTime = 0;
      let uiTime = 0;
      let renders = 0;
      loop.setUpdateCallback((dt) => { physicsTime += dt; });
      loop.setRenderCallback((_interpolation, dt) => { uiTime += dt; renders++; });
      loop.start();
      for (let frame = 1; frame <= hz; frame++) pending?.(frame * 1000 / hz);
      expect(uiTime).toBeCloseTo(1, 8);
      expect(physicsTime).toBeGreaterThanOrEqual(59 / 60);
      expect(physicsTime).toBeLessThanOrEqual(1.001);
      expect(renders).toBe(hz);

      loop.pause();
      const frozenTime = physicsTime;
      for (let frame = hz + 1; frame <= 2 * hz; frame++) pending?.(frame * 1000 / hz);
      expect(physicsTime).toBe(frozenTime);
      expect(uiTime).toBeCloseTo(2, 8);
      expect(renders).toBe(2 * hz);
      loop.stop();
    }
  } finally {
    now.mockRestore();
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});

test('death fades cover the current screen immediately, independent of camera position', () => {
  const fills: unknown[][] = [];
  const transforms: number[][] = [];
  const context = {
    save: (): void => {},
    restore: (): void => {},
    translate: (): void => {},
    setTransform: (...args: number[]): void => { transforms.push(args); },
    globalAlpha: 1,
    fillStyle: '',
    fillRect: (...args: number[]): void => {
      fills.push([...args, context.fillStyle, context.globalAlpha]);
    },
  };
  const renderer = new RenderSystem({
    width: 480, height: 320, getContext: () => context,
  } as unknown as HTMLCanvasElement);
  renderer.swap(5000, 3000);
  renderer.drawScreenOverlay('#000000', 0.5);
  expect(fills).toEqual([[0, 0, 480, 320, '#000000', 0.5]]);
  expect(transforms).toEqual([[1, 0, 0, 1, 0, 0]]);
  fills.length = 0;
  renderer.swap(5000, 3000);
  expect(fills).toEqual([]); // No stale fade left in next frame's world queue.
});

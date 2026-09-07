import { afterEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { InputSystem } from '../engine/InputSystem';
import type { RenderSystem } from '../engine/RenderSystem';
import { GameObjectFactory } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { GameObject } from './GameObject';
import { SolidSurfaceComponent, setSolidSurfaceSystemRegistry } from './components/SolidSurfaceComponent';

afterEach(() => sSystemRegistry.reset());

test('a rendered possession orb moves left/up on command without down-right drift', () => {
  for (const [x, y] of [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1]]) {
    sSystemRegistry.reset();
    const manager = new GameObjectManager();
    const input = new InputSystem();
    sSystemRegistry.register(manager, 'gameObject');
    sSystemRegistry.register(input, 'input');
    const drawn: string[] = [];
    const renderer = {
      hasSprite: () => true,
      drawSprite: (name: string): void => { drawn.push(name); },
    } as unknown as RenderSystem;
    const factory = new GameObjectFactory(manager);
    factory.setSystemRegistry(sSystemRegistry);
    factory.setRenderSystem(renderer); // Production's rendering-enabled factory.
    const ghost = factory.spawnGhost(600, 600, 2)!;
    manager.commitUpdates();
    input.setVirtualAxis('horizontal', x);
    input.setVirtualAxis('vertical', y);
    for (let i = 1; i <= 60; i++) {
      ghost.update(1 / 60, i / 60);
      ghost.render();
    }
    const dx = ghost.getPosition().x - 600;
    const dy = ghost.getPosition().y - 600;
    if (x === 0) expect(dx).toBe(0);
    else expect(dx * x).toBeGreaterThan(100);
    if (y === 0) expect(dy).toBe(0);
    else expect(dy * y).toBeGreaterThan(100);
    expect(new Set(drawn)).toEqual(new Set([
      'effect_energyball01', 'effect_energyball02', 'effect_energyball03', 'effect_energyball04',
    ]));
  }
});

test('the orb bounces off tiles in every direction, including at its original top speed', async () => {
  const collision = new CollisionSystem();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(await file(
      new URL('../../public/assets/collision.json', import.meta.url)
    ).arrayBuffer())) as unknown as typeof fetch;
    expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  // A closed room with one-tile walls and an empty interior.
  collision.setTileCollision(Array.from({ length: 20 * 20 }, (_, i) =>
    i % 20 === 0 || i % 20 === 19 || i < 20 || i >= 380 ? 1 : -1), 20, 20, 32, 32);
  for (const [x, y] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
    const manager = new GameObjectManager();
    const input = new InputSystem();
    sSystemRegistry.register(input, 'input');
    const factory = new GameObjectFactory(manager);
    factory.setSystemRegistry(sSystemRegistry);
    factory.setCollisionSystem(collision);
    const ghost = factory.spawnGhost(256, 256, 2)!;
    ghost.getVelocity().set(x * 2000, y * 2000);
    input.setVirtualAxis('horizontal', x);
    input.setVirtualAxis('vertical', y);
    let bounced = false;
    for (let i = 1; i <= 30; i++) {
      ghost.update(1 / 60, i / 60);
      const position = ghost.getPosition();
      expect(position.x).toBeGreaterThanOrEqual(32);
      expect(position.y).toBeGreaterThanOrEqual(32);
      expect(position.x + ghost.width).toBeLessThanOrEqual(608);
      expect(position.y + ghost.height).toBeLessThanOrEqual(608);
      if (ghost.getVelocity().x * x + ghost.getVelocity().y * y < 0) bounced = true;
    }
    expect(bounced).toBe(true);
  }
});

test('a closed object gate also blocks and reflects the possession orb', () => {
  const manager = new GameObjectManager();
  const collision = new CollisionSystem();
  const input = new InputSystem();
  sSystemRegistry.register(input, 'input');
  sSystemRegistry.register(collision, 'collision');
  setSolidSurfaceSystemRegistry(sSystemRegistry);
  const factory = new GameObjectFactory(manager);
  factory.setSystemRegistry(sSystemRegistry);
  factory.setCollisionSystem(collision);
  const door = new GameObject();
  door.setPosition(320, 0);
  const surface = new SolidSurfaceComponent();
  surface.createRectangle(32, 1000);
  door.addComponent(surface);
  door.update(0, 0);
  collision.updateTemporarySurfaces();
  const ghost = factory.spawnGhost(240, 200, 2)!;
  ghost.getVelocity().set(2000, 0);
  input.setVirtualAxis('horizontal', 1);
  ghost.update(1 / 60, 1 / 60);
  expect(ghost.getPosition().x + ghost.width).toBeLessThanOrEqual(320);
  expect(ghost.getVelocity().x).toBeCloseTo(-1200);
});

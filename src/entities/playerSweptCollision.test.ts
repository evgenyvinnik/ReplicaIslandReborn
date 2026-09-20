import { beforeEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { InputSystem } from '../engine/InputSystem';
import type { SoundSystem } from '../engine/SoundSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';
import { GameObject } from './GameObject';
import { PlayerComponent } from './components/PlayerComponent';
import { Vector2 } from '../utils/Vector2';

let collision: CollisionSystem;
beforeEach(async () => {
  collision = new CollisionSystem();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0]): Promise<Response> => new Response(await file(
      new URL('../../public/assets/collision.json', import.meta.url)
    ).arrayBuffer())) as typeof fetch;
    expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function scene(x: number, y: number, vx: number, vy: number): {
  player: GameObject; input: InputSystem; frame: () => void;
} {
  const player = new GameObject();
  player.width = 32;
  player.height = 48;
  player.setPosition(x, y);
  player.getVelocity().set(vx, vy);
  const input = new InputSystem();
  const control = new PlayerComponent();
  control.setSystems(input, collision, { playSfx: () => undefined } as unknown as SoundSystem,
    { getLevelSize: () => ({ width: 640, height: 640 }) } as unknown as LevelSystem);
  player.addComponent(control);
  let time = 1;
  return { player, input, frame: (): void => player.update(1 / 60, time += 1 / 60) };
}

function slab(axis: 'x' | 'y'): void {
  collision.setTileCollision(Array.from({ length: 400 }, (_, i) =>
    (axis === 'y' ? Math.floor(i / 20) : i % 20) === 10 ? 1 : -1), 20, 20, 32, 32);
}

test('cannon-speed ascent stops below a ceiling without a sideways snap', () => {
  slab('y');
  // The slab occupies y=320..352; start OUTSIDE it, nine pixels below.
  const { player, frame } = scene(80, 361, 0, -2000);
  frame();
  expect(player.getPosition().y).toBeCloseTo(352, 5);
  expect(player.getPosition().x).toBe(80);
  expect(player.getVelocity().y).toBe(0);
  expect(player.touchingCeiling()).toBe(true);
  for (let i = 0; i < 6; i++) frame();
  expect(player.getPosition().y).toBeGreaterThanOrEqual(352);
  expect(player.getPosition().x).toBe(80);
});

test('fast descent lands on the first crossed surface and remains supported', () => {
  slab('y');
  const { player, frame } = scene(80, 263, 0, 4000);
  for (let i = 0; i < 8; i++) {
    frame();
    expect(player.getPosition().y).toBeCloseTo(272, 5);
    expect(player.getVelocity().y).toBe(0);
    expect(player.touchingGround()).toBe(true);
  }
});

for (const direction of [-1, 1]) {
  test(`fast horizontal launch stops at the wall from direction ${direction}`, () => {
    slab('x');
    const { player, frame } = scene(direction > 0 ? 279 : 361, 80, direction * 4000, 0);
    frame();
    expect(player.getPosition().x).toBeCloseTo(direction > 0 ? 288 : 352, 5);
    expect(player.getVelocity().x).toBe(0);
    expect(direction > 0 ? player.touchingRightWall() : player.touchingLeftWall()).toBe(true);
  });
}

test('walking uphill follows the authored ramp instead of stopping at a tile wall', () => {
  collision.setTileCollision(Array.from({ length: 400 }, (_, i) => {
    const row = Math.floor(i / 20), col = i % 20;
    return row >= 10 ? 1 : row === 9 && col === 3 ? 36 : -1;
  }), 20, 20, 32, 32);
  const { player, frame, input } = scene(80, 272, 0, 0);
  frame();
  input.setVirtualAxis('horizontal', 1);
  let previousX = 80;
  for (let i = 0; i < 20 && player.getPosition().x < 108; i++) {
    frame();
    const { x, y } = player.getPosition();
    expect(x).toBeGreaterThan(previousX);
    expect(y + 48).toBeCloseTo(416 - (x + 16), 5);
    expect(player.touchingGround()).toBe(true);
    previousX = x;
  }
  expect(previousX).toBeGreaterThan(100);
});

test('diagonal rays in all quadrants visit crossed side tiles', () => {
  // (31,1)->(63,63) enters tile (1,0) at x=32, before tile (1,1).
  for (const mirrorX of [false, true]) for (const mirrorY of [false, true]) {
    const tiles = Array(4).fill(-1);
    tiles[(mirrorY ? 2 : 0) + (mirrorX ? 0 : 1)] = 1;
    collision.setTileCollision(tiles, 2, 2, 32, 32);
    const point = new Vector2(), normal = new Vector2();
    expect(collision.castRay(new Vector2(mirrorX ? 33 : 31, mirrorY ? 63 : 1),
      new Vector2(mirrorX ? 1 : 63, mirrorY ? 1 : 63),
      new Vector2(mirrorX ? -1 : 1, 0), point, normal)).toBe(true);
    expect(point.x).toBeCloseTo(32, 5);
    expect(normal.x).toBe(mirrorX ? 1 : -1);
  }
});

test('a fast diagonal launch resolves both surfaces of a corner', () => {
  collision.setTileCollision(Array.from({ length: 400 }, (_, i) =>
    Math.floor(i / 20) === 10 || i % 20 === 10 ? 1 : -1), 20, 20, 32, 32);
  const { player, frame } = scene(279, 263, 4000, 4000);
  frame();
  expect(player.getPosition().x).toBeCloseTo(288, 5);
  expect(player.getPosition().y).toBeCloseTo(272, 5);
  expect(player.getVelocity().lengthSquared()).toBe(0);
  expect(player.touchingGround()).toBe(true);
  expect(player.touchingRightWall()).toBe(true);
});

test('teleporting across a wall does not sweep from the old location', () => {
  slab('x');
  const { player, frame } = scene(80, 80, 0, 0);
  frame();
  player.setPosition(400, 80);
  frame();
  expect(player.getPosition().x).toBe(400);
});

test('the lower world edge stays open for pits', () => {
  collision.setTileCollision(Array(400).fill(-1), 20, 20, 32, 32);
  const { player, frame } = scene(80, 590, 0, 1000);
  frame();
  expect(player.getPosition().y + player.height).toBeGreaterThan(640);
  expect(player.touchingGround()).toBe(false);
});

for (const direction of [-1, 1]) {
  test(`player crosses the ramp-to-flat seam uphill and returns downhill ${direction}`, () => {
    // Mirror a continuous 32px rise, using the original opposite slope tiles.
    collision.setTileCollision(Array.from({ length: 400 }, (_, i) => {
      const row = Math.floor(i / 20), col = i % 20;
      if (row >= 10) return 1;
      if (row !== 9) return -1;
      if (col === 10) return direction > 0 ? 36 : 37;
      return (direction > 0 ? col > 10 : col < 10) ? 1 : -1;
    }), 20, 20, 32, 32);
    const startX = direction > 0 ? 250 : 390;
    const { player, frame, input } = scene(startX, 272, 0, 0);
    frame();
    input.setVirtualAxis('horizontal', direction);
    for (let i = 0; i < 45; i++) frame();
    expect((player.getPosition().x - startX) * direction).toBeGreaterThan(120);
    expect(player.getPosition().y).toBeCloseTo(240, 5);
    input.setVirtualAxis('horizontal', -direction);
    for (let i = 0; i < 100; i++) frame();
    expect((player.getPosition().x - startX) * direction).toBeLessThan(0);
    expect(player.getPosition().y).toBeCloseTo(272, 5);
  });

  test(`player can walk and fly away after settling in a floor/wall corner ${direction}`, () => {
    collision.setTileCollision(Array.from({ length: 400 }, (_, i) => {
      const row = Math.floor(i / 20), col = i % 20;
      return row >= 10 || (direction > 0 ? col >= 10 : col <= 9) ? 1 : -1;
    }), 20, 20, 32, 32);
    const wallX = direction > 0 ? 288 : 320;
    const { player, frame, input } = scene(wallX - direction * 9, 263, direction * 4000, 4000);
    frame();
    expect(player.getPosition().x).toBeCloseTo(wallX, 5);
    expect(player.getPosition().y).toBeCloseTo(272, 5);
    input.setVirtualAxis('horizontal', direction);
    for (let i = 0; i < 60; i++) frame();
    expect(player.getPosition().x).toBeCloseTo(wallX, 5);
    input.setVirtualAxis('horizontal', -direction);
    for (let i = 0; i < 12; i++) frame();
    expect((player.getPosition().x - wallX) * -direction).toBeGreaterThan(10);
    input.setVirtualButton('jump', true);
    for (let i = 0; i < 12; i++) frame();
    expect(player.getPosition().y).toBeLessThan(250);
  });
}

import { beforeEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { InputSystem } from '../engine/InputSystem';
import type { SoundSystem } from '../engine/SoundSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';
import { GameObject } from './GameObject';
import { PlayerComponent } from './components/PlayerComponent';
import { Vector2 } from '../utils/Vector2';
import { levelTree, linearLevelTree } from '../data/levelTree';

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

function scene(x: number, y: number, vx: number, vy: number,
  worldSize: { width: number; height: number } = { width: 640, height: 640 }): {
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
    { getLevelSize: () => worldSize } as unknown as LevelSystem);
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

for (const side of [-1, 1]) for (const half of ['upper', 'lower'] as const) {
  test(`a fast side impact cannot pass through the ${half} half of a one-tile wall from ${side}`, () => {
    const wallRow = half === 'lower' ? 10 : 9;
    collision.setTileCollision(Array.from({ length: 400 }, (_, i) =>
      i === wallRow * 20 + 10 ? 1 : -1), 20, 20, 32, 32);
    // The body's centre misses the tile, but its upper/lower edge overlaps it.
    const y = half === 'lower' ? 286 : 306;
    const { player, frame } = scene(side > 0 ? 279 : 361, y, side * 4000, 0);
    frame();
    expect(player.getPosition().x).toBeCloseTo(side > 0 ? 288 : 352, 2);
    expect(side > 0 ? player.touchingRightWall() : player.touchingLeftWall()).toBe(true);
    player.getVelocity().x = -side * 200;
    frame();
    expect((player.getPosition().x - (side > 0 ? 288 : 352)) * -side).toBeGreaterThan(0);
  });
}

test('the upper edge still stops a grounded player at a hanging wall', () => {
  collision.setTileCollision(Array.from({ length: 400 }, (_, i) => {
    const row = Math.floor(i / 20);
    return row === 10 || i === 8 * 20 + 10 ? 1 : -1;
  }), 20, 20, 32, 32);
  const { player, frame } = scene(279, 272, 4000, 0);
  frame();
  expect(player.getPosition().x).toBeCloseTo(288, 2);
  expect(player.touchingRightWall()).toBe(true);
});

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

test('Andou can climb the actual multi-tile lab ramp after the wall-edge fix', async () => {
  const data = await file(new URL('../../public/assets/levels/level_0_3_lab.json', import.meta.url)).json() as {
    layers: Array<{ type: string; world: { tiles: number[][] } }>;
  };
  const grid = data.layers.find((layer) => layer.type === 'collision')!.world.tiles;
  const worldSize = { width: grid[0].length * 32, height: grid.length * 32 };
  collision.setTileCollision(grid.flat(), grid[0].length, grid.length, 32, 32);
  // Start on the lower floor leading into the level's rising ramp at (7,17).
  const { player, input, frame } = scene(5 * 32, 18 * 32 - 48, 0, 0, worldSize);
  frame();
  input.setVirtualAxis('horizontal', 1);
  let highestPoint = player.getPosition().y;
  for (let i = 0; i < 90; i++) {
    frame();
    highestPoint = Math.min(highestPoint, player.getPosition().y);
  }
  expect(player.getPosition().x).toBeGreaterThan(9 * 32);
  expect(highestPoint).toBeLessThan(18 * 32 - 48 - 128);
});

test('Andou can climb the opposite-facing island ramp after the wall-edge fix', async () => {
  const data = await file(new URL('../../public/assets/levels/level_1_1_island.json', import.meta.url)).json() as {
    layers: Array<{ type: string; world: { tiles: number[][] } }>;
  };
  const grid = data.layers.find((layer) => layer.type === 'collision')!.world.tiles;
  const worldSize = { width: grid[0].length * 32, height: grid.length * 32 };
  collision.setTileCollision(grid.flat(), grid[0].length, grid.length, 32, 32);
  // Reverse-facing slope at (4,9), with the lower floor on its right.
  const { player, input, frame } = scene(8 * 32, 10 * 32 - 48, 0, 0, worldSize);
  frame();
  input.setVirtualAxis('horizontal', -1);
  let highestPoint = player.getPosition().y;
  for (let i = 0; i < 65; i++) {
    frame();
    highestPoint = Math.min(highestPoint, player.getPosition().y);
  }
  expect(player.getPosition().x).toBeLessThan(3 * 32);
  expect(highestPoint).toBeLessThan(10 * 32 - 48 - 32);
});

test('clear approaches to authored 45-degree ramps do not wedge Andou', async () => {
  const resources = new Set([...levelTree, ...linearLevelTree]
    .flatMap((group) => group.levels.map((level) => level.resource)));
  const failures: string[] = [];
  let checked = 0;
  const checkedByDirection = { left: 0, right: 0 };

  for (const resource of resources) {
    const data = await file(new URL(`../../public/assets/levels/${resource}.json`, import.meta.url)).json() as {
      layers: Array<{ type: string; world: { tiles: number[][] } }>;
    };
    const grid = data.layers.find((layer) => layer.type === 'collision')?.world.tiles;
    if (!grid) continue;
    const width = grid[0].length, height = grid.length;
    const worldSize = { width: width * 32, height: height * 32 };
    collision.setTileCollision(grid.flat(), width, height, 32, 32);

    for (let y = 2; y < height - 3; y++) for (let x = 2; x < width - 3; x++) {
      const tile = grid[y][x];
      if (tile !== 36 && tile !== 37) continue;
      const direction = tile === 36 ? 1 : -1;
      if (grid[y][x - direction] >= 0 ||
          ![1, 17].includes(grid[y + 1][x - direction]) ||
          ![1, 17].includes(grid[y][x + direction]) ||
          grid[y - 1][x - direction] >= 0 || grid[y - 1][x] >= 0 ||
          grid[y - 1][x + direction] >= 0 ||
          grid[y - 2][x - direction] >= 0 || grid[y - 2][x] >= 0 ||
          grid[y - 2][x + direction] >= 0) continue;

      const startX = (x - direction) * 32;
      const startY = (y + 1) * 32 - 48;
      const { player, input, frame } = scene(startX, startY, 0, 0, worldSize);
      frame();
      input.setVirtualAxis('horizontal', direction);
      let highestPoint = player.getPosition().y;
      let progress = 0;
      for (let i = 0; i < 45; i++) {
        frame();
        highestPoint = Math.min(highestPoint, player.getPosition().y);
        progress = Math.max(progress, (player.getPosition().x - startX) * direction);
      }
      checked++;
      checkedByDirection[direction < 0 ? 'left' : 'right']++;
      if (progress < 36 || highestPoint > startY - 8) {
        failures.push(`${resource} (${x},${y}) ${tile}: moved ${progress.toFixed(1)}, rose ${(startY - highestPoint).toFixed(1)}`);
      }
    }
  }

  expect(checked).toBeGreaterThan(15);
  expect(checkedByDirection.left).toBeGreaterThan(0);
  expect(checkedByDirection.right).toBeGreaterThan(0);
  expect(failures).toEqual([]);
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

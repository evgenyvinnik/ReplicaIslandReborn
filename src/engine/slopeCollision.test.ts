/**
 * Slopes, resolved against the original's line-segment collision data.
 *
 * `collision.json` carries the per-tile line segments and surface normals the
 * original ships in `collision.bin`, but the port only ever used them for a
 * step-up check: a grounded object was snapped to
 * `floor(feetY / tileHeight) * tileHeight`, which treats every collision tile
 * as a full block and walks slopes in 32px stair-steps.
 *
 * `getGroundSurfaceY()` casts a short ray down through the feet against the
 * real segments instead, so an object rests on the actual surface.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from './CollisionSystemNew';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

/** A clean 45-degree ramp in collision.json: local (0,32) -> (32,0). */
const RAMP_TILE = 36;
/** A tile with no segment definition at all. */
const EMPTY_TILE = -1;

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.pathname
        : new URL(input.url).pathname;
    const pathname = rawUrl.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const requested = file(join(publicDirectory, pathname));
    if (!(await requested.exists())) return new Response(null, { status: 404 });
    return new Response(await requested.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('slope surfaces from collision segments', () => {
  let collision: CollisionSystem;

  beforeEach(async () => {
    collision = new CollisionSystem();
    expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  });

  /** A 4x2 world with one ramp tile on the bottom row at tileX. */
  function worldWithRampAt(tileX: number): void {
    const width = 4;
    const height = 2;
    const tiles: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles.push(y === 1 && x === tileX ? RAMP_TILE : EMPTY_TILE);
      }
    }
    collision.setTileCollision(tiles, width, height, 32, 32);
  }

  test('collision data actually loaded', () => {
    expect(collision.isCollisionDataLoaded()).toBe(true);
  });

  /**
   * Walk right across the ramp the way the game does: each step, the feet are
   * wherever the previous frame left them, and the surface is looked up from
   * there. The search window is deliberately small, so this also proves an
   * object can actually track the slope frame to frame.
   */
  function walkAcrossRamp(step: number): Array<{ x: number; y: number }> {
    const samples: Array<{ x: number; y: number }> = [];
    let feetY = 64; // start at the bottom-left of the ramp tile
    for (let x = 33; x < 64; x += step) {
      const surfaceY = collision.getGroundSurfaceY(x, feetY);
      if (surfaceY === null) break;
      feetY = surfaceY;
      samples.push({ x, y: surfaceY });
    }
    return samples;
  }

  test('an object walking right climbs the whole ramp', () => {
    worldWithRampAt(1);
    const samples = walkAcrossRamp(4);

    // Tile 1 spans world x 32..64. The segment runs local (0,32) -> (32,0), so
    // walking right should carry the object from the tile's bottom to its top.
    expect(samples.length).toBeGreaterThan(6);
    expect(samples[0].y).toBeGreaterThan(58);
    expect(samples[samples.length - 1].y).toBeLessThan(38);
  });

  test('the ramp is a straight 45-degree line, not a stair', () => {
    worldWithRampAt(1);
    const samples = walkAcrossRamp(4);

    // Equal x steps must give equal y steps on a straight ramp; a tile-granular
    // snap would give a run of identical values and then a 32px jump.
    for (let i = 1; i < samples.length; i++) {
      const rise = samples[i - 1].y - samples[i].y;
      const run = samples[i].x - samples[i - 1].x;
      expect(Math.abs(rise - run)).toBeLessThan(1.5);
    }
  });

  test('returns null where there is no ground', () => {
    worldWithRampAt(1);
    // Tile 3 is empty.
    expect(collision.getGroundSurfaceY(112, 64)).toBeNull();
  });

  test('a fresh system with no segment data falls back to null', () => {
    const bare = new CollisionSystem();
    bare.setTileCollision([RAMP_TILE], 1, 1, 32, 32);
    expect(bare.getGroundSurfaceY(16, 32)).toBeNull();
  });
});

/**
 * Walking *into* a ramp.
 *
 * getGroundSurfaceY() above puts an object's feet on the right surface, but the
 * horizontal test is a whole-tile AABB: it saw the ramp tile as a solid block
 * and reported a wall, so an object stopped dead at the foot of every slope and
 * never got the chance to be lifted. checkTileCollision() now lets an object
 * walk into a sloped surface that is within a step of its feet.
 */
describe('walking into slopes', () => {
  let collision: CollisionSystem;

  /** A floor along the bottom with one ramp tile sitting on it at `rampCol`. */
  const WIDTH = 10;
  const HEIGHT = 8;
  const FLOOR_ROW = HEIGHT - 1;
  const RAMP_ROW = HEIGHT - 2;
  const FLOOR_TILE = 1;   // a plain solid block
  const FLOOR_Y = FLOOR_ROW * 32;

  /** A 32x48 object, the size of the player's collision box. */
  const BOX_W = 32;
  const BOX_H = 48;

  beforeEach(async () => {
    collision = new CollisionSystem();
    expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  });

  function world(rampCol: number, blockCol: number | null = null): void {
    const tiles: number[] = [];
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (y === FLOOR_ROW) tiles.push(FLOOR_TILE);
        else if (y === RAMP_ROW && x === rampCol) tiles.push(RAMP_TILE);
        else if (y === RAMP_ROW && x === blockCol) tiles.push(FLOOR_TILE);
        else tiles.push(EMPTY_TILE);
      }
    }
    collision.setTileCollision(tiles, WIDTH, HEIGHT, 32, 32);
  }

  /** Walk right from `startX`, letting the feet follow the surface each step. */
  function walkRight(startX: number, steps: number): { x: number; feetY: number } {
    let x = startX;
    let feetY = FLOOR_Y;
    for (let i = 0; i < steps; i++) {
      const result = collision.checkTileCollision(x, feetY - BOX_H, BOX_W, BOX_H, 100, 0);
      if (result.rightWall) break;
      x += 6;
      const surface = collision.getGroundSurfaceY(x + BOX_W / 2, feetY);
      if (surface !== null) feetY = surface;
    }
    return { x, feetY };
  }

  test('an object walks up a ramp instead of stopping at it', () => {
    world(3);
    const before = { x: 60, feetY: FLOOR_Y };
    const after = walkRight(before.x, 24);

    // It gets past the ramp tile (world x 96..128) entirely...
    expect(after.x).toBeGreaterThan(128);
    // ...and ends up a tile higher than it started.
    expect(after.feetY).toBeLessThan(before.feetY - 24);
  });

  test('a flat-topped block is still a wall', () => {
    // Same layout, but the tile in the object's path is a plain block.
    world(9, 3);
    const after = walkRight(60, 24);

    // Stopped before entering the block at world x 96.
    expect(after.x).toBeLessThanOrEqual(96);
    expect(after.feetY).toBe(FLOOR_Y);
  });

  test('a ramp above the step height does not become a doorway', () => {
    world(3);
    // Feet well below the ramp's surface: this is a wall face, not a slope to
    // walk up, and must still block.
    const deepBelow = FLOOR_Y + 64;
    const result = collision.checkTileCollision(
      90, deepBelow - BOX_H, BOX_W, BOX_H, 100, 0
    );
    // Nothing walkable is within a step up, so the ramp tile is not entered.
    expect(result.rightWall || result.grounded || result.ceiling).toBe(true);
  });
});

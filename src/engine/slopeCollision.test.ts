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

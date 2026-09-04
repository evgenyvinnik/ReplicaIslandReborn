/**
 * Which way does a floor's normal point?
 *
 * The original's world is Y-up, so a floor's normal is (0, +1) and every
 * component testing `normal.y > 0` means "I landed on something". This port's
 * collision system reports normals in canvas space, where a flat tile top is
 * (0, -1). Transcribe the test without flipping it and floor contacts get
 * stamped as ceiling contacts, which inverts `touchingGround()` for anything
 * that reads the normal rather than the explicit `grounded` flag.
 *
 * That is exactly what `SimpleCollisionComponent` and
 * `BackgroundCollisionComponent` did. It stayed hidden because the components
 * that actually carry the game read `checkTileCollision()`'s booleans instead:
 * `MovementComponent` for every enemy and NPC, and `PlayerComponent`'s own
 * inline resolution for Andou.
 *
 * This pins the convention at its source, so a change to the collision system
 * that flips it has to break here rather than quietly in six call sites.
 */

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from './CollisionSystemNew';

const TILE = 32;
const pub = join(import.meta.dir, '../../public');
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = (async (i: Parameters<typeof fetch>[0]): Promise<Response> => {
    const raw = typeof i === 'string' ? i : i instanceof URL ? i.pathname : new URL(i.url).pathname;
    const p = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const f = file(join(pub, p));
    if (!(await f.exists())) return new Response(null, { status: 404 });
    return new Response(await f.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });

/**
 * A tile index that collision.json defines as a full solid block.
 * isTileSolid() only counts indices present in those definitions, so a made-up
 * index is treated as empty space.
 */
const SOLID_TILE = 0;

/** A world that is solid from `solidFromRow` downwards. */
async function groundAt(solidFromRow: number, cols = 10, rows = 10): Promise<CollisionSystem> {
  const collision = new CollisionSystem();
  expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  const tiles: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      tiles.push(y >= solidFromRow ? SOLID_TILE : -1);
    }
  }
  collision.setTileCollision(tiles, cols, rows, TILE, TILE);
  return collision;
}

test('a floor reports grounded, and its normal points up (negative Y)', async () => {
  const collision = await groundAt(5);
  // A box whose feet are just inside the first solid row, moving down.
  const result = collision.checkTileCollision(
    3 * TILE, 5 * TILE - 30, 32, 32, 0, 100
  );
  expect(result.grounded).toBe(true);
  expect(result.normal.y).toBeLessThan(0);
});

test('a ceiling reports ceiling, and its normal points down (positive Y)', async () => {
  // Solid from row 0 only; a box just under it moving up.
  const collision = await groundAt(0, 10, 1);
  const result = collision.checkTileCollision(
    3 * TILE, 1 * TILE - 2, 32, 32, 0, -100
  );
  expect(result.ceiling).toBe(true);
  expect(result.normal.y).toBeGreaterThan(0);
});

test('the sign convention is the opposite of the Java original', async () => {
  // Stated as an executable fact so the next transcription has something to
  // check against: in CollisionSystem.java a floor normal is +1.
  const originalFloorNormalY = 1;
  const collision = await groundAt(5);
  const floor = collision.checkTileCollision(3 * TILE, 5 * TILE - 30, 32, 32, 0, 100);
  expect(Math.sign(floor.normal.y)).toBe(-originalFloorNormalY);
});

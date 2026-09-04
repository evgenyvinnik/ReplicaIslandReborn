/**
 * Can the player actually get to the thing that ends the level?
 *
 * `levelCompletable.test.ts` checks the level *data* offers a way to finish -
 * three rubies, a boss, or an END_LEVEL hot spot. It does not check that the
 * player can physically reach it. A collision layer that loads transposed,
 * a tile wrongly treated as solid, or a spawn placed on the wrong side of a
 * wall all leave a level that loads, renders and plays right up until it turns
 * out to be impossible.
 *
 * This floods the level's own collision grid - through the real
 * CollisionSystem, so it exercises the loading path rather than the JSON -
 * from the player's spawn, and requires the win condition to be inside the
 * reachable region.
 *
 * The movement model is deliberately generous: any non-solid neighbour in any
 * direction, because the jetpack lets Andou climb freely. A failure therefore
 * means genuinely walled off, not merely "a hard jump".
 */

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem, HotSpotType } from '../engine/HotSpotSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import type { GameObject } from '../entities/GameObject';

const pub = join(import.meta.dir, '../../public');
const originalFetch = globalThis.fetch;
const TILE = 32;

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

/** Tile indices whose collision definition includes a diagonal segment. */
let slopeTileIndices: Set<number> | null = null;

async function loadSlopeIndices(): Promise<Set<number>> {
  if (slopeTileIndices) return slopeTileIndices;
  const raw = await file(join(pub, 'assets/collision.json')).json() as {
    tiles: Record<string, Array<{ normalX: number; normalY: number }>
      | { segments: Array<{ normalX: number; normalY: number }> }>;
  };
  const set = new Set<number>();
  for (const [key, definition] of Object.entries(raw.tiles)) {
    const segments = Array.isArray(definition) ? definition : definition.segments;
    if (segments.some((s) => s.normalX !== 0 && s.normalY !== 0)) set.add(Number(key));
  }
  slopeTileIndices = set;
  return set;
}

/** The level's raw collision layer, so slope tiles can be told apart. */
async function collisionGrid(resource: string): Promise<number[][] | null> {
  const f = file(join(pub, `assets/levels/${resource}.json`));
  if (!(await f.exists())) return null;
  const level = await f.json() as {
    layers: Array<{ type: string; world: { tiles: number[][] } }>;
  };
  return level.layers.find((l) => l.type === 'collision')?.world.tiles ?? null;
}

interface Loaded {
  collision: CollisionSystem;
  manager: GameObjectManager;
  hotSpots: HotSpotSystem;
  levelSystem: LevelSystem;
}

async function load(resource: string): Promise<Loaded | null> {
  sSystemRegistry.reset();
  const collision = new CollisionSystem();
  const manager = new GameObjectManager();
  const hotSpots = new HotSpotSystem();
  const camera = new CameraSystem(480, 320);
  const levelSystem = new LevelSystem();
  levelSystem.setSystems(collision, manager, hotSpots);
  manager.setCamera(camera);
  sSystemRegistry.register(collision, 'collision');
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(hotSpots, 'hotSpot');
  sSystemRegistry.register(camera, 'camera');
  if (!(await collision.loadCollisionData('/assets/collision.json'))) return null;
  const levelId = resourceToLevelId[resource];
  if (levelId === undefined) return null;
  if (!(await levelSystem.loadLevel(levelId))) return null;
  manager.commitUpdates();
  return { collision, manager, hotSpots, levelSystem };
}

/** Every tile the player can occupy, flooding from `startTile`. */
function reachable(
  loaded: Loaded,
  startTile: [number, number],
  cols: number,
  rows: number,
  grid: number[][] | null
): Set<string> {
  const { collision } = loaded;
  // isTileSolid() answers "does this tile have a collision definition", which
  // is true for slopes too - 33 of the 53 defined tiles carry a diagonal. The
  // game walks up those (getGroundSurfaceY / SLOPE_STEP_UP), so treating them
  // as walls here would report half the campaign as impassable. A tile only
  // blocks if it is a full axis-aligned block.
  const blocks = (x: number, y: number): boolean => {
    if (!collision.isTileSolid(x, y)) return false;
    const index = grid?.[y]?.[x];
    return index === undefined || !slopeTileIndices?.has(index);
  };

  // Andou is 32x48: one tile wide, and needs the tile above clear too.
  const free = (x: number, y: number): boolean =>
    x >= 0 && x < cols && y >= 0 && y < rows &&
    !blocks(x, y) && !blocks(x, y - 1);

  const seen = new Set<string>();
  const queue: Array<[number, number]> = [];
  const push = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (seen.has(key) || !free(x, y)) return;
    seen.add(key);
    queue.push([x, y]);
  };
  // The spawn itself may overlap geometry; seed from it and its neighbours.
  seen.add(startTile.join(','));
  queue.push(startTile);
  for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0]]) {
    push(startTile[0] + dx, startTile[1] + dy);
  }

  while (queue.length) {
    const [x, y] = queue.shift() as [number, number];
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return seen;
}

test('every level with a win condition lets the player reach it', async () => {
  await loadSlopeIndices();
  const failures: string[] = [];
  // Both routes must actually be exercised. Six levels - the intro variants,
  // level_3_10_sewer, level_3_11_sewer and level_4_3_underground - carry no
  // rubies at all and can only be finished by reaching a hot spot.
  let byRubies = 0;
  let byExit = 0;
  let checked = 0;

  const seenResources = new Set<string>();
  for (const group of linearLevelTree) {
    for (const entry of group.levels) {
      if (seenResources.has(entry.resource)) continue;
      seenResources.add(entry.resource);

      const loaded = await load(entry.resource);
      if (!loaded) continue;

      const player = loaded.manager.getPlayer();
      if (!player) continue; // cutscene levels have no player

      const { width, height } = loaded.levelSystem.getLevelSize();
      const cols = Math.round(width / TILE);
      const rows = Math.round(height / TILE);

      const tileOf = (o: GameObject): [number, number] => [
        Math.floor((o.getPosition().x + o.width / 2) / TILE),
        Math.floor((o.getPosition().y + o.height - 1) / TILE),
      ];

      const start = tileOf(player);
      const grid = await collisionGrid(entry.resource);
      const region = reachable(loaded, start, cols, rows, grid);

      // Targets: every ruby, plus any END_LEVEL hot spot.
      const targets: Array<{ what: string; tile: [number, number] }> = [];
      loaded.manager.forEach((o) => {
        if (o.type === 'ruby') targets.push({ what: 'ruby', tile: tileOf(o) });
      });
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const spot = loaded.hotSpots.getHotSpotByTile(x, y);
          if (spot === HotSpotType.END_LEVEL || spot === HotSpotType.GAME_EVENT) {
            targets.push({ what: 'END_LEVEL', tile: [x, y] });
          }
        }
      }
      if (targets.length === 0) continue; // boss levels end another way

      // A ruby counts as reachable if the player can stand in its tile or the
      // one below it - collectibles sit on ledges.
      const canReach = ({ tile }: { tile: [number, number] }): boolean =>
        region.has(`${tile[0]},${tile[1]}`) ||
        region.has(`${tile[0]},${tile[1] + 1}`) ||
        region.has(`${tile[0]},${tile[1] - 1}`);

      const rubies = targets.filter((t) => t.what === 'ruby');
      const ends = targets.filter((t) => t.what === 'END_LEVEL');
      const reachableRubies = rubies.filter(canReach).length;
      const reachableEnds = ends.filter(canReach).length;

      checked++;
      // The level is finishable if all three rubies are reachable, or any exit
      // tile is. `Math.min(3, rubies.length)` was wrong here: a level with no
      // rubies made the ruby clause 0 >= 0, so the six levels that can only be
      // finished by reaching a hot spot passed without their exit ever being
      // checked.
      const finishable = (rubies.length >= 3 && reachableRubies >= 3) || reachableEnds > 0;
      if (rubies.length >= 3) byRubies++; else byExit++;
      if (!finishable) {
        failures.push(
          `${entry.resource}: spawn ${start.join(',')} reaches ${region.size} tiles; ` +
          `${reachableRubies}/${rubies.length} rubies and ${reachableEnds}/${ends.length} exits reachable`
        );
      }
    }
  }

  expect(checked, 'no levels were actually checked').toBeGreaterThan(10);
  expect(byRubies, 'no ruby-finished level was checked').toBeGreaterThan(10);
  expect(byExit, 'no hot-spot-finished level was checked').toBeGreaterThan(1);
  expect(failures, 'these levels cannot be finished from the spawn').toEqual([]);
}, 180_000);

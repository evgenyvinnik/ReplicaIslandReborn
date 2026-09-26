import { expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { linearLevelTree } from '../data/levelTree';
import { GameObjectTypeIndex } from '../types/GameObjectTypes';
import { LevelParser } from './LevelParser';

test('authored gate openings and player spawns are not obstructed by converted terrain', async () => {
  const parser = new LevelParser();
  const gateTypes = new Set<number>([
    GameObjectTypeIndex.DOOR_RED, GameObjectTypeIndex.DOOR_BLUE,
    GameObjectTypeIndex.DOOR_GREEN, GameObjectTypeIndex.DOOR_RED_NONBLOCKING,
    GameObjectTypeIndex.DOOR_BLUE_NONBLOCKING, GameObjectTypeIndex.DOOR_GREEN_NONBLOCKING,
  ]);
  const gateOverlaps: string[] = [];
  const spawnOverlaps: string[] = [];
  let gatesChecked = 0;
  for (const resource of new Set(linearLevelTree.flatMap(group => group.levels.map(level => level.resource)))) {
    const json = await file(join(import.meta.dir, `../../public/assets/levels/${resource}.json`)).json();
    const parsed = parser.parseJsonLevelData(json);
    if (!parsed?.objectLayer || !parsed.collisionLayer) continue;
    // The runtime parser converts row-major JSON to tiles[x][y]. Reading the
    // JSON directly as column-major once produced false obstruction reports.
    const objects = parsed.objectLayer;
    const terrain = parsed.collisionLayer;
    for (let x = 0; x < objects.width; x++) for (let y = 0; y < objects.height; y++) {
      const type = objects.tiles[x]?.[y];
      if (!gateTypes.has(type) && type !== GameObjectTypeIndex.PLAYER) continue;
      const upper = terrain.tiles[x]?.[y - 1] ?? -1;
      const lower = terrain.tiles[x]?.[y] ?? -1;
      if (gateTypes.has(type)) {
        gatesChecked++;
        if (upper >= 0 || lower >= 0) gateOverlaps.push(`${resource} (${x},${y}): ${upper},${lower}`);
      } else if (upper >= 0 || lower >= 0) {
        spawnOverlaps.push(`${resource} (${x},${y}): ${upper},${lower}`);
      }
    }
  }
  expect(gatesChecked).toBeGreaterThan(30);
  // This one source-authored red gate is fully embedded in a wall. It is not
  // evidence that door animation should delete terrain tiles when opened.
  expect(gateOverlaps).toEqual(['level_3_11_sewer (2,17): 17,17']);
  expect(spawnOverlaps).toEqual([]);
});

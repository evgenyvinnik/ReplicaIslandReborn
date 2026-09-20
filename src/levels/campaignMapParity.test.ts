import { expect, test } from 'bun:test';
import { file } from 'bun';
import { levelTree, linearLevelTree } from '../data/levelTree';
import { LevelParser } from './LevelParser';

test('shipped campaign geometry, objects and scripts match original Android maps', async () => {
  const parser = new LevelParser();
  const resources = new Set([...levelTree, ...linearLevelTree].flatMap(group =>
    group.levels.map(level => level.resource)));
  const differences: string[] = [];
  for (const resource of resources) {
    const original = parser.parseLevelData(new Uint8Array(await file(
      new URL(`../../Original/res/raw/${resource}.bin`, import.meta.url)
    ).arrayBuffer()));
    const shipped = parser.parseJsonLevelData(await file(
      new URL(`../../public/assets/levels/${resource}.json`, import.meta.url)
    ).json());
    expect(original, resource).not.toBeNull();
    expect(shipped, resource).not.toBeNull();
    // Background artwork may have port-specific conversion. Gameplay layers
    // must not silently lose NPC commands, collision surfaces or pickups.
    for (const key of ['collisionLayer', 'objectLayer', 'hotSpotLayer'] as const) {
      const source = original![key];
      const converted = shipped![key];
      expect(Boolean(converted), `${resource}: ${key}`).toBe(Boolean(source));
      if (!source || !converted) continue;
      expect([converted.width, converted.height]).toEqual([source.width, source.height]);
      for (let x = 0; x < source.width; x++) {
        for (let y = 0; y < source.height; y++) {
          if (source.tiles[x][y] !== converted.tiles[x][y]) {
            differences.push(`${resource}: ${key} (${x},${y}) expected ${source.tiles[x][y]}, got ${converted.tiles[x][y]}`);
          }
        }
      }
    }
  }
  expect(differences).toEqual([]);
});

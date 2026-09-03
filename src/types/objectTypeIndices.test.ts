/**
 * Object type indices, against GameObjectFactory.java's GameObjectType enum.
 *
 * These numbers are the level format: a byte in a level's object layer is one
 * of them. Get one wrong and the level spawns the wrong thing, silently and
 * only on the levels that use it.
 *
 * The original has a genuine collision in its own enum - ENERGY_BALL(68) and
 * BREAKABLE_BLOCK_PIECE(68) share an index. Both are spawned programmatically
 * and never appear in level data, so it never mattered there; this port gives
 * them distinct numbers. That is the one deliberate difference, and this test
 * confirms it cannot affect anything the levels actually reference.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GameObjectTypeIndex } from './GameObjectTypes';

const root = join(import.meta.dir, '../..');

/** name -> index, parsed straight out of the original's enum. */
function originalIndices(): Map<string, number> {
  const source = readFileSync(
    join(root, 'Original/src/com/replica/replicaisland/GameObjectFactory.java'),
    'utf8'
  );
  const start = source.indexOf('public enum GameObjectType');
  // The enum body ends at its final entry, OBJECT_COUNT(-1);
  const end = source.indexOf('OBJECT_COUNT(-1);', start);
  const body = source.slice(start, end);
  const found = new Map<string, number>();
  for (const match of body.matchAll(/(\w+)\s*\(\s*(-?\d+)\s*\)/g)) {
    found.set(match[1], Number(match[2]));
  }
  return found;
}

/** Every object index that appears in a shipped level. */
function indicesUsedByLevels(): Set<number> {
  const levelDir = join(root, 'public/assets/levels');
  const used = new Set<number>();
  for (const file of readdirSync(levelDir)) {
    if (!file.endsWith('.json')) continue;
    const level = JSON.parse(readFileSync(join(levelDir, file), 'utf8')) as {
      layers: Array<{ type: string; world: { tiles: number[][] } }>;
    };
    const objects = level.layers.find((layer) => layer.type === 'objects');
    if (!objects) continue;
    for (const row of objects.world.tiles) {
      for (const value of row) if (value >= 0) used.add(value);
    }
  }
  return used;
}

describe('object type indices', () => {
  test('every index a level uses means the same thing as in the original', () => {
    const original = originalIndices();
    const byIndex = new Map<number, string[]>();
    for (const [name, index] of original) {
      if (index < 0) continue;
      if (!byIndex.has(index)) byIndex.set(index, []);
      byIndex.get(index)!.push(name);
    }

    const port = GameObjectTypeIndex as unknown as Record<string, number>;
    const wrong: string[] = [];
    for (const index of [...indicesUsedByLevels()].sort((a, b) => a - b)) {
      const names = byIndex.get(index);
      expect(names, `no original type has index ${index}`).toBeDefined();
      // At least one of the original's names for this index must agree.
      const agrees = names!.some((name) => port[name] === index);
      if (!agrees) wrong.push(`${index}: original calls it ${names!.join('/')}`);
    }
    expect(wrong, 'level data would spawn the wrong object').toEqual([]);
  });

  test('levels only reference indices below the range the port renumbered', () => {
    // The port shifts BREAKABLE_BLOCK_PIECE, its spawner and WANDA_SHOT up by
    // one to break the original's duplicate 68. That is only safe while no
    // level names them.
    const highest = Math.max(...indicesUsedByLevels());
    expect(highest).toBeLessThan(GameObjectTypeIndex.BREAKABLE_BLOCK_PIECE);
  });

  test('the original really does collide on 68', () => {
    // Guards the premise of the renumbering: if a future copy of the original
    // fixes this, the port should follow it rather than keep an invented shift.
    const original = originalIndices();
    expect(original.get('ENERGY_BALL')).toBe(68);
    expect(original.get('BREAKABLE_BLOCK_PIECE')).toBe(68);
  });
});

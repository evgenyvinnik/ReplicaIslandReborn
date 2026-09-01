/**
 * Every level the campaign can reach must have a way to finish it.
 *
 * The port's only completion paths are the original's:
 *
 *  - collecting `MAX_GEMS_PER_LEVEL` (3) rubies, which is what
 *    PlayerComponent checks before gotoWin();
 *  - an NPC walking onto an END_LEVEL or GAME_EVENT hot spot, which is how the
 *    scripted/cutscene levels end;
 *  - killing a boss, which posts a SHOW_ANIMATION ending instead.
 *
 * A level with none of those is a dead end - the player reaches it and can
 * never leave. This is the check that would have caught "the game is
 * unplayable" directly, so it reads the shipped level data rather than trusting
 * any code path.
 */

import { describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { levelTree, linearLevelTree } from '../data/levelTree';
import { GameObjectTypeIndex } from '../types/GameObjectTypes';
import { HotSpotType } from '../engine/HotSpotSystem';

const levelsDirectory = join(import.meta.dir, '../../public/assets/levels');

interface LevelLayers {
  layers: Array<{ type: string; world: { tiles: number[][] } }>;
}

async function readLayer(resource: string, type: string): Promise<number[]> {
  const data = await file(join(levelsDirectory, `${resource}.json`)).json() as LevelLayers;
  const layer = data.layers.find((candidate) => candidate.type === type);
  return layer ? layer.world.tiles.flat() : [];
}

/** Every level resource reachable through either progression tree. */
function reachableResources(): string[] {
  const resources = new Set<string>();
  for (const tree of [levelTree, linearLevelTree]) {
    for (const group of tree) {
      for (const entry of group.levels) {
        resources.add(entry.resource);
      }
    }
  }
  return [...resources].sort();
}

const BOSS_TYPES = [
  GameObjectTypeIndex.EVIL_KABOCHA,
  GameObjectTypeIndex.ROKUDOU,
  GameObjectTypeIndex.THE_SOURCE,
];

const ENDING_HOT_SPOTS = [HotSpotType.END_LEVEL, HotSpotType.GAME_EVENT];

describe('every reachable level can be finished', () => {
  test('the progression tree only references levels that exist', async () => {
    for (const resource of reachableResources()) {
      const exists = await file(join(levelsDirectory, `${resource}.json`)).exists();
      expect(exists, `${resource}.json missing`).toBe(true);
    }
  });

  test('each level offers a completion path', async () => {
    const deadEnds: string[] = [];

    for (const resource of reachableResources()) {
      const objects = await readLayer(resource, 'objects');
      const hotSpots = await readLayer(resource, 'hotspots');

      const rubies = objects.filter((type) => type === GameObjectTypeIndex.RUBY).length;
      const hasBoss = objects.some((type) => BOSS_TYPES.includes(type as never));
      const hasEndingHotSpot = hotSpots.some((type) => ENDING_HOT_SPOTS.includes(type as never));

      // MAX_GEMS_PER_LEVEL is 3; fewer rubies than that can never trigger a win.
      if (rubies < 3 && !hasBoss && !hasEndingHotSpot) {
        deadEnds.push(`${resource} (rubies=${rubies})`);
      }
    }

    expect(deadEnds).toEqual([]);
  });

  test('levels won by rubies carry exactly the three the win needs', async () => {
    // A level with one or two rubies would look collectable but never complete.
    for (const resource of reachableResources()) {
      const objects = await readLayer(resource, 'objects');
      const rubies = objects.filter((type) => type === GameObjectTypeIndex.RUBY).length;
      if (rubies === 0) continue;
      expect(rubies, `${resource} has ${rubies} rubies`).toBeGreaterThanOrEqual(3);
    }
  });
});

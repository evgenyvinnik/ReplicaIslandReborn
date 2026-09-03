import { describe, expect, test } from 'bun:test';
import { LevelSystem } from './LevelSystemNew';
import { levelTree, linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { useGameStore } from '../stores/useGameStore';

describe('LevelSystem story progression', () => {
  test('finishes every branch in a group before skipping to the next group', () => {
    const groupIndex = levelTree.findIndex((group) =>
      group.levels.some((entry) => entry.resource === 'level_1_5_island')
    );
    const groupIds = levelTree[groupIndex].levels.map((entry) =>
      resourceToLevelId[entry.resource]
    );
    const currentLevelId = resourceToLevelId.level_1_5_island;
    const expectedRemainingLevel = groupIds.find((id) => id !== currentLevelId);
    if (expectedRemainingLevel === undefined) {
      throw new Error('Expected the selected story group to contain another branch');
    }

    useGameStore.setState((state) => ({
      progress: {
        ...state.progress,
        currentLevel: currentLevelId,
        levels: {},
      },
    }));

    const levelSystem = new LevelSystem();
    (levelSystem as unknown as { currentLevelId: number }).currentLevelId = currentLevelId;

    expect(levelSystem.getNextLevelId()).not.toBe(expectedRemainingLevel);
    expect(levelSystem.completeCurrentLevel()).toBe(expectedRemainingLevel);
  });

  /**
   * Walking the whole campaign, one completeCurrentLevel() at a time.
   *
   * levelCompletable.test.ts proves each level has *a way* to be finished;
   * this proves the chain those completions form actually reaches the end,
   * rather than stalling on a level whose successor is missing or looping
   * back on itself. A stall here means the game cannot be finished, which no
   * per-level test would notice.
   */
  function walkCampaign(startResource: string): {
    visited: number[];
    ended: boolean;
    revisited: number | null;
  } {
    const startId = resourceToLevelId[startResource];
    useGameStore.setState((state) => ({
      progress: { ...state.progress, currentLevel: startId, levels: {} },
    }));

    const levelSystem = new LevelSystem();
    const internals = levelSystem as unknown as { currentLevelId: number };
    internals.currentLevelId = startId;

    const visited: number[] = [startId];
    const seen = new Set<number>([startId]);
    let revisited: number | null = null;

    // Generous ceiling: the campaign has ~41 levels.
    for (let step = 0; step < 200; step++) {
      // completeCurrentLevel() reads completion out of the store but does not
      // write it - Game.tsx records it via completeLevel() before advancing.
      // Without that the group never finishes and it hands back the same
      // branch forever.
      useGameStore.getState().completeLevel(internals.currentLevelId, 0, 0);
      const next = levelSystem.completeCurrentLevel();
      if (next === null) return { visited, ended: true, revisited };
      if (seen.has(next)) { revisited = next; return { visited, ended: false, revisited }; }
      seen.add(next);
      visited.push(next);
      internals.currentLevelId = next;
    }
    return { visited, ended: false, revisited };
  }

  test('the campaign can be walked from the first level to the end', () => {
    const first = levelTree[0].levels[0].resource;
    const { visited, ended, revisited } = walkCampaign(first);

    expect(revisited, `progression looped back to level ${revisited}`).toBeNull();
    expect(ended, `progression stalled after ${visited.length} levels`).toBe(true);
    // It should pass through most of the campaign, not stop after a handful.
    expect(visited.length).toBeGreaterThan(25);
  });

  test('every level in the tree is reachable by completing the one before it', () => {
    const first = levelTree[0].levels[0].resource;
    const { visited } = walkCampaign(first);
    const reached = new Set(visited);

    // Groups offer a choice of branches, so a single walk will not touch every
    // level - but it must touch at least one level from every group, or a
    // whole chapter is unreachable.
    const unreachableGroups: number[] = [];
    levelTree.forEach((group, index) => {
      const ids = group.levels.map((e) => resourceToLevelId[e.resource]);
      if (!ids.some((id) => reached.has(id))) unreachableGroups.push(index);
    });
    expect(unreachableGroups, 'story groups no walk of the tree can reach').toEqual([]);
  });

  test('linear mode also reaches the end', () => {
    const first = linearLevelTree[0].levels[0].resource;
    const { visited, ended, revisited } = walkCampaign(first);
    expect(revisited).toBeNull();
    expect(ended, `linear progression stalled after ${visited.length} levels`).toBe(true);
  });
});

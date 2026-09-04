/**
 * Can you get from the first level to the last?
 *
 * Every other level test looks at one level at a time. This walks the whole
 * campaign the way a player does: finish a level, take whatever
 * `completeCurrentLevel()` hands back, finish that, and so on. A dead end, a
 * loop, or an early `null` would end the game in the middle with no error -
 * the level simply never advances, or the game reports itself complete.
 *
 * The rule it encodes is the original's, from AndouKun.java: after finishing a
 * level, scan the current group for one that is not yet completed and go there;
 * only when the whole group is done does the row advance.
 *
 *     for (int x = 0; x < count; x++) {
 *         if (currentGroup.levels.get(x).completed == false) {
 *             mLevelIndex = x; groupCompleted = false; break;
 *         }
 *     }
 *     if (groupCompleted) { mLevelIndex = 0; mLevelRow++; }
 *
 * So a group of three memories makes you play all three, not one - which is
 * worth stating, because this file used to claim the opposite.
 */

import { beforeEach, expect, test } from 'bun:test';
import { LevelSystem } from './LevelSystemNew';
import { levelTree, resourceToLevelId } from '../data/levelTree';
import { useGameStore } from '../stores/useGameStore';

/** Total levels the tree can reach. */
const treeLevelIds = levelTree.flatMap((group) =>
  group.levels.map((l) => resourceToLevelId[l.resource]).filter((id): id is number => id !== undefined)
);

beforeEach(() => {
  // A fresh save: nothing completed.
  useGameStore.setState((s) => ({
    progress: { ...s.progress, levels: {}, currentLevel: 1 },
  }));
});

test('completing levels walks the whole tree and ends after the last group', () => {
  const levelSystem = new LevelSystem();
  const firstId = resourceToLevelId[levelTree[0].levels[0].resource];
  expect(firstId, 'the tree should start somewhere').toBeDefined();

  const visited: number[] = [];
  let current: number | null = firstId as number;

  // Generous bound: every level once, plus slack. A loop trips this.
  for (let step = 0; step < treeLevelIds.length * 3 && current !== null; step++) {
    visited.push(current);
    // Put the system on this level without loading its data, then finish it
    // the way Game.tsx does: record it in the store, then ask for the next.
    (levelSystem as unknown as { currentLevelId: number }).currentLevelId = current;
    useGameStore.getState().completeLevel(current, 0, 1);
    current = levelSystem.completeCurrentLevel();
  }

  expect(current, 'progression did not terminate - a loop in the tree').toBeNull();

  // Every level in the tree should have been offered exactly once.
  const unique = new Set(visited);
  expect(unique.size, 'a level was visited twice').toBe(visited.length);

  const missed = treeLevelIds.filter((id) => !unique.has(id));
  expect(missed, 'these levels are unreachable by playing forward').toEqual([]);
});

test('a group with several memories offers all of them before advancing', () => {
  // The original makes you play every level in a group. Find a group with more
  // than one and check the tree hands them all back in turn.
  const multi = levelTree.findIndex((g) => g.levels.length > 1);
  expect(multi, 'the tree should contain a branching group').toBeGreaterThan(-1);

  const group = levelTree[multi];
  const ids = group.levels
    .map((l) => resourceToLevelId[l.resource])
    .filter((id): id is number => id !== undefined);

  const levelSystem = new LevelSystem();
  const offered: number[] = [];
  let current: number | null = ids[0];

  for (let i = 0; i < ids.length && current !== null; i++) {
    offered.push(current);
    (levelSystem as unknown as { currentLevelId: number }).currentLevelId = current;
    useGameStore.getState().completeLevel(current, 0, 1);
    current = levelSystem.completeCurrentLevel();
  }

  // Everything in the group was offered before we left it.
  expect([...offered].sort(), `group ${multi} skipped a memory`).toEqual([...ids].sort());
});

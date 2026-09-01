import { describe, expect, test } from 'bun:test';
import { LevelSystem } from './LevelSystemNew';
import { levelTree, resourceToLevelId } from '../data/levelTree';
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
});

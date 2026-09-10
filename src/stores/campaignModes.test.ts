import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { useGameStore } from './useGameStore';
import { generateLevelList, levelTree, linearLevelTree, resourceToLevelId } from '../data/levelTree';

for (const mode of ['story', 'linear', 'levelSelect'] as const) {
  test(`${mode} starts a fresh route while preserving earned extras and global records`, () => {
    const saved = useGameStore.getState();
    try {
      saved.completeLevel(41, 100, 30);
      saved.unlockExtra('linearMode');
      saved.unlockExtra('levelSelect');
      saved.collectDiary(41, 2);
      const previous = useGameStore.getState();
      previous.startNewCampaign(mode);
      const next = useGameStore.getState();
      const first = (mode === 'linear' ? linearLevelTree : levelTree)[0].levels[0];
      expect(next.progress.currentLevel).toBe(resourceToLevelId[first.resource]);
      expect(next.progress.isLinearMode).toBe(mode === 'linear');
      expect(Object.keys(next.progress.levels)).toEqual([String(next.progress.currentLevel)]);
      expect(next.progress.levels[next.progress.currentLevel].completed).toBe(false);
      expect(next.progress.levels[next.progress.currentLevel].timesPlayed).toBe(0);
      expect(next.progress.extrasUnlocked).toEqual(previous.progress.extrasUnlocked);
      expect(next.progress.diariesCollected).toEqual(previous.progress.diariesCollected);
      expect(next.progress.totalStats).toEqual(previous.progress.totalStats);
      expect(next.highScores).toEqual(previous.highScores);
      expect(next.settings).toEqual(previous.settings);
    } finally {
      useGameStore.setState(saved);
    }
  });
}

test('Extras Level Select enables the complete story tree without substituting the linear route', () => {
  const levels = generateLevelList(new Set(), true, false, true);
  expect(levels.every(level => level.enabled)).toBe(true);
  expect(levels.map(entry => entry.level.resource))
    .toEqual(levelTree.flatMap(group => group.levels.map(level => level.resource)));
  expect(levels.length).toBeGreaterThan(linearLevelTree.length);
  // Normal story access is still gated.
  expect(generateLevelList(new Set()).some(level => !level.enabled)).toBe(true);
});

test('menu return retains campaign mode and difficulty commits the pending new campaign', () => {
  const context = readFileSync(new URL('../context/GameContext.tsx', import.meta.url), 'utf8');
  const menuReturn = context.slice(context.indexOf('const goToMainMenu ='), context.indexOf('const goToLevelSelect ='));
  expect(menuReturn).not.toContain('SET_LINEAR_MODE');
  const startNew = context.slice(context.indexOf('const startNewGame ='), context.indexOf('const confirmNewGame ='));
  expect(startNew).not.toContain('useGameStore'); // cancelling difficulty does not mutate the save
  expect(context).toContain('isLinearMode: progress.isLinearMode ?? false');
  const difficulty = readFileSync(new URL('../components/DifficultyMenu.tsx', import.meta.url), 'utf8');
  expect(difficulty).toContain('confirmNewGame()');
});

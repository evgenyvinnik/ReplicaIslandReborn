import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { LevelSystem } from './LevelSystemNew';
import { completedLevelIdsToResourceSet, generateLevelList, levelTree, resourceToLevelId } from '../data/levelTree';
import { getCompletedLevelIds } from '../stores/progressUtils';
import { useGameStore } from '../stores/useGameStore';

test.each([false, true])('memory handoff follows every original XML group (linear: %s)', linear => {
  const file = linear ? 'linear_level_tree.xml' : 'level_tree.xml';
  const xml = readFileSync(new URL(`../../Original/res/xml/${file}`, import.meta.url), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, ''); // Unused draft levels are commented out.
  const levels = new LevelSystem();
  levels.setLinearMode(linear);
  let checked = 0;
  for (const group of xml.matchAll(/<group>([\s\S]*?)<\/group>/g)) {
    const entries = [...group[1].matchAll(/<level\s+([^>]+)>/g)];
    for (const [, attributes] of entries) {
      const resource = /resource\s*=\s*"@raw\/([^"]+)"/.exec(attributes)![1];
      const expected = /past\s*=\s*"true"/.test(attributes) || entries.length > 1;
      expect(levels.shouldShowLevelSelect(resourceToLevelId[resource]), resource).toBe(expected);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(35);
  expect(levels.shouldShowLevelSelect(-1)).toBe(false);
});

test('either newly unlocked memory can be chosen without skipping its sibling', () => {
  const saved = useGameStore.getState();
  try {
    useGameStore.getState().startNewCampaign('story');
    const branch = levelTree.findIndex(group => group.levels.length > 1);
    for (const group of levelTree.slice(0, branch)) {
      for (const level of group.levels) useGameStore.getState().completeLevel(resourceToLevelId[level.resource], 0, 0);
    }
    const levels = new LevelSystem();
    const predecessor = resourceToLevelId[levelTree[branch - 1].levels[0].resource];
    const ids = levelTree[branch].levels.map(level => resourceToLevelId[level.resource]);
    (levels as unknown as { currentLevelId: number }).currentLevelId = predecessor;
    expect(levels.completeCurrentLevel()).toBe(ids[0]);
    expect(levels.shouldShowLevelSelect(ids[0])).toBe(true);
    const completed = completedLevelIdsToResourceSet(getCompletedLevelIds(useGameStore.getState().progress.levels));
    expect(generateLevelList(completed).filter(level => level.enabled).map(level => resourceToLevelId[level.level.resource])).toEqual(ids);
    // Pick the second memory first, as a real choice screen permits.
    (levels as unknown as { currentLevelId: number }).currentLevelId = ids[1];
    useGameStore.getState().completeLevel(ids[1], 0, 0);
    expect(levels.completeCurrentLevel()).toBe(ids[0]);
    expect(useGameStore.getState().progress.levels[ids[0]].completed).toBe(false);
    expect(useGameStore.getState().progress.levels[ids[0]].timesPlayed).toBe(0);
  } finally {
    useGameStore.setState(saved);
  }
});

test('an explicitly unlocked destination remains selectable when earlier records are missing', () => {
  // Completing a selected memory unlocks its sibling even if the save was
  // imported or repaired without a contiguous record of every older group.
  // LevelSystem persists that explicit unlock; Level Select must not discard it.
  const completed = new Set(['level_2_6_grass']);
  const unlocked = new Set(['level_3_2_sewer']);
  const list = generateLevelList(completed, true, false, false, unlocked);
  const byResource = new Map(list.map(entry => [entry.level.resource, entry]));
  expect(byResource.get('level_3_2_sewer')?.enabled).toBe(true);
  expect(byResource.get('level_3_3_sewer')?.enabled ?? false).toBe(false);
});

test('both next-level paths offer memory selection before loading the destination', () => {
  const game = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  const handoffs = [...game.matchAll(/setLevel\(nextLevelId\);([\s\S]*?)\.loadLevel\(nextLevelId\)/g)];
  expect(handoffs).toHaveLength(2); // Scripted event (also non-restartable death), results Continue.
  for (const [, handoff] of handoffs) {
    expect(handoff).toContain('shouldShowLevelSelect(nextLevelId)');
    expect(handoff).toMatch(/goToLevelSelect\(\);\s*return;/);
    expect(handoff).not.toContain('beginLevelAttempt');
  }
});

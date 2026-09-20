import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { collectLevelDiary } from './diaryProgress';
import { useGameStore } from './useGameStore';
import { getInventory, resetInventory, setInventory } from '../entities/components/InventoryComponent';
import { resourceToLevelId } from '../data/levelTree';

const initial = useGameStore.getState();
const initialInventory = { ...getInventory() };
beforeEach(() => useGameStore.setState({ progress: { ...initial.progress, levels: {}, diariesCollected: [] } }));
afterEach(() => {
  useGameStore.setState(initial);
  setInventory(initialInventory);
});

// Read the authored bindings, including self-closing levels and excluding
// commented-out drafts, independently of the port's runtime mapping.
function originalDiaries(tree: string): Array<[number, number]> {
  const xml = readFileSync(new URL(`../../Original/res/xml/${tree}.xml`, import.meta.url), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  return [...xml.matchAll(/<level\b([^>]*?)(?:\/>|>([\s\S]*?)<\/level>)/g)].flatMap(level => {
    const resource = level[1].match(/resource\s*=\s*"@raw\/([^"]+)"/)?.[1];
    const diary = level[2]?.match(/<diary\b[^>]*resource\s*=\s*"@string\/Diary(\d+)"/)?.[1];
    return resource && diary ? [[resourceToLevelId[resource], Number(diary)] as [number, number]] : [];
  });
}

test.each(['level_tree', 'linear_level_tree'])('%s awards authored logs regardless of pickup order or inventory resets', tree => {
  const bindings = originalDiaries(tree);
  expect(bindings).toHaveLength(15);
  // Reverse order also exercises starting late and skipping earlier diaries.
  for (const [levelId, diaryId] of bindings.reverse()) {
    resetInventory();
    expect(collectLevelDiary(levelId)?.id, `level ${levelId}`).toBe(diaryId);
    expect(useGameStore.getState().progress.levels[levelId].diariesCollected).toEqual([diaryId]);
    expect(collectLevelDiary(levelId)).toBeNull();
  }
  expect([...useGameStore.getState().progress.diariesCollected].sort((a, b) => a - b))
    .toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
});

test('an underground diary selected first is entry 7, not entry 1', () => {
  expect(collectLevelDiary(33)?.id).toBe(7);
  resetInventory();
  expect(collectLevelDiary(4)?.id).toBe(1);
  expect(useGameStore.getState().progress.diariesCollected).toEqual([7, 1]);
});

test('levels without an authored diary do not award arbitrary entries', () => {
  const diaryLevels = new Set(originalDiaries('level_tree').map(([levelId]) => levelId));
  for (const levelId of [...Object.values(resourceToLevelId), -1, 999]) {
    if (!diaryLevels.has(levelId)) expect(collectLevelDiary(levelId)).toBeNull();
  }
  expect(useGameStore.getState().progress.diariesCollected).toEqual([]);
});

test('legacy collected-level flags remain respected without rewriting the save', () => {
  useGameStore.getState().collectDiary(33, 1);
  const progress = useGameStore.getState().progress;
  expect(collectLevelDiary(33)).toBeNull();
  expect(useGameStore.getState().progress).toBe(progress);
  // The wrongly awarded global entry must not suppress its authored pickup.
  expect(collectLevelDiary(4)?.id).toBe(1);
  expect(useGameStore.getState().progress.levels[4].diariesCollected).toEqual([1]);
  expect(useGameStore.getState().progress.diariesCollected).toEqual([1]);
});

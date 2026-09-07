import { afterEach, expect, test } from 'bun:test';
import { collectNextDiary } from './diaryProgress';
import { useGameStore } from './useGameStore';
import { resetInventory } from '../entities/components/InventoryComponent';

const initial = useGameStore.getState().progress;
afterEach(() => useGameStore.setState({ progress: initial }));

test('diaries advance across levels even though inventory resets between them', () => {
  useGameStore.setState({ progress: { ...initial, levels: {}, diariesCollected: [] } });
  expect(collectNextDiary(4)?.id).toBe(1);
  resetInventory();
  expect(collectNextDiary(8)?.id).toBe(2);
  resetInventory();
  expect(collectNextDiary(12)?.id).toBe(3);
  expect(useGameStore.getState().progress.diariesCollected).toEqual([1, 2, 3]);
  expect(useGameStore.getState().progress.levels[8].diariesCollected).toEqual([2]);
});

test('replaying a collected diary does not award another log entry', () => {
  useGameStore.setState({ progress: { ...initial, levels: {}, diariesCollected: [] } });
  collectNextDiary(4);
  resetInventory();
  expect(collectNextDiary(4)).toBeNull();
  expect(useGameStore.getState().progress.diariesCollected).toEqual([1]);
});

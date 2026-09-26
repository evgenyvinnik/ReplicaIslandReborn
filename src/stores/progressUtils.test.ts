import { describe, expect, test } from 'bun:test';
import {
  getCompletedLevelIds,
  hasPersistedGameProgress,
  inferCurrentLevel,
  resolvePlayableLevelId,
  repairLegacyDiaryAssignments,
  type LevelProgressSummary,
} from './progressUtils';

const level = (
  completed: boolean,
  timesPlayed: number = 0,
  lastPlayedAt: number | null = null
): LevelProgressSummary => ({ completed, timesPlayed, lastPlayedAt });

describe('progress helpers', () => {
  test('returns completed numeric level ids in story-safe order', () => {
    expect(getCompletedLevelIds({
      12: level(true),
      2: level(false),
      4: level(true),
    })).toEqual([4, 12]);
  });

  test('infers the most recently played level when migrating old saves', () => {
    expect(inferCurrentLevel({
      1: level(true, 1, 100),
      8: level(false, 2, 300),
      4: level(true, 1, 200),
    })).toBe(8);
  });

  test('distinguishes a fresh save from resumable progress', () => {
    expect(hasPersistedGameProgress({ 1: level(false) }, 1)).toBe(false);
    expect(hasPersistedGameProgress({ 1: level(false, 1, 100) }, 1)).toBe(true);
    expect(hasPersistedGameProgress({ 1: level(false) }, 4)).toBe(true);
  });

  test('resumes only levels in the selected campaign without discarding the save', () => {
    expect(resolvePlayableLevelId(6, false)).toBe(6);
    expect(resolvePlayableLevelId(7, false)).toBe(8);
    expect(resolvePlayableLevelId(21, false)).toBe(22);
    expect(resolvePlayableLevelId(7, true)).toBe(8);
    expect(resolvePlayableLevelId(1, true)).toBe(2);
    expect(resolvePlayableLevelId(0, false)).toBeNull();
    expect(resolvePlayableLevelId(999, false)).toBeNull();
    expect(resolvePlayableLevelId(Number.NaN, false)).toBeNull();
  });

  test('makes a misassigned log collectible again without erasing older global finds', () => {
    const levels = {
      4: { diariesCollected: [1], completed: true },
      8: { diariesCollected: [2], completed: false },
      12: { diariesCollected: [], completed: false },
    };
    const result = repairLegacyDiaryAssignments(levels, [1, 2, 9]);
    expect(result.levels[4]).toBe(levels[4]);
    expect(result.levels[8].diariesCollected).toEqual([]);
    expect(result.levels[8].completed).toBe(false);
    expect(result.levels[12]).toBe(levels[12]);
    expect(result.diariesCollected).toEqual([1, 2, 9]);
    expect(levels[8].diariesCollected).toEqual([2]);
    expect(repairLegacyDiaryAssignments({ 8: { diariesCollected: [4, 2] } }, [])).toEqual({
      levels: { 8: { diariesCollected: [4] } },
      diariesCollected: [4],
    });
  });
});

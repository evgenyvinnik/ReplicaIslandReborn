import { describe, expect, test } from 'bun:test';
import {
  getCompletedLevelIds,
  hasPersistedGameProgress,
  inferCurrentLevel,
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
});

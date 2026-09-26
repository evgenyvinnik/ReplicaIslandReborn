/**
 * Pure helpers for translating persisted level progress into story progress.
 * Kept separate from the Zustand store so the rules can be regression tested
 * without a browser/localStorage environment.
 */

import { levelTree, linearLevelTree, resourceToLevelId } from '../data/levelTree';

export interface LevelProgressSummary {
  completed: boolean;
  timesPlayed: number;
  lastPlayedAt: number | null;
}

export function getCompletedLevelIds(
  levels: Record<number, LevelProgressSummary>
): number[] {
  return Object.entries(levels)
    .filter(([, progress]) => progress.completed)
    .map(([levelId]) => Number(levelId))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export function inferCurrentLevel(
  levels: Record<number, LevelProgressSummary>,
  fallbackLevel: number = 1
): number {
  const playedLevels = Object.entries(levels)
    .map(([levelId, progress]) => ({ levelId: Number(levelId), progress }))
    .filter(({ levelId, progress }) =>
      Number.isFinite(levelId) &&
      (progress.timesPlayed > 0 || progress.lastPlayedAt !== null)
    )
    .sort((a, b) =>
      (b.progress.lastPlayedAt ?? 0) - (a.progress.lastPlayedAt ?? 0)
    );

  return playedLevels[0]?.levelId ?? fallbackLevel;
}

export function hasPersistedGameProgress(
  levels: Record<number, LevelProgressSummary>,
  currentLevel: number
): boolean {
  return currentLevel > 1 || Object.values(levels).some((progress) =>
    progress.completed || progress.timesPlayed > 0
  );
}

/**
 * Old saves can point at source levels omitted from the playable campaign.
 * Resume at the next authored level in the same mode, or let the player choose
 * if the saved id lies outside the campaign entirely.
 */
export function resolvePlayableLevelId(
  savedLevelId: number,
  isLinearMode: boolean
): number | null {
  const tree = isLinearMode ? linearLevelTree : levelTree;
  const playableIds = tree.flatMap((group) =>
    group.levels.map((level) => resourceToLevelId[level.resource])
  ).sort((a, b) => a - b);

  if (!Number.isInteger(savedLevelId)) return null;
  if (playableIds.includes(savedLevelId)) return savedLevelId;
  if (!Object.values(resourceToLevelId).includes(savedLevelId)) {
    return null;
  }
  return playableIds.find((id) => id > savedLevelId) ?? null;
}

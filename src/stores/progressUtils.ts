/**
 * Pure helpers for translating persisted level progress into story progress.
 * Kept separate from the Zustand store so the rules can be regression tested
 * without a browser/localStorage environment.
 */

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

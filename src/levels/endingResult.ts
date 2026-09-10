import type { GameProgress } from '../stores/useGameStore';
import type { EndingStats } from '../engine/CanvasEndingStatsScreen';

/** Snapshot this playthrough, never the lifetime leaderboard counters. */
export function createEndingStats(progress: GameProgress, ending: EndingStats['ending']): EndingStats {
  return {
    ...progress.campaignStats,
    diariesCollected: progress.diariesCollected.length,
    partialHistory: progress.campaignStatsPartial,
    ending,
  };
}

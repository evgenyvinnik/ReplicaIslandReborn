import type { InventoryRecord } from '../entities/components/InventoryComponent';
import { useGameStore } from '../stores/useGameStore';

/** The web port's existing results-screen bonus, not an Android scoring rule. */
export function calculateLevelScore(inventory: Pick<InventoryRecord, 'score' | 'lives'>): {
  lifeBonus: number; finalScore: number;
} {
  const lifeBonus = inventory.lives * 1000;
  return { lifeBonus, finalScore: inventory.score + lifeBonus };
}

/** Record a playable level's displayed result; callers guard against duplicate completion. */
export function recordLevelResult(levelId: number, inventory: InventoryRecord, elapsedTime: number): {
  bestTime: number | null; bestScore: number; currentTime: number;
} {
  const store = useGameStore.getState();
  const previous = store.progress.levels[levelId];
  const comparison = {
    bestTime: previous?.bestTime ?? null,
    bestScore: previous?.bestScore ?? 0,
    currentTime: elapsedTime,
  };
  const { finalScore } = calculateLevelScore(inventory);
  store.completeLevel(levelId, finalScore, elapsedTime);
  store.addToTotalStats({
    totalPlayTime: elapsedTime,
    totalScore: finalScore,
    totalCoinsCollected: inventory.coinCount,
    totalRubiesCollected: inventory.rubyCount,
  });
  return comparison;
}

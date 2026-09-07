import type { GameObjectManager } from '../entities/GameObjectManager';
import { PlayerComponent } from '../entities/components/PlayerComponent';
import { resetPlayerRuntimeState } from '../entities/resetPlayerRuntimeState';
import { useGameStore, type DifficultyConstants } from '../stores/useGameStore';

/** Call exactly once after a successful load, including automatic death retries. */
export function startLevelAttempt(levelId: number, manager: GameObjectManager, difficulty: DifficultyConstants): void {
  manager.commitUpdates();
  const store = useGameStore.getState();
  store.recordLevelAttempt(levelId);
  const attempts = useGameStore.getState().progress.levels[levelId].timesPlayed;
  const player = manager.getPlayer();
  if (player) {
    // Refill from base difficulty before applying assistance, never stack boosts.
    player.maxLife = difficulty.playerMaxLife;
    resetPlayerRuntimeState(player);
    player.getComponent(PlayerComponent)?.applyDifficulty(difficulty, attempts, player);
  }
}

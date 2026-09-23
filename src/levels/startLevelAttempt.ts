import type { GameObjectManager } from '../entities/GameObjectManager';
import type { EffectsSystem } from '../engine/EffectsSystem';
import { PlayerComponent } from '../entities/components/PlayerComponent';
import { setInventory } from '../entities/components/InventoryComponent';
import { resetPlayerRuntimeState } from '../entities/resetPlayerRuntimeState';
import { useGameStore, type DifficultyConstants } from '../stores/useGameStore';

/** Call exactly once after a successful load, including automatic death retries. */
export function startLevelAttempt(
  levelId: number,
  manager: GameObjectManager,
  difficulty: DifficultyConstants,
  effects?: EffectsSystem | null
): void {
  // Level objects are cleared by LevelSystem; its separate visual-effect pool
  // must not carry particles from a failed attempt or previous map.
  effects?.clear();
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
    // Level loading resets inventory before difficulty and retry assistance
    // finalize health. Results must see the same lives as the player/HUD even
    // when no hit or power-up subsequently updates the inventory mirror.
    setInventory({ lives: player.life });
  }
}

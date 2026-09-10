import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { useGameStore } from '../stores/useGameStore';
import { getDifficultySettings } from '../utils/GameSettings';
import { startLevelAttempt } from '../levels/startLevelAttempt';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObject } from '../entities/GameObject';
import { getInventory, setInventory } from '../entities/components/InventoryComponent';

test('difficulty selection writes the setting consumed by the engine, not only React config', () => {
  const source = readFileSync(new URL('./DifficultyMenu.tsx', import.meta.url), 'utf8');
  expect(source.includes("setSetting('difficulty', option.id)")).toBe(true);
});

test('each selected difficulty supplies its health and power-up threshold to gameplay', () => {
  const saved = useGameStore.getState();
  const inventory = getInventory();
  try {
    for (const [difficulty, life, coins] of [['baby', 5, 15], ['kids', 3, 20], ['adults', 2, 30]] as const) {
      useGameStore.setState({ progress: { ...saved.progress, levels: {} } });
      useGameStore.getState().setSetting('difficulty', difficulty);
      const settings = getDifficultySettings();
      const manager = new GameObjectManager();
      const player = new GameObject();
      manager.setPlayer(player);
      startLevelAttempt(2, manager, settings);
      expect(player.maxLife).toBe(life);
      expect(player.life).toBe(life);
      expect(settings.coinsPerPowerup).toBe(coins);
      expect(useGameStore.getState().settings.difficulty).toBe(difficulty);
    }
  } finally {
    useGameStore.setState({ settings: saved.settings, progress: saved.progress });
    setInventory(inventory);
  }
});

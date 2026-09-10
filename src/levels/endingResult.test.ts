import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { useGameStore } from '../stores/useGameStore';
import { createEndingStats } from './endingResult';
import { recordLevelResult } from './levelResult';
import { getInventory, setInventory } from '../entities/components/InventoryComponent';
import { GameObject } from '../entities/GameObject';
import { resolveEnemyDeath } from '../entities/resolveEnemyDeath';
import { SystemRegistry } from '../engine/SystemRegistry';

test('second campaign ending excludes previous playthrough totals but retains lifetime records', () => {
  const saved = useGameStore.getState();
  const inventory = getInventory();
  try {
    saved.startNewCampaign('story');
    useGameStore.getState().addToTotalStats({ totalPlayTime: 5000, totalScore: 80000,
      totalDeaths: 40, totalCoinsCollected: 900, totalRubiesCollected: 60,
      totalEnemiesDefeated: 300, gamesCompleted: 1 });
    const oldTotals = useGameStore.getState().progress.totalStats;
    useGameStore.getState().startNewCampaign('linear');
    expect(useGameStore.getState().progress.campaignStats.totalScore).toBe(0);
    setInventory({ score: 10, lives: 3, coinCount: 7, rubyCount: 2 });
    useGameStore.getState().recordLevelAttempt(2);
    useGameStore.getState().addToTotalStats({ totalDeaths: 2 });
    const enemy = new GameObject();
    enemy.type = 'enemy'; enemy.subType = 'snailbomb'; enemy.life = 0;
    const registry = new SystemRegistry();
    expect(resolveEnemyDeath(enemy, registry)).toBe(true);
    expect(resolveEnemyDeath(enemy, registry)).toBe(false); // death cannot count twice
    expect(useGameStore.getState().progress.campaignStats.totalEnemiesDefeated).toBe(0);
    // The death resolver adds 25 to the live score before the result commits.
    recordLevelResult(2, getInventory(), 65);
    const progress = useGameStore.getState().progress;
    const stats = createEndingStats(progress, 'good');
    expect(stats).toEqual({ totalPlayTime: 65, totalScore: 3035, totalDeaths: 2,
      totalCoinsCollected: 7, totalRubiesCollected: 2, totalEnemiesDefeated: 1,
      diariesCollected: progress.diariesCollected.length, ending: 'good', partialHistory: false });
    expect(progress.totalStats.totalScore).toBe(oldTotals.totalScore + 3035);
    expect(progress.totalStats.totalEnemiesDefeated).toBe(oldTotals.totalEnemiesDefeated + 1);
    expect(progress.totalStats.totalDeaths).toBe(oldTotals.totalDeaths + 2);
    expect(progress.totalStats.gamesCompleted).toBe(oldTotals.gamesCompleted);
  } finally {
    useGameStore.setState(saved);
    setInventory(inventory);
  }
});

test('all ending types snapshot campaign scope and disclose incomplete migrated history', () => {
  const progress = useGameStore.getInitialState().progress;
  for (const ending of ['good', 'bad', 'neutral'] as const) {
    const stats = createEndingStats({ ...progress, campaignStatsPartial: true }, ending);
    expect(stats.partialHistory).toBe(true);
    expect(stats.ending).toBe(ending);
    expect(stats.totalPlayTime).toBe(0);
  }
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source).toContain('canvasEndingStats.show(createEndingStats(gameState.progress, endingType)');
});

import { expect, test } from 'bun:test';
import { useGameStore, DifficultySettings } from '../stores/useGameStore';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { GameObject } from '../entities/GameObject';
import { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { getInventory, setInventory } from '../entities/components/InventoryComponent';
import { SystemRegistry } from '../engine/SystemRegistry';
import { HitType } from '../types';
import { resolveEnemyDeath } from '../entities/resolveEnemyDeath';
import { startLevelAttempt } from './startLevelAttempt';
import { recordLevelResult } from './levelResult';

test('real enemy deaths from a failed attempt stay lifetime-only; successful attempt commits once', () => {
  const saved = useGameStore.getState(), inventory = getInventory();
  try {
    saved.startNewCampaign('story');
    const lifetimeBefore = useGameStore.getState().progress.totalStats.totalEnemiesDefeated;
    const manager = new GameObjectManager();
    const registry = new SystemRegistry();
    const factory = new GameObjectFactory(manager);
    factory.setSystemRegistry(registry);
    registry.gameObjectFactory = factory;
    const hitSource = new GameObject();
    const defeat = (): void => {
      const enemy = factory.spawn(GameObjectType.ENEMY_SNAILBOMB, 0, 0)!;
      const reaction = enemy.getComponents().find(
        (component): component is HitReactionComponent => component instanceof HitReactionComponent
      )!;
      reaction.receivedHit(enemy, hitSource, HitType.HIT);
      expect(enemy.life).toBe(0);
      expect(resolveEnemyDeath(enemy, registry)).toBe(true);
      expect(resolveEnemyDeath(enemy, registry)).toBe(false);
    };
    startLevelAttempt(2, manager, DifficultySettings.kids);
    defeat(); defeat();
    expect(useGameStore.getState().activeAttempt?.enemiesDefeated).toBe(2);
    expect(useGameStore.getState().progress.campaignStats.totalEnemiesDefeated).toBe(0);
    // This is the same successful-load hook used by automatic death retry.
    startLevelAttempt(2, manager, DifficultySettings.kids);
    expect(useGameStore.getState().activeAttempt?.enemiesDefeated).toBe(0);
    defeat();
    recordLevelResult(2, getInventory(), 30);
    expect(useGameStore.getState().activeAttempt).toBeNull();
    expect(useGameStore.getState().progress.campaignStats.totalEnemiesDefeated).toBe(1);
    expect(useGameStore.getState().progress.totalStats.totalEnemiesDefeated).toBe(lifetimeBefore + 3);
    // Even an accidental duplicate completion cannot commit the kills twice.
    useGameStore.getState().completeLevel(2, 0, 0);
    expect(useGameStore.getState().progress.campaignStats.totalEnemiesDefeated).toBe(1);
    startLevelAttempt(3, manager, DifficultySettings.kids);
    defeat();
    expect(useGameStore.getState().activeAttempt?.enemiesDefeated).toBe(1);
    expect(useGameStore.getState().progress.campaignStats.totalEnemiesDefeated).toBe(1);
  } finally {
    useGameStore.setState(saved);
    setInventory(inventory);
  }
});

test('completion of another level cannot commit pending kills; new campaign and resets discard them', () => {
  const saved = useGameStore.getState();
  try {
    for (const reset of ['startNewCampaign', 'resetAllProgress', 'resetEverything'] as const) {
      useGameStore.getState().startNewCampaign('story');
      useGameStore.getState().recordLevelAttempt(3);
      useGameStore.getState().recordEnemyDefeat();
      useGameStore.getState().completeLevel(2, 0, 0);
      expect(useGameStore.getState().progress.campaignStats.totalEnemiesDefeated).toBe(0);
      expect(useGameStore.getState().activeAttempt).toEqual({ levelId: 3, enemiesDefeated: 1 });
      if (reset === 'startNewCampaign') useGameStore.getState().startNewCampaign('linear');
      else useGameStore.getState()[reset]();
      expect(useGameStore.getState().activeAttempt).toBeNull();
    }
  } finally {
    useGameStore.setState(saved);
  }
});

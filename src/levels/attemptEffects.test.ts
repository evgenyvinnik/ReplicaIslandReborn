import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameObjectManager } from '../entities/GameObjectManager';
import { EffectsSystem, EffectType } from '../engine/EffectsSystem';
import { DifficultySettings, useGameStore } from '../stores/useGameStore';
import { startLevelAttempt } from './startLevelAttempt';

test('a new attempt discards previous-level visual effects and keeps the pool reusable', () => {
  const saved = useGameStore.getState();
  try {
    const effects = new EffectsSystem();
    effects.spawn(EffectType.SMOKE_SMALL, 100, 100);
    effects.spawn(EffectType.SPARK, 200, 200);
    expect(effects.getActiveCount()).toBe(2);

    startLevelAttempt(2, new GameObjectManager(), DifficultySettings.kids, effects);
    expect(effects.getActiveCount()).toBe(0);
    effects.spawn(EffectType.DUST, 300, 300);
    expect(effects.getActiveCount()).toBe(1);
  } finally {
    useGameStore.setState(saved);
  }
});

test('every successful Game load passes its effect pool to shared attempt setup', () => {
  const source = readFileSync(join(import.meta.dir, '../components/Game.tsx'), 'utf8');
  expect(source).toContain('startLevelAttempt(levelId, gameObjectManager, getDifficultySettings(), effectsSystemRef.current);');
});

test('every successful level attempt samples the new player after assistance', () => {
  const source = readFileSync(join(import.meta.dir, '../components/Game.tsx'), 'utf8');
  const setup = source.slice(source.indexOf('const beginLevelAttempt ='), source.indexOf('const [isInitialized'));
  expect(setup).toMatch(/startLevelAttempt\(levelId,[^;]+;\s*(?:\/\/[^\n]*\n\s*)*lastPlayerLifeRef\.current = gameObjectManager\.getPlayer\(\)\?\.life \?\? -1;/);
  expect(source).not.toContain('let lastPlayerLife = -1;');
});

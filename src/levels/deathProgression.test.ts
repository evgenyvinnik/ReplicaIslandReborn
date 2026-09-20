import { afterAll, beforeAll, expect, test } from 'bun:test';
import { file } from 'bun';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LevelSystem } from './LevelSystemNew';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { GameObjectManager } from '../entities/GameObjectManager';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { useGameStore } from '../stores/useGameStore';

const originalFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
    const asset = file(join(import.meta.dir, '../../public', path.replace(/^\//, '')));
    return await asset.exists() ? new Response(await asset.arrayBuffer()) : new Response(null, { status: 404 });
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });

test.each([false, true])('Kyle death advances while ordinary levels retry (linear: %s)', async linear => {
  const saved = useGameStore.getState();
  try {
    sSystemRegistry.reset();
    const manager = new GameObjectManager();
    const levels = new LevelSystem();
    levels.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
    levels.setLinearMode(linear);
    expect(await levels.loadLevel(42)).toBe(true);
    manager.commitUpdates();
    expect(manager.getPlayer()).not.toBeNull(); // This is playable, not an NPC-only scene.
    expect(levels.shouldRestartOnDeath()).toBe(false);
    expect(levels.completeCurrentLevel()).toBe(43);
    for (const id of [2, 26, 41]) {
      expect(await levels.loadLevel(id)).toBe(true);
      expect(levels.shouldRestartOnDeath()).toBe(true);
    }
  } finally {
    useGameStore.setState(saved);
    sSystemRegistry.reset();
  }
});

test('the completed player death fade consults level policy before reloading', () => {
  const game = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  const start = game.indexOf('if (pComp.advanceDeath(');
  const retry = game.indexOf('levelSys.loadLevel(currentLevelRef.current)', start);
  const branch = game.slice(start, retry);
  expect(branch).toContain('!levelSys.shouldRestartOnDeath()');
  expect(branch).toMatch(/postImmediate\(GameFlowEventType.GO_TO_NEXT_LEVEL, 0\);\s*return;/);
});

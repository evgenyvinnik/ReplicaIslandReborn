import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gameSource = readFileSync(join(import.meta.dir, 'Game.tsx'), 'utf8');

test('a pending level load stops simulation immediately, before React renders', () => {
  expect(gameSource).toContain('levelLoadingRef.current = loading;');
  expect(gameSource).toContain('setLevelLoadingState(loading);');
  expect(gameSource).toContain('gameStateRef.current !== GameState.PLAYING || deathReloadInProgress || levelLoadingRef.current');
  expect(gameSource).toMatch(/gameFlowEvent\.update\(\);\s+if \(levelLoadingRef\.current\) return;/);
  expect(gameSource).not.toContain('setLevelLoading(true);');
  expect(gameSource).not.toContain('setLevelLoading(false);');
});

test('startup presents a wait state and optional music follows the playable loop', () => {
  expect(gameSource).toContain('{levelLoading && !startupError && !runtimeError && <LoadingScreen overlay />}');
  expect(gameSource).toContain('await soundSystem.preloadSoundEffects(signal);');
  expect(gameSource).not.toContain('await soundSystem.preloadAllSounds(signal);');
  expect(gameSource.indexOf('gameLoop.start();')).toBeLessThan(
    gameSource.indexOf('soundSystem.preloadBackgroundMusic(signal)')
  );
});

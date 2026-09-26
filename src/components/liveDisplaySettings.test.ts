import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gameSource = readFileSync(join(import.meta.dir, 'Game.tsx'), 'utf8');

test('display toggles apply to the current engine without restarting the level', () => {
  const initialization = gameSource.slice(gameSource.indexOf('// Initialize game systems'));
  const dependencies = initialization.match(/\}, \[width, height, ([^\]]+)\]\);/);
  expect(dependencies).not.toBeNull();
  expect(dependencies?.[1]).not.toContain('currentSettings.showFPS');
  expect(dependencies?.[1]).not.toContain('currentSettings.onScreenControlsEnabled');

  expect(initialization).toContain("canvasHUD.setShowFPS(gameSettings.get('showFPS'));");
  expect(initialization).toContain("canvasControls && gameSettings.get('onScreenControlsEnabled')");
  expect(gameSource).toContain('currentSettings.onScreenControlsEnabled, isInitialized, levelLoading');
});

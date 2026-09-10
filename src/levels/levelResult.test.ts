import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { calculateLevelScore, recordLevelResult } from './levelResult';
import { getInventory, setInventory } from '../entities/components/InventoryComponent';
import { useGameStore } from '../stores/useGameStore';
import { CanvasLevelCompleteScreen } from '../engine/CanvasLevelCompleteScreen';

test('Continue cannot record the loading destination as another completed level', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  const completion = source.slice(source.indexOf('// Handle Canvas Level Complete Screen'),
    source.indexOf('// Attach/detach Canvas Controls'));
  // Continue sets the destination before its async load finishes. React is
  // still in LEVEL_COMPLETE during that render, so the latch is for the
  // entire results episode, not equality with the now-changed level ID.
  expect(completion.includes('levelCompleteProcessedRef.current === state.currentLevel')).toBe(false);
  expect(completion.includes('if (levelCompleteProcessedRef.current !== null)')).toBe(true);
  expect(completion.includes('state.gameState === GameState.PLAYING')).toBe(true);
  expect(completion.includes('levelCompleteProcessedRef.current = null')).toBe(true);
});

test('displayed final scores, saved records and totals agree across worse, tied and better replays', () => {
  const saved = useGameStore.getState();
  const oldInventory = getInventory();
  const originalWindow = globalThis.window;
  globalThis.window = new globalThis.EventTarget() as unknown as typeof window;
  const canvas = new globalThis.EventTarget();
  const labels: string[] = [];
  const textY = new Map<string, number>();
  const context = new Proxy({ fillText: (text: string, _x: number, y: number): void => { labels.push(text); textY.set(text, y); } }, {
    get: (target, key): unknown => Reflect.get(target, key) ?? ((): void => {}),
  });
  const screen = new CanvasLevelCompleteScreen(context as unknown as CanvasRenderingContext2D, canvas as HTMLCanvasElement, 480, 320);
  useGameStore.setState({ progress: { ...saved.progress, levels: {}, totalStats: { ...saved.progress.totalStats, totalScore: 0 } }, highScores: [] });
  try {
    for (const [lives, high, best] of [[3, true, 3009], [2, false, 3009], [3, false, 3009], [4, true, 4009]] as const) {
      setInventory({ score: 9, lives, coinCount: 17, rubyCount: 3 });
      const inventory = getInventory();
      const previous = recordLevelResult(2, inventory, 30);
      const { finalScore } = calculateLevelScore(inventory);
      screen.show('Memory #001', () => {}, () => {}, previous);
      screen.update(3);
      labels.length = 0;
      screen.render();
      expect(labels).toContain(finalScore.toLocaleString());
      expect(textY.get(finalScore.toLocaleString())! + 11).toBeLessThanOrEqual(232); // above Continue at y240
      expect(labels.includes('NEW HIGH!')).toBe(high);
      expect(useGameStore.getState().progress.levels[2].bestScore).toBe(best);
      expect(useGameStore.getState().highScores.some(entry => entry.score === finalScore)).toBe(true);
      screen.hide();
    }
    expect(useGameStore.getState().progress.totalStats.totalScore).toBe(12036);
    expect(useGameStore.getState().progress.levels[2].timesCompleted).toBe(4);
    expect(getInventory().score).toBe(9); // bonus is not added to the live inventory again
  } finally {
    screen.hide();
    setInventory(oldInventory);
    useGameStore.setState({ progress: saved.progress, highScores: saved.highScores });
    globalThis.window = originalWindow;
  }
});

test('Game records results through the shared path instead of persisting the base score', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source.includes('recordLevelResult(state.currentLevel, inventory, elapsedTime)')).toBe(true);
  expect(source.includes('storeCompleteLevel(state.currentLevel, inventory.score, elapsedTime)')).toBe(false);
});

/** Isolated process: no test or game action can reach a real browser save. */
import assert from 'node:assert/strict';
import { createJSONStorage } from 'zustand/middleware';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => { values.set(key, value); },
    removeItem: (key: string): void => { values.delete(key); },
  };
}

const browserStorage = memoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: browserStorage });
const { useGameStore: store } = await import('../src/stores/useGameStore');
const configuredStorage = memoryStorage();
const adapter = createJSONStorage(() => configuredStorage)!;
store.persist.setOptions({ storage: adapter });
const key = store.persist.getOptions().name;
browserStorage.setItem(key, 'untouched browser save');
const initial = store.getInitialState();

async function reloadFromStorage(): Promise<void> {
  // Clear only in-memory state. Keep the serialized save untouched so actual
  // Zustand hydration, not assigning a saved object, must restore it.
  store.persist.setOptions({ storage: { ...adapter, setItem: (): void => {} } });
  store.setState(initial);
  store.persist.setOptions({ storage: adapter });
  await store.persist.rehydrate();
}

store.getState().setSetting('difficulty', 'kids');
store.getState().setSetting('soundVolume', 37);
store.getState().recordLevelAttempt(4);
store.getState().collectDiary(4, 1);
store.getState().completeLevel(4, 500, 42);
store.getState().unlockLevel(5);
store.getState().setCurrentLevel(5);
store.getState().unlockExtra('soundTest');
store.getState().addToTotalStats({ totalCoinsCollected: 7 });
assert.ok(configuredStorage.getItem(key));
await reloadFromStorage();
assert.equal(store.getState().progress.currentLevel, 5);
assert.equal(store.getState().progress.levels[4].timesPlayed, 1);
assert.equal(store.getState().progress.levels[4].bestScore, 500);
assert.equal(store.getState().progress.levels[4].bestTime, 42);
assert.equal(store.getState().progress.levels[5].unlocked, true);
assert.deepEqual(store.getState().progress.diariesCollected, [1]);
assert.deepEqual(store.getState().progress.levels[4].diariesCollected, [1]);
assert.equal(store.getState().highScores[0].score, 500);
assert.equal(store.getState().progress.extrasUnlocked.soundTest, true);
assert.equal(store.getState().progress.totalStats.totalCoinsCollected, 7);
assert.equal(store.getState().settings.difficulty, 'kids');
assert.equal(store.getState().settings.soundVolume, 37);

// Progress-only reset preserves preferences and persists erased progress.
store.getState().resetAllProgress();
await reloadFromStorage();
assert.deepEqual(store.getState().progress, initial.progress);
assert.deepEqual(store.getState().highScores, []);
assert.equal(store.getState().settings.soundVolume, 37);

store.getState().recordLevelAttempt(8);
store.getState().collectDiary(8, 2);
// Browser localStorage is not the configured backend. Denied access must not
// break a reset using the working adapter (or delete another backend's data).
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get: (): never => { throw new Error('Browser storage access is forbidden in this test'); },
});
store.getState().resetEverything();
assert.equal(browserStorage.getItem(key), 'untouched browser save');
await reloadFromStorage();
assert.deepEqual(store.getState().settings, initial.settings);
assert.deepEqual(store.getState().progress, initial.progress);
assert.deepEqual(store.getState().highScores, []);

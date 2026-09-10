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

store.getState().startNewCampaign('linear');
const linearStart = store.getState().progress.currentLevel;
assert.notEqual(linearStart, 1); // Chronological mode starts in the lab.
await reloadFromStorage();
assert.equal(store.getState().progress.isLinearMode, true);
assert.equal(store.getState().progress.currentLevel, linearStart);
assert.equal(store.getState().progress.extrasUnlocked.soundTest, true);
store.getState().startNewCampaign('levelSelect');
store.getState().addToTotalStats({ totalPlayTime: 20, totalScore: 50, totalDeaths: 2,
  totalCoinsCollected: 7, totalRubiesCollected: 3, totalEnemiesDefeated: 4 });
await reloadFromStorage();
assert.equal(store.getState().progress.isLinearMode, false);
assert.equal(store.getState().progress.currentLevel, 1);
assert.deepEqual(store.getState().progress.campaignStats, {
  totalPlayTime: 20, totalScore: 50, totalDeaths: 2,
  totalCoinsCollected: 7, totalRubiesCollected: 3, totalEnemiesDefeated: 4,
});
assert.equal(store.getState().progress.campaignStatsPartial, false);

// Version 3 had no persisted mode. Upgrade it to story without erasing saves.
const legacy = JSON.parse(configuredStorage.getItem(key)!);
legacy.version = 3;
delete legacy.state.progress.isLinearMode;
delete legacy.state.progress.campaignStats;
delete legacy.state.progress.campaignStatsPartial;
legacy.state.progress.currentLevel = 5;
configuredStorage.setItem(key, JSON.stringify(legacy));
await reloadFromStorage();
assert.equal(store.getState().progress.isLinearMode, false);
assert.equal(store.getState().progress.currentLevel, 5);
assert.equal(store.getState().progress.extrasUnlocked.soundTest, true);
assert.equal(store.getState().settings.soundVolume, 37);
assert.equal(store.getState().progress.campaignStatsPartial, true);
assert.equal(store.getState().progress.campaignStats.totalScore, 0);
assert.equal(store.getState().progress.totalStats.totalScore, 50);
store.getState().addToTotalStats({ totalScore: 9 });
await reloadFromStorage();
assert.equal(store.getState().progress.campaignStats.totalScore, 9);
assert.equal(store.getState().progress.campaignStatsPartial, true);
assert.equal(store.getState().progress.totalStats.totalScore, 59);

store.getState().recordLevelAttempt(2);
const lifetimeKills = store.getState().progress.totalStats.totalEnemiesDefeated;
store.getState().recordEnemyDefeat();
assert.equal(store.getState().activeAttempt?.enemiesDefeated, 1);
assert.equal(JSON.parse(configuredStorage.getItem(key)!).state.activeAttempt, undefined);
await reloadFromStorage();
assert.equal(store.getState().activeAttempt, null);
assert.equal(store.getState().progress.totalStats.totalEnemiesDefeated, lifetimeKills + 1);
store.getState().recordLevelAttempt(2);
store.getState().recordEnemyDefeat();
store.getState().completeLevel(2, 0, 0);
const campaignKills = store.getState().progress.campaignStats.totalEnemiesDefeated;
await reloadFromStorage();
assert.equal(store.getState().progress.campaignStats.totalEnemiesDefeated, campaignKills);
assert.equal(store.getState().progress.totalStats.totalEnemiesDefeated, lifetimeKills + 2);
store.getState().startNewCampaign('story');
await reloadFromStorage();
assert.equal(store.getState().progress.campaignStats.totalScore, 0);
assert.equal(store.getState().progress.campaignStatsPartial, false);
assert.equal(store.getState().progress.totalStats.totalScore, 59);

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

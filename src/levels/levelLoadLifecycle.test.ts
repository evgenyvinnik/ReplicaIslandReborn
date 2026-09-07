import { afterEach, beforeEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObjectManager } from '../entities/GameObjectManager';
import { resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { useGameStore } from '../stores/useGameStore';
import { collectNextDiary } from '../stores/diaryProgress';

const originalFetch = globalThis.fetch;
const originalProgress = useGameStore.getState().progress;

async function assetResponse(input: Parameters<typeof fetch>[0]): Promise<Response> {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
  const asset = file(join(import.meta.dir, '../../public', path.replace(/^\//, '')));
  return new Response(await asset.arrayBuffer());
}

beforeEach(() => {
  sSystemRegistry.reset();
  globalThis.fetch = assetResponse as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  sSystemRegistry.reset();
  useGameStore.setState({ progress: originalProgress });
});

function rig(): { level: LevelSystem; manager: GameObjectManager } {
  const level = new LevelSystem();
  const manager = new GameObjectManager();
  level.setSystems(new CollisionSystem(), manager);
  sSystemRegistry.register(manager, 'gameObject');
  return { level, manager };
}

test.each(['abort', 'supersede', 'dispose'])('a stale load cannot replace the new level after %s', async (mode) => {
  const { level, manager } = rig();
  let resume = (): void => {};
  let requested = (): void => {};
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  const started = new Promise<void>((resolve) => { requested = resolve; });
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).includes('level_0_2_lab')) {
      requested();
      await gate;
    }
    return assetResponse(input);
  }) as typeof fetch;
  const oldRun = new globalThis.AbortController();
  const oldLoad = level.loadLevel(resourceToLevelId.level_0_2_lab, oldRun.signal);
  await started;
  if (mode === 'abort') oldRun.abort();
  if (mode === 'dispose') level.dispose();
  const replacement = mode === 'dispose' ? rig() : { level, manager };
  expect(await replacement.level.loadLevel(resourceToLevelId.level_3_3_sewer)).toBe(true);
  replacement.manager.commitUpdates();
  const newLevel = replacement.level.getParsedLevel();
  const newActors = [...replacement.manager.getActiveObjects()];
  resume();
  expect(await oldLoad).toBe(false);
  replacement.manager.commitUpdates();
  expect(replacement.level.getParsedLevel()).toBe(newLevel);
  expect(replacement.manager.getActiveObjects()).toEqual(newActors);
  if (mode === 'dispose') {
    manager.commitUpdates();
    expect(manager.getActiveObjects()).toHaveLength(0);
    expect(await level.loadLevel(resourceToLevelId.level_0_2_lab)).toBe(false);
  }
});

test('an already cancelled load does not fetch or populate a level', async () => {
  const { level, manager } = rig();
  let requests = 0;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    requests++;
    return assetResponse(input);
  }) as typeof fetch;
  const run = new globalThis.AbortController();
  run.abort();
  expect(await level.loadLevel(resourceToLevelId.level_0_2_lab, run.signal)).toBe(false);
  expect(requests).toBe(0);
  expect(manager.getActiveObjects()).toHaveLength(0);
});

test('saved campaign diaries disappear on replay while later levels award the next log', async () => {
  useGameStore.setState({ progress: { ...originalProgress, levels: {}, diariesCollected: [] } });
  let checked = 0;
  for (const { id: levelId } of new LevelSystem().getAllLevels()) {
    const { level, manager } = rig();
    level.setDiaryCollectedQuery((id) =>
      (useGameStore.getState().progress.levels[id]?.diariesCollected.length ?? 0) > 0);
    expect(await level.loadLevel(levelId), `level ${levelId}`).toBe(true);
    manager.commitUpdates();
    if (!manager.getActiveObjects().some((object) => object.type === 'diary')) continue;
    checked++;
    expect(collectNextDiary(levelId)?.id).toBe(checked);
    manager.reset();
    expect(await level.loadLevel(levelId)).toBe(true);
    manager.commitUpdates();
    expect(manager.getActiveObjects().some((object) => object.type === 'diary')).toBe(false);
    if (checked === 3) break;
  }
  expect(checked).toBe(3);
  expect(useGameStore.getState().progress.diariesCollected).toEqual([1, 2, 3]);
});

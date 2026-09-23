import { afterEach, beforeEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObjectManager } from '../entities/GameObjectManager';
import { DynamicCollisionComponent } from '../entities/components/DynamicCollisionComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { createPlayerVolumeSets } from '../entities/playerCollisionVolumes';
import { resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { useGameStore } from '../stores/useGameStore';
import { collectLevelDiary } from '../stores/diaryProgress';

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

test('all placed campaign diaries award their own log and disappear on replay', async () => {
  useGameStore.setState({ progress: { ...originalProgress, levels: {}, diariesCollected: [] } });
  let checked = 0;
  // The original island 1_3 binary omits its assigned Diary 2 pickup. The web
  // loader supplies one explicit repair so every authored log is obtainable.
  const bindings = [[4, 1], [6, 2], [8, 4], [11, 14], [14, 5], [16, 8], [17, 10],
    [19, 11], [20, 15], [24, 12], [28, 3], [30, 6], [33, 7], [34, 9], [38, 13]];
  for (const [levelId, diaryId] of bindings) {
    const { level, manager } = rig();
    level.setDiaryCollectedQuery((id) =>
      (useGameStore.getState().progress.levels[id]?.diariesCollected.length ?? 0) > 0);
    expect(await level.loadLevel(levelId), `level ${levelId}`).toBe(true);
    manager.commitUpdates();
    expect(manager.getActiveObjects().filter((object) => object.type === 'diary'), `level ${levelId}`).toHaveLength(1);
    checked++;
    expect(collectLevelDiary(levelId)?.id).toBe(diaryId);
    manager.reset();
    expect(await level.loadLevel(levelId)).toBe(true);
    manager.commitUpdates();
    expect(manager.getActiveObjects().some((object) => object.type === 'diary')).toBe(false);
    level.dispose();
  }
  expect(checked).toBe(15);
  expect(useGameStore.getState().progress.diariesCollected).toEqual(bindings.map(([, diaryId]) => diaryId));
});

test('the repaired Memory #005 diary is reachable and uses normal pickup collision', async () => {
  const { level, manager } = rig();
  const collisions = new GameObjectCollisionSystem();
  sSystemRegistry.register(collisions, 'gameObjectCollision');
  expect(await level.loadLevel(resourceToLevelId.level_1_3_island)).toBe(true);
  manager.commitUpdates();
  const diary = manager.getActiveObjects().find((object) => object.type === 'diary')!;
  const player = manager.getPlayer()!;
  expect(diary).toBeDefined();
  expect(diary.getPosition().x - player.getPosition().x).toBe(64);
  expect(diary.getPosition().y - player.getPosition().y).toBe(-16);
  expect(diary.getComponent(SpriteComponent)?.getCurrentDraw()?.sprite).toBe('diary01');

  // Walking two tiles right from the authored spawn places Andou's body and
  // COLLECT volume over the repaired pickup; no special collection path exists.
  player.setPosition(diary.getPosition().x, player.getPosition().y);
  const playerCollision = player.getComponent(DynamicCollisionComponent)!;
  const volumes = createPlayerVolumeSets().normal;
  playerCollision.setCollisionVolumes(volumes.attack, volumes.vulnerability);
  expect(diary.getComponent(DynamicCollisionComponent)!.getVulnerabilityVolumes()?.length).toBeGreaterThan(0);
  playerCollision.update(0, player);
  diary.getComponent(DynamicCollisionComponent)!.update(0, diary);
  collisions.update(0);
  expect(diary.life).toBe(0);
});

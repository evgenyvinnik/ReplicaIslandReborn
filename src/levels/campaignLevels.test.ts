import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory } from '../entities/GameObjectFactory';
import { TimeSystem } from '../engine/TimeSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { linearLevelTree, resourceToLevelId } from '../data/levelTree';
import { LevelSystem } from './LevelSystemNew';
import { Team } from '../types';
import { ActionType } from '../types';
import { LaunchProjectileComponent } from '../entities/components/LaunchProjectileComponent';

const originalFetch = globalThis.fetch;
const publicDirectory = join(import.meta.dir, '../../public');

beforeAll(() => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.pathname
        : new URL(input.url).pathname;
    const pathname = rawUrl.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    const requestedFile = file(join(publicDirectory, pathname));
    if (!(await requestedFile.exists())) {
      return new Response(null, { status: 404 });
    }
    return new Response(await requestedFile.arrayBuffer(), { status: 200 });
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('shipped campaign levels', () => {
  test('every story level parses and instantiates its expected player state', async () => {
    const levelSystem = new LevelSystem();
    const manager = new GameObjectManager();
    levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());

    for (const group of linearLevelTree) {
      for (const entry of group.levels) {
        const levelId = resourceToLevelId[entry.resource];
        expect(levelId, `missing id for ${entry.resource}`).toBeNumber();
        expect(await levelSystem.loadLevel(levelId), entry.resource).toBe(true);
        manager.commitUpdates();

        const source = await file(
          join(publicDirectory, `assets/levels/${entry.resource}.json`)
        ).json() as {
          layers: Array<{ type: string; world: { tiles: number[][] } }>;
        };
        const hasPlayer = source.layers
          .find((layer) => layer.type === 'objects')
          ?.world.tiles.some((row) => row.includes(0)) ?? false;

        expect(Boolean(manager.getPlayer()), `${entry.resource} player spawn`).toBe(hasPlayer);
        expect(levelSystem.getParsedLevel(), `${entry.resource} parsed data`).not.toBeNull();
      }
    }
  });

  test('the shipped Shadow Slime encounter launches its energy attack', async () => {
    const levelSystem = new LevelSystem();
    const manager = new GameObjectManager();
    const factory = new GameObjectFactory(manager);
    const time = new TimeSystem();
    levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
    sSystemRegistry.gameObjectManager = manager;
    sSystemRegistry.gameObjectFactory = factory;
    sSystemRegistry.timeSystem = time;

    try {
      expect(await levelSystem.loadLevel(resourceToLevelId.level_2_2_grass)).toBe(true);
      manager.commitUpdates();
      const shadowSlime = manager.getActiveObjects().find(
        (object) => object.subType === 'shadowslime'
      );
      const player = manager.getPlayer();
      if (!shadowSlime || !player) throw new Error('Expected Shadow Slime encounter');
      player.setPosition(shadowSlime.getPosition());

      for (const delta of [0.1, 2.1, 0.01, 0.5]) {
        time.update(delta);
        manager.update(delta, time.getGameTime());
      }
      manager.commitUpdates();

      expect(manager.getActiveObjects().some(
        (object) => object.type === 'projectile' && object.subType === 'energy_ball'
      )).toBe(true);
    } finally {
      sSystemRegistry.reset();
    }
  });

  test('shipped flying enemies start their patrol instead of remaining frozen', async () => {
    const levelSystem = new LevelSystem();
    const manager = new GameObjectManager();
    levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());

    const cases = [
      { resource: 'level_3_4_sewer', subType: 'bat', speed: 75 },
      { resource: 'level_2_2_grass', subType: 'sting', speed: 25 },
      { resource: 'level_2_2_grass', subType: 'karaguin', speed: 50 },
    ] as const;

    for (const enemyCase of cases) {
      expect(await levelSystem.loadLevel(resourceToLevelId[enemyCase.resource])).toBe(true);
      manager.commitUpdates();
      const enemy = manager.getActiveObjects().find(
        (object) => object.subType === enemyCase.subType
      );
      if (!enemy) throw new Error(`Expected ${enemyCase.subType} in ${enemyCase.resource}`);
      expect(enemy.getVelocity().x).toBe(enemyCase.speed);
      expect(enemy.getTargetVelocity().x).toBe(enemyCase.speed);
    }
  });

  test('story characters preserve their original facing, team, and body size', async () => {
    const levelSystem = new LevelSystem();
    const manager = new GameObjectManager();
    levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());

    const cases = [
      { resource: 'level_1_1_island', subType: 'wanda', team: Team.ENEMY },
      { resource: 'level_2_1_grass', subType: 'kyle', team: Team.NONE },
      { resource: 'level_0_2_lab', subType: 'kabocha', team: Team.ENEMY },
      { resource: 'level_final_boss_lab', subType: 'evil_kabocha', team: Team.ENEMY },
      { resource: 'level_final_boss_lab', subType: 'rokudou', team: Team.ENEMY },
    ] as const;

    for (const characterCase of cases) {
      expect(await levelSystem.loadLevel(resourceToLevelId[characterCase.resource])).toBe(true);
      manager.commitUpdates();
      const character = manager.getActiveObjects().find(
        (object) => object.subType === characterCase.subType
      );
      if (!character) {
        throw new Error(`Expected ${characterCase.subType} in ${characterCase.resource}`);
      }
      expect(character.facingDirection.x).toBe(-1);
      expect(character.team).toBe(characterCase.team);
    }

    expect(await levelSystem.loadLevel(resourceToLevelId.level_4_1_underground)).toBe(true);
    manager.commitUpdates();
    const kyleDead = manager.getActiveObjects().find(
      (object) => object.subType === 'kyle_dead'
    );
    if (!kyleDead) throw new Error('Expected Kyle body in level_4_1_underground');
    expect(kyleDead.width).toBe(128);
    expect(kyleDead.height).toBe(32);
  });

  test('shipped Brobot machines track one launch and recharge after its removal', async () => {
    const levelSystem = new LevelSystem();
    const manager = new GameObjectManager();
    const factory = new GameObjectFactory(manager);
    const time = new TimeSystem();
    levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
    sSystemRegistry.gameObjectManager = manager;
    sSystemRegistry.gameObjectFactory = factory;
    sSystemRegistry.timeSystem = time;

    try {
      expect(await levelSystem.loadLevel(resourceToLevelId.level_0_3_lab)).toBe(true);
      manager.commitUpdates();
      const spawners = manager.getActiveObjects().filter(
        (object) => object.subType === 'brobot_spawner'
      );
      expect(spawners).toHaveLength(2);
      expect(spawners.map((object) => object.facingDirection.x).sort()).toEqual([-1, 1]);
      expect(spawners.every((object) => object.team === Team.ENEMY)).toBe(true);

      const launchers = spawners.map((spawner) => spawner.getComponent(
        LaunchProjectileComponent as unknown as new (...args: unknown[]) => LaunchProjectileComponent
      ));
      if (launchers.some((launcher) => launcher === null)) {
        throw new Error('Expected both Brobot machine launchers');
      }

      for (const launcher of launchers) launcher?.update(0, spawners[launchers.indexOf(launcher)]);
      time.update(2.99);
      for (let index = 0; index < launchers.length; index++) {
        launchers[index]?.update(2.99, spawners[index]);
      }
      manager.commitUpdates();
      expect(manager.getActiveObjects().filter(
        (object) => object.subType === 'brobot' && object.getVelocity().y === -300
      )).toHaveLength(0);

      time.update(0.02);
      for (let index = 0; index < launchers.length; index++) {
        launchers[index]?.update(0.02, spawners[index]);
      }
      manager.commitUpdates();
      let launched = manager.getActiveObjects().filter(
        (object) => object.subType === 'brobot' && object.getVelocity().y === -300
      );
      expect(launched).toHaveLength(2);
      expect(launched.map((object) => object.getVelocity().x).sort((a, b) => a - b)).toEqual([-100, 100]);

      time.update(10);
      for (let index = 0; index < launchers.length; index++) {
        launchers[index]?.update(10, spawners[index]);
      }
      manager.commitUpdates();
      launched = manager.getActiveObjects().filter(
        (object) => object.subType === 'brobot' && object.getVelocity().y === -300
      );
      expect(launched).toHaveLength(2);

      const rightLaunch = launched.find((object) => object.getVelocity().x > 0);
      if (!rightLaunch) throw new Error('Expected right-moving launched Brobot');
      manager.remove(rightLaunch);
      manager.commitUpdates();
      const rightSpawnerIndex = spawners.findIndex((object) => object.facingDirection.x > 0);
      launchers[rightSpawnerIndex]?.update(0, spawners[rightSpawnerIndex]);
      time.update(3.01);
      launchers[rightSpawnerIndex]?.update(3.01, spawners[rightSpawnerIndex]);
      manager.commitUpdates();
      expect(manager.getActiveObjects().filter(
        (object) => object.subType === 'brobot' && object.getVelocity().y === -300
      )).toHaveLength(2);
    } finally {
      sSystemRegistry.reset();
    }
  });

  test('shipped turrets fire down into Canvas space', async () => {
    const levelSystem = new LevelSystem();
    const manager = new GameObjectManager();
    const factory = new GameObjectFactory(manager);
    const time = new TimeSystem();
    levelSystem.setSystems(new CollisionSystem(), manager, new HotSpotSystem());
    sSystemRegistry.gameObjectManager = manager;
    sSystemRegistry.gameObjectFactory = factory;
    sSystemRegistry.timeSystem = time;

    try {
      expect(await levelSystem.loadLevel(resourceToLevelId.level_4_4_underground)).toBe(true);
      manager.commitUpdates();
      const turrets = manager.getActiveObjects().filter((object) => object.subType === 'turret');
      expect(turrets.length).toBeGreaterThanOrEqual(2);
      const directions = new Set<number>();
      for (const turret of turrets) {
        const launcher = turret.getComponent(
          LaunchProjectileComponent as unknown as new (...args: unknown[]) => LaunchProjectileComponent
        );
        if (!launcher) throw new Error('Expected turret launcher');
        turret.setCurrentAction(ActionType.ATTACK);
        launcher.update(0, turret);
        directions.add(turret.facingDirection.x);
      }
      manager.commitUpdates();
      const bullets = manager.getActiveObjects().filter(
        (object) => object.subType === 'turret_bullet'
      );
      expect(directions).toEqual(new Set([-1, 1]));
      expect(bullets).toHaveLength(turrets.length);
      expect(bullets.every((bullet) => bullet.getVelocity().y === 300)).toBe(true);
    } finally {
      sSystemRegistry.reset();
    }
  });
});

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { GameObject } from './GameObject';
import { GameObjectManager } from './GameObjectManager';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { resolveEnemyDeath } from './resolveEnemyDeath';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { GhostComponent } from './components/GhostComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { PlayerComponent } from './components/PlayerComponent';
import { getInventory, setInventory } from './components/InventoryComponent';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { HotSpotSystem, HotSpotType } from '../engine/HotSpotSystem';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { sSystemRegistry } from '../engine/SystemRegistry';
import type { SoundSystem } from '../engine/SoundSystem';
import { TimeSystem } from '../engine/TimeSystem';
import type { EffectsSystem } from '../engine/EffectsSystem';
import { HitType, Team } from '../types';
import { useGameStore } from '../stores/useGameStore';
import { readFileSync } from 'node:fs';

let savedStore = useGameStore.getState();
let savedInventory = getInventory();
beforeEach(() => { savedStore = useGameStore.getState(); savedInventory = { ...getInventory() }; });
afterEach(() => {
  sSystemRegistry.reset();
  useGameStore.setState(savedStore);
  setInventory(savedInventory);
});

function setup(): {
  manager: GameObjectManager; factory: GameObjectFactory; collision: GameObjectCollisionSystem;
  player: GameObject; sounds: string[]; flashes: number[];
} {
  sSystemRegistry.reset();
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  const collision = new GameObjectCollisionSystem();
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(factory, 'factory');
  sSystemRegistry.register(collision, 'gameObjectCollision');
  sSystemRegistry.register(new TimeSystem(), 'time');
  factory.setSystemRegistry(sSystemRegistry);
  const sounds: string[] = [], flashes: number[] = [];
  sSystemRegistry.soundSystem = { playSfx: (name: string) => sounds.push(name) } as unknown as SoundSystem;
  sSystemRegistry.effectsSystem = { spawnCrushFlash: () => flashes.push(1) } as unknown as EffectsSystem;
  const player = new GameObject();
  player.type = 'player'; player.team = Team.PLAYER; player.width = player.height = 64; player.life = 3;
  player.setPosition(100, 200);
  player.getVelocity().y = 37;
  player.addComponent(new PlayerComponent());
  manager.setPlayer(player);
  return { manager, factory, collision, player, sounds, flashes };
}

const GhostClass = GhostComponent as unknown as new (...args: unknown[]) => GhostComponent;

for (const kind of [GameObjectType.ENEMY_BROBOT, GameObjectType.ENEMY_SNAILBOMB]) {
  test(`runtime ${kind} dies on a real hazard with one effect and award, not a player stomp`, () => {
    const { manager, factory, player, flashes } = setup();
    const hotSpots = new HotSpotSystem();
    const tiles = Array.from({ length: 20 }, () => Array<number>(20).fill(HotSpotType.NONE));
    tiles[4][7] = HotSpotType.DIE;
    hotSpots.setWorld({ width: 20, height: 20, tiles });
    hotSpots.setLevelDimensions(640, 640);
    sSystemRegistry.register(hotSpots, 'hotSpot');
    const enemy = factory.spawn(kind, 100, 136)!;
    manager.commitUpdates();
    enemy.update(0, 0);
    expect(enemy.life).toBe(1);
    expect(resolveEnemyDeath(enemy)).toBe(false);
    const score = getInventory().score;
    const kills = useGameStore.getState().progress.totalStats.totalEnemiesDefeated;
    enemy.setPosition(100, 200); // Its feet now sample the test grid's single DIE cell.
    enemy.update(0, 0);
    expect(enemy.life).toBe(0);
    expect(enemy.isMarkedForRemoval()).toBe(false);
    expect(resolveEnemyDeath(enemy)).toBe(true);
    expect(resolveEnemyDeath(enemy)).toBe(false);
    manager.commitUpdates();
    const effect = kind === GameObjectType.ENEMY_BROBOT ? 'explosion_giant' : 'smoke_poof';
    expect(manager.getActiveObjects().filter(o => o.subType === effect)).toHaveLength(1);
    expect(getInventory().score).toBe(score + 25);
    expect(useGameStore.getState().progress.totalStats.totalEnemiesDefeated).toBe(kills + 1);
    expect(flashes).toHaveLength(0);
    expect(player.getVelocity().y).toBe(37);
  });
}

test('real orb possession and release detonates a brobot once and can chain into another brobot', () => {
  const { manager, factory, collision, player, flashes } = setup();
  const initialScore = getInventory().score;
  const initialKills = useGameStore.getState().progress.totalStats.totalEnemiesDefeated;
  const first = factory.spawn(GameObjectType.ENEMY_BROBOT, 100, 200)!;
  const orb = factory.spawnGhost(100, 200, 0)!;
  // Submit actual factory possession volumes; no forced component swap.
  first.getComponent(DynamicCollisionComponent)!.update(0, first);
  orb.getComponent(DynamicCollisionComponent)!.update(0, orb);
  collision.update(0);
  const controller = first.getComponent(GhostClass);
  expect(controller).not.toBeNull();
  orb.getComponent(GhostClass)!.transferControl(orb);
  player.getComponent(PlayerComponent)!.ghostActive = true;
  controller!.releaseControl(first);
  controller!.releaseControl(first);
  expect(player.getComponent(PlayerComponent)!.ghostActive).toBe(false);
  expect(first.isMarkedForRemoval()).toBe(true);
  expect(resolveEnemyDeath(first)).toBe(false);
  const deathPosition = first.getPosition().clone();
  manager.commitUpdates();
  const blasts = manager.getActiveObjects().filter(o => o.subType === 'explosion_giant');
  expect(blasts).toHaveLength(1);
  expect(blasts[0].getPosition()).toEqual(deathPosition);
  expect(getInventory().score).toBe(initialScore + 25);
  expect(useGameStore.getState().progress.totalStats.totalEnemiesDefeated).toBe(initialKills + 1);

  const second = factory.spawn(GameObjectType.ENEMY_BROBOT, 160, 200)!;
  const distant = factory.spawn(GameObjectType.ENEMY_BROBOT, 500, 200)!;
  for (const object of [blasts[0], second, distant]) object.getComponent(DynamicCollisionComponent)!.update(0, object);
  collision.update(0);
  expect(second.life).toBe(0);
  expect(second.lastDamageSource).toBe(blasts[0]);
  expect(distant.life).toBe(1);
  expect(resolveEnemyDeath(second)).toBe(true);
  expect(resolveEnemyDeath(second)).toBe(false);
  manager.commitUpdates();
  expect(manager.getActiveObjects().filter(o => o.subType === 'explosion_giant')).toHaveLength(2);
  expect(getInventory().score).toBe(initialScore + 50);
  expect(useGameStore.getState().progress.totalStats.totalEnemiesDefeated).toBe(initialKills + 2);
  expect(player.life).toBe(3);
  expect(player.getVelocity().y).toBe(37);
  expect(flashes).toEqual([]);
});

test('a defeated persistent brobot cannot return as an invisible contact hazard', () => {
  const { manager, factory, collision, player } = setup();
  const camera = new CameraSystem(480, 320);
  camera.setPosition(100, 200);
  manager.setCamera(camera);
  const enemy = factory.spawn(GameObjectType.ENEMY_BROBOT, 100, 200)!;
  // Level-placed enemies persist when merely off camera, unlike runtime shots.
  enemy.destroyOnDeactivation = false;
  manager.commitUpdates();
  const body = new DynamicCollisionComponent();
  body.setCollisionVolumes(null, [new AABoxCollisionVolume(0, 0, 64, 64)]);
  body.setHitReactionComponent(new HitReactionComponent());
  player.addComponent(body);
  enemy.life = 0;
  expect(resolveEnemyDeath(enemy)).toBe(true);
  expect(enemy.isVisible()).toBe(false);
  const score = getInventory().score;
  for (let frame = 0; frame < 5; frame++) {
    // Manager membership determines which objects register: do not manually
    // omit the dead enemy as the older isolated collision test did.
    manager.update(0, 2 + frame);
    player.setGameTime(2 + frame);
    body.update(0, player);
    collision.update(0);
  }
  expect(player.life).toBe(3);
  expect(player.lastDamageSource).toBeNull();
  expect(getInventory().score).toBe(score);
  expect(manager.getActiveObjects().some(object => object.subType === 'brobot')).toBe(false);
});

test('a direct player hit retains stomp feedback, while ordinary death emits the original smoke', () => {
  const { manager, factory, player, sounds, flashes } = setup();
  const enemy = factory.spawn(GameObjectType.ENEMY_SNAILBOMB, 100, 200)!;
  const reaction = enemy.getComponent(HitReactionComponent as unknown as new (...args: unknown[]) => HitReactionComponent)!;
  reaction.receivedHit(enemy, player, HitType.HIT);
  expect(enemy.lastDamageSource).toBe(player);
  expect(resolveEnemyDeath(enemy)).toBe(true);
  expect(resolveEnemyDeath(enemy)).toBe(false);
  manager.commitUpdates();
  const smoke = manager.getActiveObjects().find(o => o.subType === 'smoke_poof')!;
  expect(smoke).toBeDefined();
  expect(smoke.getPosition().x).toBe(100);
  expect(smoke.getPosition().y + smoke.height).toBe(264);
  expect(sounds).toEqual(['sound_stomp']);
  expect(flashes).toHaveLength(1);
  expect(player.getVelocity().y).toBe(-200);
});

test('damage attribution clears when an object is recycled and cannot leak to the next spawn', () => {
  const { factory, player } = setup();
  const enemy = factory.spawn(GameObjectType.ENEMY_BROBOT, 100, 200)!;
  enemy.lastDamageSource = player;
  enemy.reset();
  expect(enemy.lastDamageSource).toBeNull();
});

test('the game loop uses the same death resolution as possession release', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source).toContain('resolveEnemyDeath(obj, systemRegistry)');
});

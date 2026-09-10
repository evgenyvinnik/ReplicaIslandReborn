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
  manager.commitUpdates();
  const blasts = manager.getActiveObjects().filter(o => o.subType === 'explosion_giant');
  expect(blasts).toHaveLength(1);
  expect(blasts[0].getPosition()).toEqual(first.getPosition());
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

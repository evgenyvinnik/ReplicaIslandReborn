import { afterEach, beforeEach, expect, test } from 'bun:test';
import { file } from 'bun';
import { GameObjectManager } from './GameObjectManager';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { GameObject } from './GameObject';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { finishProjectileCollisions } from './finishProjectileCollisions';
import { HitReactionComponent } from './components/HitReactionComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { HitType, Team } from '../types';

beforeEach(() => sSystemRegistry.reset());
afterEach(() => sSystemRegistry.reset());

function scene(): { manager: GameObjectManager; factory: GameObjectFactory; frame: () => void } {
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  const collision = new GameObjectCollisionSystem();
  const time = new TimeSystem();
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(factory, 'factory');
  sSystemRegistry.register(collision, 'gameObjectCollision');
  sSystemRegistry.register(time, 'time');
  return { manager, factory, frame: (): void => {
    time.update(1 / 60);
    manager.update(1 / 60, time.getGameTime());
    collision.update(1 / 60);
    finishProjectileCollisions(manager);
  } };
}

test('Game cleans up collision-consumed shots without a second rectangular hit test', async () => {
  const game = await file(new URL('../components/Game.tsx', import.meta.url)).text();
  expect(game.includes('finishProjectileCollisions(gameObjectManager)')).toBe(true);
  expect(game.includes('const projectilePosition = obj.getPosition()')).toBe(false);
});

for (const kind of [GameObjectType.ENERGY_BALL, GameObjectType.TURRET_BULLET]) {
  test(`${kind} crosses the Source sprite corner, hits its sphere and is removed once`, () => {
    const { factory, manager, frame } = scene();
    const source = factory.spawn(GameObjectType.THE_SOURCE, 0, 0)!;
    const shot = factory.spawn(kind, 4, 4)!;
    shot.setVelocity(300, 300);
    frame();
    expect(source.life).toBe(3);
    expect(shot.life).toBe(1);
    expect(shot.isVisible()).toBe(true);
    expect(shot.isMarkedForRemoval()).toBe(false);
    for (let i = 0; i < 60 && shot.life > 0; i++) frame();
    expect(source.life).toBe(2);
    expect(shot.life).toBe(0);
    expect(shot.isVisible()).toBe(false);
    expect(shot.isMarkedForRemoval()).toBe(true);
    const shotId = shot.id;
    manager.commitUpdates();
    expect(manager.getActiveObjects().some(object => object.id === shotId)).toBe(false);
    for (let i = 0; i < 10; i++) frame();
    expect(source.life).toBe(2);
  });
}

test('a projectile passes through an invincible target instead of disappearing on overlap', () => {
  const { factory, manager, frame } = scene();
  const target = new GameObject();
  target.type = 'player';
  target.team = Team.PLAYER;
  target.width = target.height = 64;
  target.life = 3;
  const collision = new DynamicCollisionComponent();
  const reaction = new HitReactionComponent({ forceInvincibility: true });
  collision.setCollisionVolumes(null, [new SphereCollisionVolume(32, 32, 32, HitType.HIT)]);
  collision.setHitReactionComponent(reaction);
  target.addComponent(collision);
  target.addComponent(reaction);
  manager.add(target);
  const shot = factory.spawn(GameObjectType.ENERGY_BALL, 16, 16)!;
  shot.setVelocity(300, 0);
  for (let i = 0; i < 15; i++) frame();
  expect(target.life).toBe(3);
  expect(shot.life).toBe(1);
  expect(shot.getPosition().x).toBeGreaterThan(target.width);
  expect(shot.isMarkedForRemoval()).toBe(false);
});

test('Wanda shots retain their original piercing behavior after an accepted hit', () => {
  const { factory, frame } = scene();
  const source = factory.spawn(GameObjectType.THE_SOURCE, 0, 0)!;
  const shot = factory.spawn(GameObjectType.WANDA_SHOT, 240, 240)!;
  frame();
  expect(source.life).toBe(2);
  expect(shot.life).toBe(1);
  expect(shot.isMarkedForRemoval()).toBe(false);
});

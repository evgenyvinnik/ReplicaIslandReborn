import { afterEach, expect, test } from 'bun:test';
import { GameObject } from './GameObject';
import { GameObjectFactory, GameObjectType } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { LauncherComponent } from './components/LauncherComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { TimeSystem } from '../engine/TimeSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';

afterEach(() => sSystemRegistry.reset());

test('a cannon emits three large and three small moving smoke particles at its original muzzle', () => {
  const manager = new GameObjectManager();
  const time = new TimeSystem();
  const factory = new GameObjectFactory(manager);
  sSystemRegistry.register(manager, 'gameObject');
  sSystemRegistry.register(time, 'time');
  sSystemRegistry.gameObjectFactory = factory;
  factory.setSystemRegistry(sSystemRegistry);

  const cannon = new GameObject();
  cannon.width = 64;
  cannon.height = 128;
  cannon.setPosition(100, 200);
  const shot = new GameObject();
  shot.life = 1;
  const launcher = new LauncherComponent({
    angle: Math.PI, launchDelay: 0,
    launchEffect: GameObjectType.SMOKE_POOF,
    launchEffectOffsetX: 32, launchEffectOffsetY: 85,
  });
  launcher.prepareToLaunch(shot, cannon);
  time.update(1 / 60);
  launcher.update(1 / 60, cannon);
  manager.commitUpdates();
  const emitter = manager.getActiveObjects().find(o => o.subType === 'smoke_poof')!;
  expect(emitter).toBeDefined();
  expect(emitter.getComponent(SpriteComponent)).toBeNull();
  expect(emitter.getPosition().x).toBe(132);
  expect(emitter.getPosition().y).toBe(242); // 200 + 128 - 85 - emitter height
  expect(shot.getVelocity().y).toBeCloseTo(-2000);

  // Both original guns emit one particle per update for three updates.
  for (let tick = 0; tick < 10; tick++) {
    time.update(1 / 60);
    emitter.update(1 / 60, time.getGameTime());
    manager.commitUpdates();
  }
  const particles = manager.getActiveObjects().filter(o => o !== emitter);
  expect(particles.map(o => o.subType).sort()).toEqual([
    'smoke_big', 'smoke_big', 'smoke_big', 'smoke_small', 'smoke_small', 'smoke_small',
  ]);
  for (const particle of particles) {
    expect(particle.width).toBe(particle.subType === 'smoke_big' ? 32 : 16);
    expect(particle.getCenteredPositionX()).toBe(148);
    expect(particle.getCenteredPositionY()).toBe(227); // original offset is 16 above emitter feet
    expect(Math.hypot(particle.getVelocity().x, particle.getVelocity().y)).toBeCloseTo(200);
    const before = { x: particle.getPosition().x, y: particle.getPosition().y };
    particle.update(1 / 60, time.getGameTime());
    expect(Math.hypot(particle.getPosition().x - before.x, particle.getPosition().y - before.y)).toBeCloseTo(200 / 60);
    particle.update(1, time.getGameTime() + 1);
    expect(particle.isMarkedForRemoval()).toBe(true);
  }
  emitter.update(0.5, time.getGameTime() + 0.5);
  expect(emitter.isMarkedForRemoval()).toBe(true);
});

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { GameObject } from './GameObject';
import { GameObjectFactory } from './GameObjectFactory';
import { GameObjectManager } from './GameObjectManager';
import { SpriteComponent } from './components/SpriteComponent';
import { FadeDrawableComponent } from './components/FadeDrawableComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { CameraSystem } from '../engine/CameraSystem';
import { SortConstants } from '../engine/SortConstants';
import { Team } from '../types';

test('ruby pickup emits six harmless gems from its center, moving and fading for half a second', () => {
  const manager = new GameObjectManager();
  const factory = new GameObjectFactory(manager);
  const ruby = new GameObject();
  ruby.type = 'ruby';
  ruby.width = ruby.height = 32;
  ruby.setPosition(100, 200);
  factory.spawnRubyBurst(ruby);
  manager.commitUpdates();
  const particles = manager.getActiveObjects();
  expect(particles).toHaveLength(6);
  for (const [index, particle] of particles.entries()) {
    expect(particle.type).toBe('effect');
    expect(particle.subType).toBe('gem_effect');
    expect(particle.team).toBe(Team.NONE);
    expect(particle.getComponent(DynamicCollisionComponent)).toBeNull();
    expect(particle.width).toBe(32);
    expect(particle.height).toBe(32);
    expect(particle.getCenteredPositionX()).toBe(116);
    expect(particle.getCenteredPositionY()).toBe(216);
    const angle = index * Math.PI * 2 / 6;
    expect(particle.getVelocity().x).toBeCloseTo(Math.sin(angle) * 150);
    expect(particle.getVelocity().y).toBeCloseTo(-Math.cos(angle) * 150);
    const sprite = particle.getComponent(SpriteComponent)!;
    expect(sprite.getCurrentDraw()?.sprite).toBe('ruby01');
    expect(sprite.getCurrentDraw()?.priority).toBe(SortConstants.EFFECT);
  }
  manager.update(0.01, 0.01);
  manager.update(0.25, 0.26);
  for (const particle of particles) {
    expect(Math.hypot(particle.getPosition().x - 100, particle.getPosition().y - 200))
      .toBeCloseTo(150 * 0.26);
    expect(particle.getComponent(FadeDrawableComponent)!.getOpacity()).toBeCloseTo(0.5);
  }
  manager.update(0.241, 0.501);
  manager.commitUpdates();
  expect(manager.getActiveObjects()).toHaveLength(0);
  // Repeated pickups can reuse the manager's pool without retaining old fades.
  factory.spawnRubyBurst(ruby);
  manager.commitUpdates();
  expect(manager.getActiveObjects()).toHaveLength(6);
  for (const particle of manager.getActiveObjects()) {
    expect(particle.getComponent(FadeDrawableComponent)!.getOpacity()).toBe(1);
  }
});

test('ruby burst particles are discarded when the camera leaves them', () => {
  const manager = new GameObjectManager();
  const camera = new CameraSystem(480, 320);
  manager.setCamera(camera);
  const factory = new GameObjectFactory(manager);
  const ruby = new GameObject();
  ruby.width = ruby.height = 32;
  factory.spawnRubyBurst(ruby);
  camera.setPosition(5000, 5000);
  manager.update(1 / 60, 1 / 60);
  manager.commitUpdates();
  expect(manager.getActiveObjects()).toHaveLength(0);
  camera.setPosition(0, 0);
  manager.update(1 / 60, 2 / 60);
  expect(manager.getActiveObjects()).toHaveLength(0);
});

test('the real pickup branch calls the burst without changing its ruby award or win trigger', () => {
  const game = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  const branch = game.split("} else if (obj.type === 'ruby') {")[1].split("} else if (obj.type === 'pearl') {")[0];
  expect(branch).toContain('spawnRubyBurst(obj)');
  expect(branch).toContain('rubyCount: newRubyCount, score: inv.score + 3');
  expect(branch).toContain('playerComponent.beginWin(timeSystem)');
});

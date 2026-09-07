import { afterEach, expect, test } from 'bun:test';
import { CollisionSystem } from '../engine/CollisionSystemNew';
import { InputSystem } from '../engine/InputSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import type { SoundSystem } from '../engine/SoundSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';
import { GameObject } from './GameObject';
import { PlayerComponent } from './components/PlayerComponent';
import { SolidSurfaceComponent, setSolidSurfaceSystemRegistry } from './components/SolidSurfaceComponent';

afterEach(() => sSystemRegistry.reset());

function scene(): {
  player: GameObject; solid: GameObject; collision: CollisionSystem;
  input: InputSystem; frame: () => void;
} {
  sSystemRegistry.reset();
  const collision = new CollisionSystem();
  sSystemRegistry.register(collision, 'collision');
  setSolidSurfaceSystemRegistry(sSystemRegistry);
  const input = new InputSystem();
  const player = new GameObject();
  player.width = 32;
  player.height = 48;
  player.setPosition(32, 100);
  const control = new PlayerComponent();
  control.setSystems(input, collision, { playSfx: () => undefined } as unknown as SoundSystem,
    { getLevelSize: () => ({ width: 4096, height: 4096 }) } as unknown as LevelSystem);
  player.addComponent(control);
  const solid = new GameObject();
  solid.width = 32;
  solid.height = 300;
  solid.setPosition(160, 0);
  const surface = new SolidSurfaceComponent();
  surface.createRectangle(solid.width, solid.height);
  solid.addComponent(surface);
  solid.update(0, 0);
  collision.updateTemporarySurfaces();
  let time = 0;
  return { player, solid, collision, input, frame: (): void => {
    time += 1 / 60;
    player.update(1 / 60, time);
    solid.update(1 / 60, time);
    collision.updateTemporarySurfaces();
  } };
}

test('real player movement stops at a solid object from both directions', () => {
  for (const direction of [1, -1]) {
    const { player, input, frame } = scene();
    player.setPosition(direction > 0 ? 100 : 220, 100);
    input.setVirtualAxis('horizontal', direction);
    for (let i = 0; i < 45; i++) frame();
    expect(player.getPosition().x).toBeCloseTo(direction > 0 ? 128 : 192, 5);
    expect(player.getVelocity().x).toBe(0);
    expect(direction > 0 ? player.touchingRightWall() : player.touchingLeftWall()).toBe(true);
  }
});

test('removing a door surface lets the same player walk through', () => {
  const { player, solid, input, frame } = scene();
  player.setPosition(100, 100);
  input.setVirtualAxis('horizontal', 1);
  for (let i = 0; i < 30; i++) frame();
  expect(player.getPosition().x).toBe(128);
  solid.removeAllComponents();
  for (let i = 0; i < 30; i++) frame();
  expect(player.getPosition().x).toBeGreaterThan(192);
});

test('a player lands on solid objects and can stand there without sinking', () => {
  const { player, solid, frame } = scene();
  solid.setPosition(160, 200);
  player.setPosition(160, 100);
  for (let i = 0; i < 120; i++) frame();
  expect(player.getPosition().y + player.height).toBeCloseTo(200, 5);
  expect(player.touchingGround()).toBe(true);
  expect(player.getVelocity().y).toBe(0);
});

test('a sweep catches a narrow wall even when the destination is beyond it', () => {
  const { player, collision } = scene();
  const hit = collision.sweepTemporaryBox(100, 100, 32, 48, 200, 0, player);
  expect(hit?.x).toBe(128);
  expect(hit?.normalX).toBe(-1);
  // Mere contact along the bottom edge is not a side collision.
  expect(collision.sweepTemporaryBox(100, -48, 32, 48, 200, 0, player)).toBeNull();
});

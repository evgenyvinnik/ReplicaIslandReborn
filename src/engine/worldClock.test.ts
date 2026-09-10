import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { TimeSystem } from './TimeSystem';
import { EffectsSystem, EffectType } from './EffectsSystem';
import { CameraSystem } from './CameraSystem';
import { CollisionSystem } from './CollisionSystemNew';
import { InputSystem } from './InputSystem';
import { SoundSystem } from './SoundSystem';
import { sSystemRegistry } from './SystemRegistry';
import { GameObject } from '../entities/GameObject';
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
import type { LevelSystem } from '../levels/LevelSystemNew';
import type { RenderSystem } from './RenderSystem';

afterEach(() => sSystemRegistry.reset());

test('Game passes scaled time to world systems and leaves UI animations unscaled', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  for (const statement of ['effectsSystem.update(gameDelta)', 'cameraSystem.update(gameDelta)',
    'timers.big += gameDelta', 'timers.small += gameDelta', 'checkHotSpotsPostPhysics(obj, gameDelta)']) {
    expect(source.includes(statement), statement).toBe(true);
  }
  expect(source.includes('playerComponent.hitReactTimer -=')).toBe(false);
  expect(source.includes('playerComponent.invincibleTime -=')).toBe(false);
  expect(source.includes('playerComponent.glowTime -=')).toBe(false);
  expect(source.includes('canvasHUD.update(displayDelta)')).toBe(true);
  expect(source.includes('canvasCutscene.update(displayDelta)')).toBe(true);
});

test('player recovery, invincibility and glow advance with component simulation time', () => {
  sSystemRegistry.reset();
  const clock = new TimeSystem(), player = new GameObject(), control = new PlayerComponent();
  control.setSystems(new InputSystem(), new CollisionSystem(), new SoundSystem(),
    { getLevelSize: () => ({ width: 10000, height: 10000 }) } as LevelSystem);
  player.width = 32; player.height = 48; player.setPosition(100, 100);
  player.addComponent(control);
  control.currentState = PlayerState.HIT_REACT; control.hitReactTimer = 0.5;
  control.invincible = true; control.invincibleTime = 2;
  control.activateGlow(3);
  clock.applyScale(0.1, 100, false);
  const step = (realDelta: number): void => {
    clock.update(realDelta); player.update(clock.getFrameDelta(), clock.getGameTime());
  };
  for (let i = 0; i < 60; i++) step(1 / 60);
  expect(control.hitReactTimer).toBeCloseTo(0.4);
  expect(control.invincibleTime).toBeCloseTo(1.9);
  expect(control.glowTime).toBeCloseTo(2.9);
  clock.freeze(1);
  for (let i = 0; i < 30; i++) step(1 / 60);
  expect(control.hitReactTimer).toBeCloseTo(0.4);
  expect(control.invincibleTime).toBeCloseTo(1.9);
  expect(control.glowTime).toBeCloseTo(2.9);
  // Game's pause gate calls neither TimeSystem nor the objects.
  expect(control.currentState).toBe(PlayerState.HIT_REACT);
  for (let i = 0; i < 31 * 60; i++) step(1 / 60);
  expect<PlayerState>(control.currentState).toBe(PlayerState.MOVE);
  expect(control.hitReactTimer).toBe(0);
  expect(control.invincible).toBe(false);
  expect(control.invincibleTime).toBe(0);
  expect(control.glowMode).toBe(false);
  expect(control.glowTime).toBe(0);
});

test('world smoke and camera shake retain their frame through hit-stop and slow together', () => {
  const clock = new TimeSystem(), effects = new EffectsSystem(), camera = new CameraSystem(480, 320);
  camera.setPosition(500, 500); camera.shake(10, 1);
  effects.spawn(EffectType.SMOKE_SMALL, 100, 100, 100, -50);
  const draws: Array<{ sprite: string; x: number; y: number }> = [];
  const renderer = { hasSprite: () => true,
    drawSprite: (sprite: string, x: number, y: number): void => { draws.push({ sprite, x, y }); },
  } as unknown as RenderSystem;
  const snapshot = (): unknown => {
    draws.length = 0; effects.drawQueued(renderer, 0);
    return { draws: [...draws], cameraY: camera.getFocusPositionY() };
  };
  const step = (dt: number): void => {
    clock.update(dt); effects.update(clock.getFrameDelta()); camera.update(clock.getFrameDelta());
  };
  snapshot();
  const initial = { ...draws[0] };
  clock.applyScale(0.1, 10, false);
  step(1);
  const before = snapshot();
  expect(draws[0].x - initial.x).toBeCloseTo(10);
  expect(draws[0].y - initial.y).toBeCloseTo(-5);
  clock.freeze(1);
  for (let i = 0; i < 30; i++) step(1 / 60);
  expect(snapshot()).toEqual(before);
  expect(effects.getActiveCount()).toBe(1);
  step(5.1);
  expect(effects.getActiveCount()).toBe(0);
});

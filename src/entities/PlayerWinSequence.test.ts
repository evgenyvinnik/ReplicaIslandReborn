import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PlayerWinSequence } from './PlayerWinSequence';
import { PlayerComponent, PlayerState } from './components/PlayerComponent';
import { TimeSystem } from '../engine/TimeSystem';
import { GameObject } from './GameObject';

test('third-ruby completion is driven by the paused game loop, never a browser timer', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source.includes('WIN_COMPLETE_DELAY_MS')).toBe(false);
  expect(source).toContain('pComp.advanceWin(timeSystem.getRealTime())');
  expect(source).toContain('playerComponent.beginWin(timeSystem)');
  expect(source).toContain('playerCompForWinFade.winFadeOpacity');
});

test('win waits strictly over two unscaled seconds then fades for 1.5 seconds exactly once', () => {
  const win = new PlayerWinSequence();
  win.begin(0);
  expect(win.update(1.5)).toBe(false);
  expect(win.opacity).toBe(0);
  expect(win.update(2)).toBe(false);
  expect(win.opacity).toBe(0);
  expect(win.update(2.01)).toBe(false);
  expect(win.opacity).toBe(0);
  expect(win.update(2.76)).toBe(false);
  expect(win.opacity).toBeCloseTo(0.5);
  expect(win.update(3.52)).toBe(true);
  expect(win.opacity).toBe(1);
  expect(win.update(10)).toBe(false);
  expect(win.opacity).toBe(1);
});

test('slow motion and hit freeze do not stretch winning; pause stops both delay and fade', () => {
  const clock = new TimeSystem(), win = new PlayerWinSequence();
  win.begin(clock.getRealTime()); clock.applyScale(0.1, 8, true);
  const step = (dt: number): boolean => {
    clock.update(dt); return win.update(clock.getRealTime());
  };
  step(1);
  for (let i = 0; i < 300; i++) expect(win.update(clock.getRealTime())).toBe(false);
  expect(win.opacity).toBe(0);
  clock.freeze(10);
  step(1.01); step(0.75);
  expect(clock.getGameTime()).toBeLessThan(1);
  expect(win.opacity).toBeCloseTo(0.5);
  for (let i = 0; i < 300; i++) expect(win.update(clock.getRealTime())).toBe(false);
  expect(win.opacity).toBeCloseTo(0.5);
  expect(step(0.76)).toBe(true);
});

test('player win cannot restart, turn into death, or leave a delayed completion after reset', () => {
  const player = new GameObject(), control = new PlayerComponent(), clock = new TimeSystem();
  control.stomping = true;
  expect(control.beginWin(clock)).toBe(true);
  expect(control.currentState).toBe(PlayerState.WIN);
  expect(control.stomping).toBe(false);
  expect(clock.isScaling()).toBe(true);
  clock.update(2.01); control.advanceWin(clock.getRealTime());
  clock.update(0.75); control.advanceWin(clock.getRealTime());
  expect(control.winFadeOpacity).toBeCloseTo(0.5);
  expect(control.beginWin(clock)).toBe(false);
  expect(control.beginDeath(player, true)).toBe(false);
  expect(control.currentState).toBe(PlayerState.WIN);
  control.reset();
  expect(control.levelWon).toBe(false);
  expect(control.winFadeOpacity).toBe(0);
  expect(control.advanceWin(100)).toBe(false);
  expect(control.beginWin(clock)).toBe(true);
  clock.update(2.01); expect(control.advanceWin(clock.getRealTime())).toBe(false);
  clock.update(1.51); expect(control.advanceWin(clock.getRealTime())).toBe(true);
  expect(control.advanceWin(clock.getRealTime())).toBe(false);
  control.reset(); control.isDying = true;
  expect(control.beginWin(clock)).toBe(false);
});

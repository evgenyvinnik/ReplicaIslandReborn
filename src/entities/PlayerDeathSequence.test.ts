import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { TimeSystem } from '../engine/TimeSystem';
import { PlayerDeathSequence } from './PlayerDeathSequence';

test('death delay is game time, fade is unscaled time, and restart is emitted once', () => {
  const clock = new TimeSystem(), death = new PlayerDeathSequence();
  clock.update(1); death.begin(clock.getGameTime());
  clock.applyScale(0.1, 100);
  const step = (dt: number): boolean => {
    clock.update(dt); return death.update(clock.getGameTime(), clock.getRealTime(), true);
  };
  expect(step(10)).toBe(false); // only one simulation second
  expect(death.fading).toBe(false); expect(death.deathTime).toBeCloseTo(1);
  expect(step(10.1)).toBe(false); // cross two game seconds; fade starts now
  expect(death.fading).toBe(true); expect(death.fadeTime).toBe(1.5);
  expect(step(0.75)).toBe(false); expect(death.fadeTime).toBeCloseTo(0.75);
  expect(step(0.75)).toBe(true);
  expect(death.fadeTime).toBe(0); expect(death.fading).toBe(true);
  expect(step(10)).toBe(false);
});

test('a long fall cannot fade until the death presentation is ready', () => {
  const death = new PlayerDeathSequence(); death.begin(0);
  expect(death.update(5, 5, false)).toBe(false); expect(death.fading).toBe(false);
  expect(death.update(5, 5, true)).toBe(false); expect(death.fadeTime).toBe(1.5);
  expect(death.update(6.5, 6.5, true)).toBe(true);
});

test('freeze pauses the death delay, inactive clocks pause a fade, and reset permits another retry', () => {
  const clock = new TimeSystem(), death = new PlayerDeathSequence();
  death.begin(clock.getGameTime()); clock.freeze(1);
  clock.update(0.5); death.update(clock.getGameTime(), clock.getRealTime(), true);
  expect(death.deathTime).toBe(2);
  clock.update(2.1); death.update(clock.getGameTime(), clock.getRealTime(), true);
  expect(death.fadeTime).toBe(1.5);
  // Game's pause/dialog gate does not update either clock.
  for (let i = 0; i < 100; i++) death.update(clock.getGameTime(), clock.getRealTime(), true);
  expect(death.fadeTime).toBe(1.5);
  clock.update(1.5 + 1e-9); expect(death.update(clock.getGameTime(), clock.getRealTime(), true)).toBe(true);
  death.reset(); expect(death.fading).toBe(false); expect(death.update(100, 100, true)).toBe(false);
  death.begin(100); expect(death.update(102, 102, true)).toBe(false);
  expect(death.fading).toBe(false); // original elapsed > 2, not >= 2
  death.update(102.01, 102.01, true);
  expect(death.update(104, 104, true)).toBe(true);
});

test('Game uses both clocks, gates pending reloads, retains a black frame and handles rejection', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source).toContain('pComp.advanceDeath(gameTime, timeSystem.getRealTime())');
  expect(source).not.toContain('pComp.deathTime -=');
  expect(source).not.toContain('pComp.fadeTime -=');
  expect(source).toContain('gameStateRef.current !== GameState.PLAYING || deathReloadInProgress');
  expect(source).toContain('const alpha = deathReloadInProgress ? 1');
  const retry = source.slice(source.indexOf('if (pComp.advanceDeath'), source.indexOf('// Check collectible pickups'));
  expect(retry).toContain('}).catch(() =>');
  expect(retry).toContain('lastPlayerLife = -1');
});

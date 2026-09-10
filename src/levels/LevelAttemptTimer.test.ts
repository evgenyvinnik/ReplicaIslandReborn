import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { TimeSystem } from '../engine/TimeSystem';
import { LevelAttemptTimer } from './LevelAttemptTimer';

test('attempt time follows simulation, excluding paused and dialogue-reading time', () => {
  const clock = new TimeSystem();
  const timer = new LevelAttemptTimer();
  clock.update(50); // a previous level, before this attempt
  timer.start(clock);
  clock.update(2);
  expect(timer.elapsed()).toBe(2);
  clock.pause();
  clock.update(60);
  expect(timer.elapsed()).toBe(2);
  clock.resume();
  // Game's dialogue/diary gate does not update TimeSystem at all.
  expect(timer.elapsed()).toBe(2);
  clock.update(3);
  expect(timer.elapsed()).toBe(5);
});

test('slow motion uses Android simulation seconds, and every new attempt resets the baseline', () => {
  const clock = new TimeSystem();
  const timer = new LevelAttemptTimer();
  timer.start(clock);
  clock.update(2);
  clock.applyScale(0.1, 8, false);
  clock.update(1);
  expect(timer.elapsed()).toBeCloseTo(2.1);
  clock.clearScale();
  timer.start(clock); // retry or successful transition on the same engine
  expect(timer.elapsed()).toBe(0);
  clock.update(4);
  expect(timer.elapsed()).toBeCloseTo(4);
  timer.start(new TimeSystem()); // replacement game instance
  expect(timer.elapsed()).toBe(0);
});

test('both completion paths use the shared simulation timer started by successful-load setup', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(source.includes('(Date.now() - levelStartTimeRef.current)')).toBe(false);
  expect(source.includes('levelAttemptTimerRef.current.start(systemRegistryRef.current?.timeSystem)')).toBe(true);
  expect(source.match(/const elapsedTime = levelAttemptTimerRef.current.elapsed\(\)/g)).toHaveLength(2);
});

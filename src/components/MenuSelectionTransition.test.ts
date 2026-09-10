import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { MenuSelectionTransition } from './MenuSelectionTransition';

function fixture(): { transition: MenuSelectionTransition; tick: (time: number) => void; staleCallbacks: () => void } {
  let now = 0;
  const tasks: Array<{ callback: () => void; at: number; canceled: boolean; ran: boolean }> = [];
  const transition = new MenuSelectionTransition((callback, delay) => {
    const task = { callback, at: now + delay, canceled: false, ran: false };
    tasks.push(task);
    return (): void => { task.canceled = true; };
  });
  return { transition,
    tick(time): void {
      now = time;
      for (const task of tasks) if (!task.canceled && !task.ran && task.at <= now) {
        task.ran = true;
        task.callback();
      }
    },
    staleCallbacks(): void { tasks.filter(task => task.canceled).forEach(task => task.callback()); },
  };
}

test('one selection fades at 300ms and launches once at 800ms despite repeated input', () => {
  const { transition, tick } = fixture();
  let fades = 0, launches = 0;
  expect(transition.start(() => launches++, () => fades++)).toBe(true);
  expect(transition.start(() => { launches += 100; })).toBe(false);
  tick(299); expect(fades).toBe(0); expect(launches).toBe(0);
  tick(300); expect(fades).toBe(1); expect(launches).toBe(0);
  tick(799); expect(launches).toBe(0);
  tick(800); expect(launches).toBe(1);
  tick(1600); expect(launches).toBe(1);
  expect(transition.start(() => launches++)).toBe(false);
});

test.each([0, 299, 300, 799])('closing a menu at %dms cancels its pending launch', at => {
  const { transition, tick, staleCallbacks } = fixture();
  let launches = 0, fades = 0;
  transition.start(() => launches++, () => fades++);
  tick(at);
  transition.cancel();
  const priorFades = fades;
  tick(2000);
  staleCallbacks();
  expect(launches).toBe(0);
  expect(fades).toBe(priorFades);
});

test('StrictMode cleanup or a reopened menu cannot revive an earlier selection', () => {
  const { transition, tick, staleCallbacks } = fixture();
  let oldLaunches = 0, newLaunches = 0;
  transition.start(() => oldLaunches++);
  transition.cancel();
  expect(transition.start(() => newLaunches++)).toBe(true);
  staleCallbacks();
  tick(800);
  expect(oldLaunches).toBe(0);
  expect(newLaunches).toBe(1);
});

test('difficulty and level menus use the unmount-owned transition instead of detached timers', () => {
  const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8');
  for (const name of ['./DifficultyMenu.tsx', './LevelSelect.tsx']) {
    const source = read(name);
    expect(source.includes('useMenuSelectionTransition()')).toBe(true);
    expect(source.includes('selectionTransition.start(')).toBe(true);
    expect(source.includes('setTimeout(')).toBe(false);
  }
  expect(read('./useMenuSelectionTransition.ts').includes('current.cancel()')).toBe(true);
});

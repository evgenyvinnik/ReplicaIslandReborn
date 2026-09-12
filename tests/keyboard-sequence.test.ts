import { expect, test } from 'bun:test';
import { KeyboardSequence, parseKeySequence } from './keyboard-sequence';

function rig() {
  const events: string[] = [], completed: boolean[] = [];
  const tasks = new Map<number, { callback: () => void; milliseconds: number }>();
  let id = 0;
  const runner = new KeyboardSequence((type, code) => events.push(`${type}:${code}`), {
    set(callback, milliseconds) { tasks.set(++id, { callback, milliseconds }); return id; },
    clear(handle) { tasks.delete(handle as number); },
  }, cancelled => completed.push(cancelled));
  const next = () => {
    const [handle, task] = tasks.entries().next().value!;
    tasks.delete(handle);
    task.callback();
    return task.milliseconds;
  };
  return { runner, events, completed, tasks, next };
}

test('input sequence parses named key combinations and bounded waits', () => {
  expect(parseKeySequence('# route\nright+fly 1500\nFLY 600\nWAIT 250\nPAUSE 50')).toEqual([
    { codes: ['ArrowRight', 'Space'], milliseconds: 1500 },
    { codes: ['Space'], milliseconds: 600 },
    { codes: [], milliseconds: 250 },
    { codes: ['Escape'], milliseconds: 50 },
  ]);
  expect(parseKeySequence('FLY+FLY 1')[0].codes).toEqual(['Space']);
});

test('input sequence rejects malformed, unbounded and executable input', () => {
  for (const source of ['', 'RIGHT 0', 'RIGHT 10001', 'RIGHT -1', 'RIGHT 1.5',
    'RIGHT Infinity', 'WAIT+RIGHT 50', 'eval(alert(1))', 'BOGUS 10',
    Array(65).fill('RIGHT 1').join('\n'), Array(4).fill('WAIT 10000').join('\n')]) {
    expect(() => parseKeySequence(source)).toThrow();
  }
});

test('adjacent flight steps retain thrust without an extra key edge', () => {
  const r = rig();
  r.runner.start(parseKeySequence('RIGHT+FLY 1500\nFLY 600\nLEFT+FLY 200\nWAIT 100'));
  expect(r.next()).toBe(1500);
  expect(r.events).toEqual(['keydown:ArrowRight', 'keydown:Space', 'keyup:ArrowRight']);
  expect(r.next()).toBe(600);
  expect(r.next()).toBe(200);
  expect(r.events).toEqual(['keydown:ArrowRight', 'keydown:Space', 'keyup:ArrowRight',
    'keydown:ArrowLeft', 'keyup:ArrowLeft', 'keyup:Space']);
  expect(r.next()).toBe(100);
  expect(r.completed).toEqual([false]);
  expect(r.tasks.size).toBe(0);
});

test('charge is released before steering and all keys release at completion', () => {
  const r = rig();
  r.runner.start(parseKeySequence('ATTACK 1000\nUP+RIGHT 400'));
  r.next(); r.next();
  expect(r.events).toEqual(['keydown:KeyX', 'keyup:KeyX', 'keydown:ArrowUp',
    'keydown:ArrowRight', 'keyup:ArrowUp', 'keyup:ArrowRight']);
  expect(r.completed).toEqual([false]);
});

test('cancellation releases keys once and prevents stale timers from restarting them', () => {
  const r = rig();
  r.runner.start(parseKeySequence('RIGHT+FLY 1500\nLEFT 600'));
  const stale = [...r.tasks.values()][0].callback;
  expect(r.runner.start(parseKeySequence('ATTACK 1000'))).toBe(false);
  r.runner.cancel(); r.runner.cancel();
  expect(r.tasks.size).toBe(0);
  expect(r.events).toEqual(['keydown:ArrowRight', 'keydown:Space', 'keyup:ArrowRight', 'keyup:Space']);
  expect(r.completed).toEqual([true]);
  expect(r.runner.start(parseKeySequence('UP 100'))).toBe(true);
  stale();
  expect(r.events.at(-1)).toBe('keydown:ArrowUp');
  r.next();
  expect(r.completed).toEqual([true, false]);
});

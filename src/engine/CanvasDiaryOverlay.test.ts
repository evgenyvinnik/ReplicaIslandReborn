import { expect, test } from 'bun:test';
import { CanvasDiaryOverlay } from './CanvasDiaryOverlay';
import { DiaryEntries } from '../data/diaries';

function inputRig(run: (overlay: CanvasDiaryOverlay, keys: globalThis.EventTarget,
  canvas: globalThis.EventTarget, headerY: () => number, closes: () => number) => void): void {
  const oldWindow = globalThis.window, oldImage = globalThis.Image;
  const keys = new globalThis.EventTarget(), canvas = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof oldWindow;
  globalThis.Image = class {} as unknown as typeof oldImage;
  Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ height: 640 }) });
  let y = 0, closed = 0;
  const context = new Proxy({
    measureText: (text: string): { width: number } => ({ width: text.length * 7 }),
    fillText: (text: string, _x: number, nextY: number): void => {
      if (text === 'FOUND OLD DIARY') y = nextY;
    },
  }, { get: (target, key): unknown => Reflect.get(target, key) ?? ((): void => {}) });
  const overlay = new CanvasDiaryOverlay(context as unknown as CanvasRenderingContext2D,
    canvas as HTMLCanvasElement, 480, 320);
  try {
    overlay.show(DiaryEntries[0], () => { closed++; });
    overlay.update(0.25);
    run(overlay, keys, canvas, () => { overlay.render(); return y; }, () => closed);
  } finally { overlay.hide(); globalThis.window = oldWindow; globalThis.Image = oldImage; }
}

function dispatch(target: globalThis.EventTarget, type: string, fields: Record<string, unknown>): globalThis.Event {
  const event = new globalThis.Event(type, { cancelable: true });
  for (const [name, value] of Object.entries(fields)) Object.defineProperty(event, name, { value });
  target.dispatchEvent(event);
  return event;
}

test('every diary scrolls its final line into view regardless of the previous canvas font', () => {
  const oldWindow = globalThis.window, oldImage = globalThis.Image;
  const keys = new globalThis.EventTarget(), canvas = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof oldWindow;
  globalThis.Image = class {} as unknown as typeof oldImage;
  const labels: Array<{ text: string; y: number }> = [];
  const fonts: string[] = [];
  const drawing = {
    font: '8px sans-serif',
    save: (): void => { fonts.push(drawing.font); },
    restore: (): void => { drawing.font = fonts.pop()!; },
    measureText: (text: string): { width: number } => ({
      width: text.length * Number(drawing.font.match(/(\d+)px/)![1]) * 0.6,
    }),
    fillText: (text: string, _x: number, y: number): void => { labels.push({ text, y }); },
  };
  const context = new Proxy(drawing, { get: (target, key): unknown => Reflect.get(target, key) ?? ((): void => {}) });
  const overlay = new CanvasDiaryOverlay(context as unknown as CanvasRenderingContext2D,
    canvas as HTMLCanvasElement, 480, 320);
  try {
    for (const entry of DiaryEntries) {
      const finalPositions: number[] = [];
      for (const font of ['8px sans-serif', '32px monospace']) {
        drawing.font = font;
        overlay.show(entry);
        expect(drawing.font).toBe(font); // measuring may not change the caller's context
        overlay.update(0.25);
        dispatch(canvas, 'wheel', { deltaY: 100000 });
        labels.length = 0; overlay.render();
        const finalLine = labels[labels.length - 2]!; // the fixed close hint follows the body
        expect(finalLine.text.length).toBeGreaterThan(0);
        expect(finalLine.y, `entry ${entry.id}, previous font ${font}`).toBeLessThanOrEqual(280);
        expect(finalLine.y).toBeGreaterThan(40);
        finalPositions.push(finalLine.y);
        overlay.hide(); overlay.update(0.25);
      }
      expect(finalPositions[0]).toBeCloseTo(finalPositions[1]);
    }
  } finally { overlay.hide(); globalThis.window = oldWindow; globalThis.Image = oldImage; }
});

test('diary owns close and scroll keys, ignores repeated close keys but allows repeated scrolling', () => {
  for (const closeKey of [' ', 'Enter', 'Escape']) inputRig((overlay, keys, _canvas, headerY, closes) => {
    let leaked = 0;
    keys.addEventListener('keydown', () => { leaked++; });
    dispatch(keys, 'keydown', { key: closeKey, repeat: true });
    expect(closes()).toBe(0);
    expect(overlay.isVisible()).toBe(true);
    const before = headerY();
    dispatch(keys, 'keydown', { key: 'ArrowDown', repeat: true });
    expect(headerY()).toBeLessThan(before);
    dispatch(keys, 'keydown', { key: closeKey, repeat: false });
    expect(closes()).toBe(1);
    expect(leaked).toBe(0);
    overlay.update(0.25);
    expect(overlay.isVisible()).toBe(false);
    dispatch(keys, 'keydown', { key: closeKey });
    expect(closes()).toBe(1);
    expect(leaked).toBe(1);
  });
});

test('a slow touch scroll is not a tap and uses logical canvas coordinates', () => inputRig(
  (overlay, _keys, canvas, headerY, closes) => {
    const before = headerY();
    dispatch(canvas, 'touchstart', { touches: [{ clientY: 200 }] });
    for (let y = 199; y >= 180; y--) dispatch(canvas, 'touchmove', { touches: [{ clientY: y }] });
    expect(headerY()).toBeCloseTo(before - 10); // 640 CSS pixels display 320 game pixels
    dispatch(canvas, 'touchend', { touches: [] });
    overlay.update(0.25);
    expect(closes()).toBe(0);
    expect(overlay.isVisible()).toBe(true);
  }
));

test('log entries support keyboard scrolling/closing and touch scrolling without closing', () => {
  const originalWindow = globalThis.window;
  const originalImage = globalThis.Image;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof originalWindow;
  globalThis.Image = class {} as unknown as typeof Image;
  const canvas = new globalThis.EventTarget();
  Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ height: 320 }) });
  const labels: Array<{ text: string; y: number }> = [];
  const context = new Proxy({
    measureText: (text: string): { width: number } => ({ width: text.length * 7 }),
    fillText: (text: string, _x: number, y: number): void => { labels.push({ text, y }); },
  }, { get: (target, key): unknown => Reflect.get(target, key) ?? ((): void => {}) });
  const overlay = new CanvasDiaryOverlay(
    context as unknown as CanvasRenderingContext2D, canvas as HTMLCanvasElement, 480, 320
  );
  let closes = 0;
  const send = (target: globalThis.EventTarget, type: string, fields: Record<string, unknown>): void => {
    const event = new globalThis.Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
  };
  try {
    overlay.show(DiaryEntries[0], () => { closes++; });
    overlay.update(0.25);
    overlay.render();
    const firstY = labels.find((label) => label.text === 'FOUND OLD DIARY')!.y;
    labels.length = 0;
    send(keys, 'keydown', { key: 'PageDown' });
    overlay.render();
    expect(labels.find((label) => label.text === 'FOUND OLD DIARY')!.y).toBeLessThan(firstY);
    expect(overlay.isVisible()).toBe(true);
    send(keys, 'keydown', { key: 'Enter' });
    overlay.update(0.25);
    expect(overlay.isVisible()).toBe(false);
    expect(closes).toBe(1);
    send(keys, 'keydown', { key: 'Enter' });
    expect(closes).toBe(1); // The close handler was detached.

    // The mouse wheel is how this is read on a desktop, and it was the input
    // the "can't scroll the log entries" report came from. It has to move the
    // text and, like a touch drag, must not close the overlay.
    overlay.show(DiaryEntries[0], () => { closes++; });
    overlay.update(0.25);
    labels.length = 0;
    overlay.render();
    const beforeWheel = labels.find((label) => label.text === 'FOUND OLD DIARY')!.y;
    send(canvas, 'wheel', { deltaY: 120 });
    labels.length = 0;
    overlay.render();
    expect(labels.find((label) => label.text === 'FOUND OLD DIARY')!.y,
      'the wheel should scroll the entry').toBeLessThan(beforeWheel);
    expect(overlay.isVisible(), 'the wheel must not close the overlay').toBe(true);
    // And scrolling back up returns to the top rather than running negative.
    send(canvas, 'wheel', { deltaY: -10000 });
    labels.length = 0;
    overlay.render();
    expect(labels.find((label) => label.text === 'FOUND OLD DIARY')!.y).toBe(beforeWheel);
    send(keys, 'keydown', { key: 'Enter' });
    overlay.update(0.25);
    closes--; // that close is accounted for by the wheel section

    overlay.show(DiaryEntries[1], () => { closes++; });
    overlay.update(0.25);
    send(canvas, 'touchstart', { touches: [{ clientY: 200 }] });
    send(canvas, 'touchmove', { touches: [{ clientY: 100 }] });
    send(canvas, 'touchend', { touches: [] });
    overlay.update(0.25);
    expect(overlay.isVisible()).toBe(true);
    expect(closes).toBe(1);
    send(canvas, 'touchstart', { touches: [{ clientY: 150 }] });
    send(canvas, 'touchend', { touches: [] });
    overlay.update(0.25);
    expect(overlay.isVisible()).toBe(false);
    expect(closes).toBe(2);
  } finally {
    overlay.hide();
    globalThis.window = originalWindow;
    globalThis.Image = originalImage;
  }
});

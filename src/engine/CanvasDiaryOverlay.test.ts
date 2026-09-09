import { expect, test } from 'bun:test';
import { CanvasDiaryOverlay } from './CanvasDiaryOverlay';
import { DiaryEntries } from '../data/diaries';

test('log entries support keyboard scrolling/closing and touch scrolling without closing', () => {
  const originalWindow = globalThis.window;
  const originalImage = globalThis.Image;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof originalWindow;
  globalThis.Image = class {} as unknown as typeof Image;
  const canvas = new globalThis.EventTarget();
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

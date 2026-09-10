import { expect, test } from 'bun:test';
import { CanvasDialog } from './CanvasDialog';
import type { Dialog } from '../data/dialogs';
import { LevelDialogs } from '../data/dialogs';

const onePage: Dialog = { conversations: [{ pages: [{ text: 'One page' }] }] };

function rig(run: (dialog: CanvasDialog, keys: globalThis.EventTarget) => void): void {
  const oldWindow = globalThis.window;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof oldWindow;
  const dialog = new CanvasDialog({ measureText: (text: string) => ({ width: text.length * 6.7 }) } as CanvasRenderingContext2D,
    new globalThis.EventTarget() as HTMLCanvasElement, 480, 320);
  try { run(dialog, keys); }
  finally { dialog.hide(); globalThis.window = oldWindow; }
}

function key(keys: globalThis.EventTarget, key: string, repeat = false): globalThis.Event {
  const event = new globalThis.Event('keydown', { cancelable: true });
  Object.defineProperties(event, { key: { value: key }, repeat: { value: repeat } });
  keys.dispatchEvent(event);
  return event;
}

test('Escape is owned by the dialogue and detaches it before invoking skip', () => rig((dialog, keys) => {
  let skips = 0, leaked = 0;
  dialog.show(onePage, () => {}, () => {
    skips++;
    expect(dialog.isActive()).toBe(false);
  });
  keys.addEventListener('keydown', () => { leaked++; });
  expect(key(keys, 'Escape').defaultPrevented).toBe(true);
  expect(skips).toBe(1);
  expect(leaked).toBe(0);
  key(keys, 'Escape');
  expect(skips).toBe(1);
  expect(leaked).toBe(1); // normal key handling resumes after dismissal
}));

test('advance keys do not leak on the last page and held keys do not skip pages', () => {
  for (const advance of ['Enter', ' ', 'x', 'X']) rig((dialog, keys) => {
    let completed = 0, leaked = 0;
    dialog.show({ conversations: [{ pages: [{ text: 'First' }, { text: 'Last' }] }] }, () => { completed++; });
    keys.addEventListener('keydown', () => { leaked++; });
    key(keys, advance);
    for (let i = 0; i < 4; i++) key(keys, advance, true);
    expect(completed).toBe(0);
    expect(dialog.isActive()).toBe(true);
    key(keys, advance);
    expect(completed).toBe(1);
    expect(dialog.isActive()).toBe(false);
    expect(leaked).toBe(0);
  });
});

test('skip can synchronously open the next dialogue without old cleanup hiding it', () => rig((dialog, keys) => {
  let completed = 0;
  dialog.show(onePage, () => {}, () => dialog.show(onePage, () => { completed++; }));
  key(keys, 'Escape');
  expect(dialog.isActive()).toBe(true);
  key(keys, 'Enter');
  expect(completed).toBe(1);
  expect(dialog.isActive()).toBe(false);
}));

test('every authored dialogue page can be read in full before advancing', () => {
  const oldWindow = globalThis.window;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof oldWindow;
  let drawn: string[] = [];
  const ctx = new Proxy({ font: '', measureText: (text: string): { width: number } => ({ width: text.length * 6.7 }),
    fillText: (text: string): void => { if (ctx.font === '11px monospace') drawn.push(text); },
  }, { get: (target, name): unknown => Reflect.get(target, name) ?? ((): void => {}) }) as unknown as CanvasRenderingContext2D;
  const dialog = new CanvasDialog(ctx, new globalThis.EventTarget() as HTMLCanvasElement, 480, 320);
  try {
    for (const script of Object.values(LevelDialogs)) for (const conversation of script.conversations) {
      for (const page of conversation.pages) {
        let completed = 0;
        // Omit portrait loading; retain the actual speaker and its narrower layout.
        dialog.show({ conversations: [{ pages: [{ text: page.text, character: page.character }] }] }, () => { completed++; });
        const read: string[] = [];
        for (let press = 0; dialog.isActive() && press < 100; press++) {
          drawn = [];
          dialog.render();
          expect(drawn).not.toContain('...');
          expect(drawn.length).toBeLessThanOrEqual(7);
          read.push(...drawn);
          key(keys, 'Enter');
        }
        expect(completed).toBe(1);
        expect(read.join(' ').replace(/\s+/g, ' ').trim()).toBe(page.text.replace(/\s+/g, ' ').trim());
      }
    }
  } finally { dialog.hide(); globalThis.window = oldWindow; }
});

test('continuations retain page order, ignore repeats, survive resize and reset on replacement', () => {
  const oldWindow = globalThis.window;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof oldWindow;
  let drawn: string[] = [];
  const ctx = new Proxy({ font: '', measureText: (text: string): { width: number } => ({ width: text.length * 6.7 }),
    fillText: (text: string): void => { if (ctx.font === '11px monospace') drawn.push(text); },
  }, { get: (target, name): unknown => Reflect.get(target, name) ?? ((): void => {}) }) as unknown as CanvasRenderingContext2D;
  const dialog = new CanvasDialog(ctx, new globalThis.EventTarget() as HTMLCanvasElement, 480, 320);
  const long = Array.from({ length: 180 }, (_, i) => `word${i}`).join(' ');
  const render = (): string => { drawn = []; dialog.render(); return drawn.join(' '); };
  let completed = 0;
  try {
    dialog.show({ conversations: [{ pages: [{ text: long }, { text: 'Next page' }] },
      { pages: [{ text: 'Next conversation' }] }] }, () => { completed++; });
    const pieces = [render()];
    key(keys, 'Enter', true);
    expect(render()).toBe(pieces[0]);
    key(keys, 'Enter');
    dialog.setSize(400, 320);
    for (let i = 0; i < 20; i++) {
      const text = render();
      if (text === 'Next page') break;
      pieces.push(text);
      key(keys, 'Enter');
    }
    expect(pieces.join(' ')).toBe(long);
    expect(render()).toBe('Next page');
    expect(completed).toBe(0);
    key(keys, 'Enter');
    expect(render()).toBe('Next conversation');
    key(keys, 'Enter');
    expect(completed).toBe(1);

    dialog.show({ conversations: [{ pages: [{ text: long }] }] }, () => {}, () => {});
    key(keys, 'Enter');
    expect(render()).not.toStartWith('word0 ');
    key(keys, 'Escape');
    dialog.show(onePage, () => { completed++; });
    expect(render()).toBe('One page');
    key(keys, 'Enter');
    expect(completed).toBe(2);
  } finally { dialog.hide(); globalThis.window = oldWindow; }
});

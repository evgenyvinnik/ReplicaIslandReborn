import { expect, test } from 'bun:test';
import { CanvasPauseMenu } from './CanvasPauseMenu';
import { CanvasDialog } from './CanvasDialog';

test('a Pause overlay covered by the phone OS cannot resume from keyboard or pointer input', () => {
  const oldWindow = globalThis.window, oldImage = globalThis.Image;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof window;
  globalThis.Image = class {} as typeof Image;
  let covered = false, resumes = 0;
  const canvas = Object.assign(new globalThis.EventTarget(), { closest: () => covered ? {} : null }) as unknown as HTMLCanvasElement;
  const pause = new CanvasPauseMenu({} as CanvasRenderingContext2D, canvas, 480, 320);
  const enter = (): void => { keys.dispatchEvent(new globalThis.Event('keydown', { cancelable: true })); };
  try {
    pause.show(() => { resumes++; });
    covered = true;
    enter();
    canvas.dispatchEvent(new globalThis.Event('click', { cancelable: true }));
    canvas.dispatchEvent(new globalThis.Event('touchend', { cancelable: true }));
    expect(resumes).toBe(0);
    expect(pause.isShowing()).toBe(true);
    covered = false;
    enter();
    expect(resumes).toBe(1);
  } finally { pause.hide(); globalThis.window = oldWindow; globalThis.Image = oldImage; }
});

test('Pause ignores held-key repeat and consumes a fresh resume key', () => {
  const oldWindow = globalThis.window, oldImage = globalThis.Image;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof oldWindow;
  globalThis.Image = class {} as typeof Image;
  const menu = new CanvasPauseMenu({} as CanvasRenderingContext2D,
    new globalThis.EventTarget() as HTMLCanvasElement, 480, 320);
  let resumes = 0, leaked = 0;
  const send = (repeat: boolean): void => {
    const event = new globalThis.Event('keydown', { cancelable: true });
    Object.defineProperties(event, { key: { value: ' ' }, repeat: { value: repeat } });
    keys.dispatchEvent(event);
  };
  try {
    menu.show(() => { resumes++; });
    keys.addEventListener('keydown', () => { leaked++; });
    send(true);
    expect(menu.isShowing()).toBe(true);
    expect(resumes).toBe(0);
    expect(leaked).toBe(0);
    send(false);
    expect(menu.isShowing()).toBe(false);
    expect(resumes).toBe(1);
    expect(leaked).toBe(0);
    send(false);
    expect(resumes).toBe(1);
    expect(leaked).toBe(1);
  } finally {
    menu.hide(); globalThis.window = oldWindow; globalThis.Image = oldImage;
  }
});

test.each(['keyboard', 'click', 'touch'] as const)('Pause owns %s resume without advancing hidden dialogue', method => {
  const oldWindow = globalThis.window, oldImage = globalThis.Image;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof window;
  globalThis.Image = class {} as typeof Image;
  const canvas = new globalThis.EventTarget() as HTMLCanvasElement;
  const ctx = { measureText: (text: string) => ({ width: text.length * 7 }) } as CanvasRenderingContext2D;
  const dialog = new CanvasDialog(ctx, canvas, 480, 320);
  const pause = new CanvasPauseMenu(ctx, canvas, 480, 320);
  let resumes = 0, completes = 0;
  const enter = (): void => {
    const event = new globalThis.Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: 'Enter' });
    keys.dispatchEvent(event);
  };
  try {
    dialog.show({ conversations: [{ pages: [{ text: 'First' }, { text: 'Last' }] }] }, () => { completes++; });
    pause.show(() => { resumes++; }); // e.g. document became hidden during the conversation
    if (method === 'keyboard') enter();
    else if (method === 'click') canvas.dispatchEvent(new globalThis.Event('click', { cancelable: true }));
    else {
      canvas.dispatchEvent(new globalThis.Event('touchstart', { cancelable: true }));
      canvas.dispatchEvent(new globalThis.Event('touchend', { cancelable: true }));
    }
    expect(resumes).toBe(1);
    expect(completes).toBe(0);
    expect(dialog.isActive()).toBe(true);
    enter(); expect(completes).toBe(0);
    enter(); expect(completes).toBe(1);
  } finally { pause.hide(); dialog.hide(); globalThis.window = oldWindow; globalThis.Image = oldImage; }
});

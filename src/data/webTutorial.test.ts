import { expect, test } from 'bun:test';
import { LevelDialogs } from './dialogs';
import { KabochaDialogs } from './strings';
import { InputSystem } from '../engine/InputSystem';

test('the delivered tutorials explain web controls rather than Android-only hardware', () => {
  const pages = Object.entries(LevelDialogs).filter(([name]) => /^level_0_[23]_dialog_kabocha/.test(name))
    .flatMap(([, dialog]) => dialog.conversations.flatMap(conversation => conversation.pages));
  expect(pages.length).toBeGreaterThan(20);
  expect(pages.map(page => page.text).join('\n')).not.toMatch(/trackball|tilting the phone|do not need to press them constantly/i);
  const expected = {
    Kabocha_0_2_1_3: ['A/D', 'Left/Right', 'slider', 'default'],
    Kabocha_0_2_2_2: ['Space', 'blue button', 'hold'],
    Kabocha_0_2_5_3: ['X', 'red attack button', 'air'],
    Kabocha_0_3_2_1: ['X', 'red attack button', 'ground', 'hold'],
    Kabocha_0_3_2_2: ['WASD', 'arrows', 'left stick', 'round on-screen pad', 'X', 'return'],
  };
  for (const [key, terms] of Object.entries(expected)) {
    const text = KabochaDialogs[key];
    for (const term of terms) expect(text).toContain(term);
    expect(pages.some(page => page.text === text)).toBe(true);
  }
});

test('the keyboard defaults named in the tutorial drive the documented input actions', () => {
  const oldWindow = globalThis.window;
  const keys = new globalThis.EventTarget();
  globalThis.window = keys as unknown as typeof oldWindow;
  const input = new InputSystem({ touchGestures: false });
  input.initialize();
  try {
    const bindings = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump', KeyX: 'attack' } as const;
    for (const [code, action] of Object.entries(bindings)) {
      for (const type of ['keydown', 'keyup']) {
        const event = new globalThis.Event(type, { cancelable: true });
        Object.defineProperty(event, 'code', { value: code });
        keys.dispatchEvent(event);
        expect(input.getInputState()[action]).toBe(type === 'keydown');
      }
    }
  } finally { input.destroy(); globalThis.window = oldWindow; }
});

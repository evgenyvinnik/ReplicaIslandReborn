import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InputSystem } from './InputSystem';

const originalWindow = globalThis.window;
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let input: InputSystem;
let events: globalThis.EventTarget;
let pads: (globalThis.Gamepad | null)[];
let axes: number[];
let buttons: { pressed: boolean; touched: boolean; value: number }[];

beforeEach(() => {
  events = new globalThis.EventTarget();
  globalThis.window = events as unknown as typeof originalWindow;
  axes = [0, 0];
  buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  pads = [{ index: 0, connected: true, mapping: 'standard', axes, buttons } as unknown as globalThis.Gamepad];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => pads } });
  input = new InputSystem({ touchGestures: false });
  input.initialize();
});
afterEach(() => {
  input.destroy();
  globalThis.window = originalWindow;
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  else Reflect.deleteProperty(globalThis, 'navigator');
});

function send(type: string, fields: Record<string, unknown>): void {
  const event = new globalThis.Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
  events.dispatchEvent(event);
}

test('fresh menu/game receivers require release of controller buttons held during handoff', () => {
  input.destroy();
  input = new InputSystem({ touchGestures: false, blockInitialGamepadInput: true });
  input.initialize();
  buttons[0].pressed = true;
  axes[0] = 1;
  input.update();
  expect(input.isGamepadActionPressed('jump')).toBe(false);
  expect(input.getInputState().jump).toBe(false);
  expect(input.getInputState().horizontal).toBe(0);
  input.update();
  expect(input.isGamepadActionActive('right')).toBe(false);
  buttons[0].pressed = false;
  axes[0] = 0;
  input.update();
  buttons[0].pressed = true;
  axes[0] = 1;
  input.update();
  expect(input.isGamepadActionPressed('jump')).toBe(true);
  expect(input.getInputState().horizontal).toBe(1);
});

test('already-connected pads drive analogue movement, flight and attack without a connection event', () => {
  axes[0] = 0.5;
  axes[1] = -1;
  buttons[0].pressed = true;
  buttons[2].pressed = true;
  input.update();
  const state = input.getInputState();
  expect(state.horizontal).toBe(0.5);
  expect(state.right).toBe(true);
  expect(state.up).toBe(true);
  expect(state.jump).toBe(true);
  expect(state.attack).toBe(true);
  expect(input.isActionPressed('jump')).toBe(true);
  input.update();
  expect(input.isActionPressed('jump')).toBe(false);
  expect(input.isActionActive('jump')).toBe(true);
});

test('stick reversals clear the opposite direction and returning to the deadzone stops', () => {
  axes[0] = -1;
  axes[1] = -1;
  input.update();
  axes[0] = 1;
  axes[1] = 1;
  input.update();
  expect(input.getInputState().left).toBe(false);
  expect(input.getInputState().up).toBe(false);
  expect(input.getInputState().right).toBe(true);
  expect(input.getInputState().down).toBe(true);
  axes[0] = 0.15;
  axes[1] = 0.1;
  input.update();
  expect(input.getInputState().horizontal).toBe(0);
  expect(input.getInputState().down).toBe(false);
});

test('standard d-pad buttons supply full strength and vertical orb directions', () => {
  for (const [index, action, horizontal] of [[14, 'left', -1], [15, 'right', 1], [12, 'up', 0], [13, 'down', 0]] as const) {
    buttons.forEach(button => { button.pressed = false; });
    buttons[index].pressed = true;
    input.update();
    expect(input.isActionActive(action)).toBe(true);
    expect(input.getInputState().horizontal).toBe(horizontal);
  }
});

test.each(['event', 'missing', 'denied'])('%s disconnect clears controller inputs without clearing keyboard or touch', mode => {
  axes[0] = -1;
  buttons[0].pressed = true;
  buttons[1].pressed = true;
  input.update();
  send('keydown', { code: 'ArrowRight' });
  input.setVirtualButton('fly', true);
  if (mode === 'event') {
    send('gamepaddisconnected', { gamepad: pads[0] });
  } else {
    pads = [];
    if (mode === 'denied') Object.defineProperty(globalThis, 'navigator', {
      configurable: true, value: { getGamepads: () => { throw new Error('Access denied'); } },
    });
    input.update();
  }
  expect(input.getInputState().left).toBe(false);
  expect(input.getInputState().attack).toBe(false);
  expect(input.getInputState().right).toBe(true);
  expect(input.getInputState().jump).toBe(true);
  expect(input.getInputState().horizontal).toBe(1);
});

test('controller actions survive keyboard remapping and Start triggers once per press', () => {
  input.setKeyBindings({ jump: ['KeyQ'], pause: ['KeyR'] });
  buttons[0].pressed = true;
  buttons[9].pressed = true;
  input.update();
  expect(input.isJumpActive()).toBe(true);
  expect(input.isGamepadPausePressed()).toBe(true);
  expect(input.getInputState().pause).toBe(true);
  input.update();
  expect(input.isGamepadPausePressed()).toBe(false);
  buttons[9].pressed = false;
  input.update();
  expect(input.isActionReleased('pause')).toBe(true);
  buttons[9].pressed = true;
  input.update();
  expect(input.isGamepadPausePressed()).toBe(true);
});

test('Game polls controllers before the paused-state gate so Start can resume', () => {
  const source = readFileSync(join(import.meta.dir, '../components/Game.tsx'), 'utf8');
  const start = source.indexOf('// Poll controllers even while paused');
  expect(start).toBeGreaterThan(0);
  const block = source.slice(start, source.indexOf('// Get player and input state', start));
  expect(block.indexOf('inputSystem.update()')).toBeLessThan(block.indexOf('gameStateRef.current !== GameState.PLAYING'));
  expect(block).toContain('inputSystem.isGamepadPausePressed()');
  expect(block).toContain('resumeGame()');
  expect(block).toContain('pauseGame()');
});

test('a consumed controller press cannot become a new menu action across blur and focus', () => {
  buttons[0].pressed = true;
  input.update();
  input.consumeGamepadForMenu();
  send('blur', {});
  input.update();
  expect(input.isGamepadActionPressed('jump')).toBe(false);
  expect(input.getInputState().jump).toBe(false);
  send('focus', {});
  input.update();
  expect(input.isGamepadActionPressed('jump')).toBe(false);
  expect(input.getInputState().jump).toBe(false);
  buttons[0].pressed = false; input.update();
  buttons[0].pressed = true; input.update();
  expect(input.isGamepadActionPressed('jump')).toBe(true);
  expect(input.getInputState().jump).toBe(true);
});

test('unfocused controllers stay inert and focus requires release even if background polling stopped', () => {
  send('blur', {});
  axes[0] = 0.75; buttons[1].pressed = true;
  input.update();
  expect(input.getInputState().horizontal).toBe(0);
  expect(input.isGamepadActionActive('right')).toBe(false);
  expect(input.isGamepadActionPressed('attack')).toBe(false);
  // A different button was pressed while the browser stopped running frames.
  buttons[9].pressed = true;
  send('focus', {}); input.update();
  expect(input.isGamepadPausePressed()).toBe(false);
  expect(input.getInputState().attack).toBe(false);
  buttons[1].pressed = false; buttons[9].pressed = false; axes[0] = 0; input.update();
  buttons[9].pressed = true; axes[0] = -0.5; input.update();
  expect(input.isGamepadPausePressed()).toBe(true);
  expect(input.getInputState().horizontal).toBe(-0.5);
});

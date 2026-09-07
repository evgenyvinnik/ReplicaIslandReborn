import { afterEach, beforeEach, expect, test } from 'bun:test';
import { InputSystem } from './InputSystem';

const originalWindow = globalThis.window;
let events: globalThis.EventTarget;
let input: InputSystem;

beforeEach(() => {
  events = new globalThis.EventTarget();
  globalThis.window = events as unknown as typeof originalWindow;
  input = new InputSystem({ touchGestures: false });
  input.initialize();
});
afterEach(() => {
  input.destroy();
  globalThis.window = originalWindow;
});

function key(type: string, code: string): void {
  const event = new globalThis.Event(type, { cancelable: true });
  Object.defineProperty(event, 'code', { value: code });
  events.dispatchEvent(event);
}

test('keyboard press and release edges survive until exactly one simulation step', () => {
  key('keydown', 'Space');
  expect(input.isActionActive('jump')).toBe(true);
  input.update();
  expect(input.isActionPressed('jump')).toBe(true);
  input.update();
  expect(input.isActionPressed('jump')).toBe(false);
  expect(input.isActionActive('jump')).toBe(true);
  key('keydown', 'Space'); // OS repeat is not a new press.
  input.update();
  expect(input.isActionPressed('jump')).toBe(false);
  key('keyup', 'Space');
  input.update();
  expect(input.isActionReleased('jump')).toBe(true);
  expect(input.isActionActive('jump')).toBe(false);
  input.update();
  expect(input.isActionReleased('jump')).toBe(false);
});

test('a complete tap between frames is observable without leaving the button held', () => {
  key('keydown', 'KeyX');
  key('keyup', 'KeyX');
  input.update();
  expect(input.isActionPressed('attack')).toBe(true);
  expect(input.isActionReleased('attack')).toBe(true);
  expect(input.isActionActive('attack')).toBe(false);
  input.update();
  expect(input.isActionPressed('attack')).toBe(false);
  expect(input.isActionReleased('attack')).toBe(false);
});

test.each([['fly', 'jump'], ['stomp', 'attack']] as const)('%s touch input exposes %s edges like keyboard input', (button, action) => {
  input.setVirtualButton(button, true);
  input.update();
  expect(input.isActionPressed(action)).toBe(true);
  expect(input.isActionActive(action)).toBe(true);
  input.update();
  expect(input.isActionPressed(action)).toBe(false);
  input.setVirtualButton(button, false);
  input.update();
  expect(input.isActionReleased(action)).toBe(true);
  expect(input.isActionActive(action)).toBe(false);
});

test('blur clears queued and published edges as well as held controls', () => {
  key('keydown', 'KeyX');
  input.setVirtualButton('fly', true);
  events.dispatchEvent(new globalThis.Event('blur'));
  input.update();
  for (const action of ['jump', 'attack'] as const) {
    expect(input.isActionPressed(action)).toBe(false);
    expect(input.isActionReleased(action)).toBe(false);
    expect(input.isActionActive(action)).toBe(false);
  }
});

test('pause state preserves a keyboard edge for one step without repeating while held', () => {
  key('keydown', 'Escape');
  input.update();
  expect(input.getInputState().pause).toBe(true);
  expect(input.isGamepadPausePressed()).toBe(false);
  input.update();
  expect(input.getInputState().pause).toBe(false);
});

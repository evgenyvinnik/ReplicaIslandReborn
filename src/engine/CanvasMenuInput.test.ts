import { expect, test } from 'bun:test';
import { InputSystem } from './InputSystem';
import { CanvasMenuInput, type MenuCommand } from './CanvasMenuInput';
import { readFileSync } from 'node:fs';

test('controller modal input is edge-triggered, repeats navigation and cannot leak into gameplay', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  const pad = { connected: true, index: 0, axes: [0, 0], buttons };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [pad] } });
  const input = new InputSystem({ touchGestures: false });
  const menu = new CanvasMenuInput(input);
  const commands: MenuCommand[] = [];
  const target = { handleMenuCommand: (command: MenuCommand): void => { commands.push(command); } };
  const tick = (dt = 1 / 60): void => { input.update(); menu.update(target, dt); };
  try {
    buttons[0].pressed = true;
    tick();
    for (let i = 0; i < 60; i++) tick();
    expect(commands).toEqual(['confirm']);
    expect(input.isJumpActive()).toBe(false);
    expect(menu.update(null, 1 / 60)).toBe(false);
    input.update();
    expect(input.getInputState().jump).toBe(false);
    buttons[0].pressed = false; input.update();
    buttons[0].pressed = true; input.update();
    expect(input.getInputState().jump).toBe(true);
    buttons[0].pressed = false; tick();

    buttons[13].pressed = true; tick();
    tick(0.2);
    expect(commands).toEqual(['confirm', 'down']);
    tick(0.16); tick(0.11);
    expect(commands).toEqual(['confirm', 'down', 'down', 'down']);
    buttons[13].pressed = false; buttons[12].pressed = true; tick();
    expect(commands[commands.length - 1]).toBe('up');
    buttons[12].pressed = false; buttons[1].pressed = true; tick();
    expect(commands[commands.length - 1]).toBe('back');
    expect(input.getInputState().attack).toBe(false);
    buttons[1].pressed = false; buttons[9].pressed = true; tick();
    expect(commands.filter(command => command === 'back')).toHaveLength(2);
    pad.axes[0] = 0.5; tick();
    menu.update(null, 1 / 60); input.update();
    expect(input.getInputState().horizontal).toBe(0);
    expect(input.getInputState().right).toBe(false);
    pad.axes[0] = 0; input.update();
    pad.axes[0] = 0.5; input.update();
    expect(input.getInputState().horizontal).toBe(0.5);
    for (let i = 0; i < 60; i++) tick();
    expect(commands.filter(command => command === 'back')).toHaveLength(2);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('Game routes controller input to every canvas overlay before the playing-state gate', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('// Poll controllers even while paused');
  const block = source.slice(start, source.indexOf('// Get player and input state', start));
  expect(block).toContain('gamepadMenus.update(');
  expect(block.indexOf('gamepadMenus.update(')).toBeLessThan(block.indexOf('gameStateRef.current !== GameState.PLAYING'));
  for (const ref of ['canvasDialogRef', 'canvasDiaryRef', 'canvasCutsceneRef', 'canvasPauseMenuRef',
    'canvasLevelCompleteRef', 'canvasEndingStatsRef', 'canvasGameOverRef']) expect(block).toContain(ref);
});

test('DOM menus opt into horizontal repeat and a view handoff blocks held directions and confirmation', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  const pad = { connected: true, index: 0, axes: [0, 0], buttons };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [pad] } });
  const input = new InputSystem({ touchGestures: false });
  const menu = new CanvasMenuInput(input, true);
  const commands: MenuCommand[] = [];
  const target = { handleMenuCommand: (command: MenuCommand): void => { commands.push(command); } };
  const tick = (dt = 1 / 60): void => { input.update(); menu.update(target, dt); };
  try {
    pad.axes[0] = 1; tick(); tick(0.36);
    expect(commands).toEqual(['right', 'right']);
    buttons[0].pressed = true; tick();
    expect(commands[2]).toBe('confirm');
    input.blockHeldGamepadOnNextPoll(); menu.update(null, 0); tick(); tick(1);
    expect(commands).toEqual(['right', 'right', 'confirm']);
    buttons[0].pressed = false; pad.axes[0] = 0; tick();
    buttons[0].pressed = true; tick();
    expect(commands).toEqual(['right', 'right', 'confirm', 'confirm']);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

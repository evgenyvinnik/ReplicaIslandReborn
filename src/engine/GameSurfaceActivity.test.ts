import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { GameSurfaceActivity, isSurfaceActive } from './GameSurfaceActivity';
import { InputSystem } from './InputSystem';
import { GameLoop } from './GameLoop';
import { TimeSystem } from './TimeSystem';

const oldWindow = globalThis.window;
const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let keys: globalThis.EventTarget, input: InputSystem;
let covered: boolean, documentState: { hidden: boolean }, surface: globalThis.HTMLElement;
let buttons: { pressed: boolean }[];
beforeEach(() => {
  covered = false; documentState = { hidden: false };
  surface = { closest: () => covered ? {} : null, ownerDocument: documentState } as unknown as globalThis.HTMLElement;
  keys = new globalThis.EventTarget(); globalThis.window = keys as unknown as typeof window;
  buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    getGamepads: () => [{ connected: true, index: 0, mapping: 'standard', axes: [0, 0], buttons }],
  } });
  input = new InputSystem({ touchGestures: false, surface }); input.initialize();
});
afterEach(() => {
  input.destroy(); globalThis.window = oldWindow;
  if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
});
function key(type: string, code: string, repeat = false): void {
  const event = new globalThis.Event(type, { cancelable: true });
  Object.defineProperties(event, { code: { value: code }, repeat: { value: repeat } });
  keys.dispatchEvent(event);
}

test.each(['covered', 'hidden'])('%s surfaces freeze both fixed-step and display clocks, then resume once', condition => {
  let pauses = 0, resumes = 0, releases = 0, displayTime = 0;
  const activity = new GameSurfaceActivity(surface, input, {
    pauseAll: (): void => { pauses++; }, resumeAll: (): void => { resumes++; },
  }, () => { releases++; });
  const loop = new GameLoop(), clock = new TimeSystem();
  loop.setUpdateCallback(delta => { if (activity.allowFrame()) { input.update(); clock.update(delta); } });
  loop.setRenderCallback((_alpha, delta) => { if (activity.allowFrame()) displayTime += delta; });
  loop.step(60);
  const before = { game: clock.getGameTime(), display: displayTime };
  expect(before.game).toBeCloseTo(1);
  if (condition === 'covered') covered = true; else documentState.hidden = true;
  for (let i = 0; i < 120; i++) loop.step(1);
  expect(clock.getGameTime()).toBe(before.game);
  expect(displayTime).toBe(before.display);
  expect(pauses).toBe(1); expect(resumes).toBe(0); expect(releases).toBeGreaterThan(0);
  covered = false; documentState.hidden = false;
  loop.step(60);
  expect(clock.getGameTime()).toBeCloseTo(before.game + 1);
  expect(displayTime).toBeCloseTo(before.display + 1);
  expect(resumes).toBe(1);
});

test('suspension releases all input, rejects covered keys, and requires fresh keys/controller release on return', () => {
  const activity = new GameSurfaceActivity(surface, input, { pauseAll: (): void => undefined, resumeAll: (): void => undefined }, () => undefined);
  key('keydown', 'Space'); input.setVirtualButton('stomp', true); buttons[0].pressed = true; input.update();
  expect(input.getInputState().jump).toBe(true);
  covered = true; expect(activity.allowFrame()).toBe(false);
  key('keydown', 'KeyX');
  expect(input.getInputState().jump).toBe(false); expect(input.getInputState().attack).toBe(false);
  covered = false; expect(activity.allowFrame()).toBe(true);
  key('keydown', 'Space', true); input.update();
  expect(input.getInputState().jump).toBe(false);
  expect(input.isGamepadActionPressed('jump')).toBe(false);
  buttons[0].pressed = false; key('keyup', 'Space'); input.update();
  key('keydown', 'Space'); buttons[0].pressed = true; input.update();
  expect(input.getInputState().jump).toBe(true);
  expect(input.isGamepadActionPressed('jump')).toBe(true);
});

test('explicit visibility suspension blocks held controller input even without an intervening hidden frame', () => {
  const activity = new GameSurfaceActivity(surface, input, { pauseAll: (): void => undefined, resumeAll: (): void => undefined }, () => undefined);
  activity.suspend(); // visibilitychange, followed by browser rAF throttling.
  buttons[0].pressed = true;
  expect(activity.allowFrame()).toBe(true); input.update();
  expect(input.isGamepadActionPressed('jump')).toBe(false);
  expect(input.getInputState().jump).toBe(false);
  documentState.hidden = true;
  expect(isSurfaceActive(surface)).toBe(false);
});

test('Game guards update/render and all canvas readers, while every Recents exit shares the resume handler', () => {
  const game = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(game.match(/if \(!surfaceActivity.allowFrame\(\)\)/g)).toHaveLength(2);
  expect(game.indexOf('if (!surfaceActivity.allowFrame())')).toBeLessThan(game.indexOf('inputSystem.update()'));
  expect(game.includes('if (document.hidden) surfaceActivityRef.current?.suspend()')).toBe(true);
  expect(game.includes('isSurfaceActive(canvasRef.current)')).toBe(true);
  for (const name of ['CanvasDialog', 'CanvasCutscene', 'CanvasDiaryOverlay', 'CanvasPauseMenu', 'CanvasGameOverScreen', 'CanvasLevelCompleteScreen', 'CanvasEndingStatsScreen']) {
    const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8');
    expect(source).toMatch(/attachModalKeyboard\(this, [^;]+, this.canvas\)/);
  }
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  expect(app.match(/if \(osMode === 'recents'\) \{\s*handleAppLaunch\(\)/g)).toHaveLength(2);
  expect(app.includes('state.gameState === GameState.PAUSED && pausedByOsRef.current')).toBe(true);
});

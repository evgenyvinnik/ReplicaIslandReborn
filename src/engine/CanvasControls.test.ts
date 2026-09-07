import { afterEach, beforeEach, expect, test } from 'bun:test';
import { CanvasControls } from './CanvasControls';
import { InputSystem } from './InputSystem';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sSystemRegistry } from './SystemRegistry';
import { GameObjectFactory } from '../entities/GameObjectFactory';
import { GameObjectManager } from '../entities/GameObjectManager';

const originalWindow = globalThis.window;
let surface: globalThis.EventTarget;
let keys: globalThis.EventTarget;
let input: InputSystem;
let controls: CanvasControls;
let allowed: boolean;

beforeEach(() => {
  sSystemRegistry.reset();
  keys = new globalThis.EventTarget();
  Object.defineProperty(keys, 'innerWidth', { value: 1280 });
  globalThis.window = keys as unknown as typeof originalWindow;
  surface = new globalThis.EventTarget();
  Object.defineProperty(surface, 'getBoundingClientRect', {
    value: () => ({ left: 300, top: 100, width: 960, height: 640 }),
  });
  input = new InputSystem({ touchGestures: false });
  input.initialize();
  controls = new CanvasControls({} as CanvasRenderingContext2D, surface as HTMLCanvasElement, 480, 320);
  controls.setCallbacks(
    (x, y) => { input.setVirtualJoystick(x, y); },
    () => { input.setVirtualButton('fly', true); },
    () => { input.setVirtualButton('fly', false); },
    () => { input.setVirtualButton('stomp', true); },
    () => { input.setVirtualButton('stomp', false); },
  );
  allowed = true;
  controls.setInteractionAllowed(() => allowed);
  controls.attach();
});
afterEach(() => {
  controls.detach();
  input.destroy();
  globalThis.window = originalWindow;
  sSystemRegistry.reset();
});

function touch(id: number, x: number, y: number): { identifier: number; clientX: number; clientY: number } {
  return { identifier: id, clientX: 300 + x * 2, clientY: 100 + y * 2 };
}
function send(type: string, changed: ReturnType<typeof touch>[], held = changed): globalThis.Event {
  const event = new globalThis.Event(type, { cancelable: true });
  Object.defineProperties(event, { changedTouches: { value: changed }, touches: { value: held } });
  surface.dispatchEvent(event);
  // EventTarget has no DOM tree: explicitly deliver the canvas event to window too.
  keys.dispatchEvent(event);
  return event;
}

test('scaled canvas slider and action buttons independently own concurrent touches', () => {
  const slider = touch(1, 116, 260); // 75% slider position = half strength right
  const fly = touch(2, 440, 285);
  const stomp = touch(3, 440, 225);
  send('touchstart', [slider]);
  expect(input.getInputState().horizontal).toBe(0.5);
  send('touchstart', [fly], [slider, fly]);
  expect(input.getInputState().jump).toBe(true);
  send('touchstart', [stomp], [slider, fly, stomp]);
  expect(input.getInputState().attack).toBe(true);
  const moved = touch(1, 148, 260);
  send('touchmove', [moved], [moved, fly, stomp]);
  expect(input.getInputState().horizontal).toBe(1);
  send('touchend', [fly], [moved, stomp]);
  expect(input.getInputState().jump).toBe(false);
  expect(input.getInputState().attack).toBe(true);
  expect(input.getInputState().horizontal).toBe(1);
  send('touchcancel', [stomp], [moved]);
  expect(input.getInputState().attack).toBe(false);
  expect(input.getInputState().horizontal).toBe(1);
  send('touchend', [moved], []);
  expect(input.getInputState().horizontal).toBe(0);
});

test('a stomp touch on the right of the window never also triggers flight', () => {
  send('touchstart', [touch(1, 440, 225)]);
  expect(input.getInputState().attack).toBe(true);
  expect(input.getInputState().jump).toBe(false);
});

test.each([[84, 188, 0, -1], [84, 316, 0, 1], [20, 252, -1, 0], [148, 252, 1, 0]])(
  'orb pad at (%s,%s) steers the real possession orb on both axes', (x, y, dx, dy) => {
    const manager = new GameObjectManager();
    sSystemRegistry.register(manager, 'gameObject');
    sSystemRegistry.register(input, 'input');
    const factory = new GameObjectFactory(manager);
    factory.setSystemRegistry(sSystemRegistry);
    const orb = factory.spawnGhost(600, 600, 2)!;
    manager.commitUpdates();
    controls.setOrbControlMode(true);
    send('touchstart', [touch(1, x, y)]);
    for (let frame = 1; frame <= 60; frame++) orb.update(1 / 60, frame / 60);
    if (dx === 0) expect(orb.getPosition().x).toBe(600);
    else expect((orb.getPosition().x - 600) * dx).toBeGreaterThan(100);
    if (dy === 0) expect(orb.getPosition().y).toBe(600);
    else expect((orb.getPosition().y - 600) * dy).toBeGreaterThan(100);
    send('touchend', [touch(1, x, y)], []);
    expect(input.getInputState().horizontal).toBe(0);
    expect(input.getInputState().up).toBe(false);
    expect(input.getInputState().down).toBe(false);
  }
);

test('orb possession or release clears pad steering and restores horizontal-only movement', () => {
  controls.setOrbControlMode(true);
  const finger = touch(1, 148, 188);
  send('touchstart', [finger]);
  expect(input.getInputState().up).toBe(true);
  expect(input.getInputState().right).toBe(true);
  controls.setOrbControlMode(false);
  send('touchmove', [finger]); // old touch is no longer an owner
  expect(input.getInputState().up).toBe(false);
  expect(input.getInputState().right).toBe(false);
  send('touchstart', [touch(2, 148, 240)]);
  expect(input.getInputState().right).toBe(true);
  expect(input.getInputState().up).toBe(false);
  expect(input.getInputState().down).toBe(false);
});

test('two fingers on one button hold it until the last owner releases', () => {
  const first = touch(1, 440, 285);
  const second = touch(2, 430, 280);
  send('touchstart', [first, second]);
  send('touchend', [first], [second]);
  expect(input.getInputState().jump).toBe(true);
  send('touchend', [second], []);
  expect(input.getInputState().jump).toBe(false);
});

test('another finger cannot steal or release an active slider', () => {
  const first = touch(1, 148, 260);
  const second = touch(2, 20, 260);
  send('touchstart', [first]);
  send('touchstart', [second], [first, second]);
  expect(input.getInputState().horizontal).toBe(1);
  send('touchend', [second], [first]);
  expect(input.getInputState().horizontal).toBe(1);
});

test('mouse and touch owners do not release each other, and blur cancels dragging', () => {
  const mouse = (type: string, x: number, y: number, button = 0): void => {
    const event = new globalThis.Event(type);
    Object.defineProperties(event, {
      clientX: { value: 300 + x * 2 }, clientY: { value: 100 + y * 2 }, button: { value: button },
    });
    (type === 'mousedown' ? surface : keys).dispatchEvent(event);
  };
  mouse('mousedown', 440, 285, 2);
  expect(input.getInputState().jump).toBe(false);
  mouse('mousedown', 440, 285);
  const finger = touch(1, 440, 285);
  send('touchstart', [finger]);
  mouse('mouseup', 440, 285);
  expect(input.getInputState().jump).toBe(true);
  send('touchend', [finger], []);
  expect(input.getInputState().jump).toBe(false);
  mouse('mousedown', 148, 260);
  expect(input.getInputState().horizontal).toBe(1);
  keys.dispatchEvent(new globalThis.Event('blur'));
  mouse('mousemove', 20, 260);
  expect(input.getInputState().horizontal).toBe(0);
});

test.each(['detach', 'blur', 'overlay'])('%s cancels all held controls and ignores stale movement', mode => {
  const fingers = [touch(1, 148, 260), touch(2, 440, 285), touch(3, 440, 225)];
  send('touchstart', fingers);
  if (mode === 'detach') controls.detach();
  if (mode === 'blur') keys.dispatchEvent(new globalThis.Event('blur'));
  if (mode === 'overlay') {
    allowed = false;
    expect(send('touchmove', fingers).defaultPrevented).toBe(false);
  }
  send('touchmove', fingers);
  expect(input.getInputState().horizontal).toBe(0);
  expect(input.getInputState().jump).toBe(false);
  expect(input.getInputState().attack).toBe(false);
  if (mode === 'overlay') {
    expect(send('touchstart', fingers).defaultPrevented).toBe(false);
    expect(input.getInputState().jump).toBe(false);
  }
  allowed = true;
  controls.attach();
  send('touchstart', [touch(4, 440, 285)]);
  expect(input.getInputState().jump).toBe(true);
});

test('Game delegates touches exclusively to controls and gates them behind overlays', () => {
  const source = readFileSync(join(import.meta.dir, '../components/Game.tsx'), 'utf8');
  expect(source).toContain('new InputSystem({ touchGestures: false })');
  expect(source).toContain("setOrbControlMode(activeGhostRef.current?.type === 'ghost')");
  const gate = source.slice(source.indexOf('canvasControls.setInteractionAllowed('), source.indexOf('// Canvas Ending Stats Screen'));
  for (const overlay of ['canvasDialogRef', 'canvasCutsceneRef', 'canvasPauseMenuRef', 'canvasGameOverRef', 'canvasLevelCompleteRef', 'canvasDiaryRef', 'canvasEndingStatsRef']) {
    expect(gate).toContain(overlay);
  }
});

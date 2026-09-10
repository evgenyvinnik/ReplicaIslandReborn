import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { InputSystem } from './InputSystem';
import { CollisionSystem } from './CollisionSystemNew';
import { SystemRegistry } from './SystemRegistry';
import type { SoundSystem } from './SoundSystem';
import type { LevelSystem } from '../levels/LevelSystemNew';
import { GameObject } from '../entities/GameObject';
import { PlayerComponent } from '../entities/components/PlayerComponent';
import { GhostComponent, setGhostSystemRegistry } from '../entities/components/GhostComponent';
import { UIStrings } from '../data/strings';

const originalWindow = globalThis.window;
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let events: globalThis.EventTarget;
let input: InputSystem;
let axes: number[];
let buttons: { pressed: boolean }[];
beforeEach(() => {
  events = new globalThis.EventTarget();
  globalThis.window = events as unknown as typeof originalWindow;
  axes = [0, 0];
  buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    getGamepads: () => [{ connected: true, index: 0, mapping: 'standard', axes, buttons }],
  } });
  input = new InputSystem({ touchGestures: false });
  input.initialize();
});
afterEach(() => {
  input.destroy();
  globalThis.window = originalWindow;
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  else Reflect.deleteProperty(globalThis, 'navigator');
  setGhostSystemRegistry(new SystemRegistry());
});
function key(type: string, code: string): void {
  const event = new globalThis.Event(type, { cancelable: true });
  Object.defineProperty(event, 'code', { value: code });
  events.dispatchEvent(event);
}
function originalConstant(file: string, name: string): number {
  const source = readFileSync(new URL(`../../Original/src/com/replica/replicaisland/${file}.java`, import.meta.url), 'utf8');
  const match = source.match(new RegExp(`${name}\\s*=\\s*([\\d.]+)f`));
  if (!match) throw new Error(`Missing original constant ${name}`);
  return Number(match[1]);
}

test('Game applies saved controls on initialization and subsequent setting changes', () => {
  const game = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(game).toContain('inputSystem.setControlSettings(gameSettings.getAll())');
  expect(game).toContain('systemRegistryRef.current?.inputSystem?.setControlSettings(settings)');
  expect(game).toContain("gameSettings.get('keyBindings').pause.includes(e.code)");
});

test('saved remapping replaces default gameplay keys and sensitivity scales keys, pad and slider, not menus', () => {
  input.setControlSettings({ keyBindings: {
    left: ['KeyF'], right: ['KeyH'], up: ['KeyT'], down: ['KeyG'], jump: ['KeyQ'], attack: ['KeyE'], pause: ['KeyR'],
  }, movementSensitivity: 25 });
  key('keydown', 'Space'); key('keydown', 'ArrowRight'); input.update();
  expect(input.getInputState().jump).toBe(false);
  expect(input.getInputState().horizontal).toBe(0);
  key('keydown', 'KeyQ'); key('keydown', 'KeyH'); input.update();
  expect(input.getInputState().jump).toBe(true);
  expect(input.getInputState().horizontal).toBe(0.25);
  key('keyup', 'KeyH');
  axes[0] = -0.5; input.update();
  expect(input.getInputState().horizontal).toBe(-0.125);
  input.setVirtualAxis('horizontal', 0.4);
  expect(input.getInputState().horizontal).toBeCloseTo(0.1);
  input.setVirtualAxis('horizontal', 0);
  buttons[15].pressed = true; input.update();
  expect(input.getInputState().horizontal).toBe(0.25);
  input.setControlSettings({ movementSensitivity: 0 });
  expect(input.getInputState().horizontal).toBe(0);
  expect(input.isGamepadActionActive('right')).toBe(true);
  for (const [value, expected] of [[-10, 0], [150, 1], [NaN, 1], [Infinity, 1]]) {
    input.setControlSettings({ movementSensitivity: value });
    expect(input.getInputState().horizontal).toBe(expected);
  }
});

test('optional left-stick click attacks without becoming menu Back or disabling ordinary attacks', () => {
  input.setControlSettings({ clickAttackEnabled: true });
  buttons[10].pressed = true; input.update();
  expect(input.getInputState().attack).toBe(true);
  expect(input.isActionPressed('attack')).toBe(true);
  expect(input.isGamepadActionPressed('attack')).toBe(false);
  input.update();
  expect(input.isActionPressed('attack')).toBe(false);
  buttons[10].pressed = false; input.update();
  expect(input.isActionReleased('attack')).toBe(true);
  input.setControlSettings({ clickAttackEnabled: false });
  buttons[10].pressed = true; input.update();
  expect(input.getInputState().attack).toBe(false);
  expect(input.isActionPressed('attack')).toBe(false);
  buttons[1].pressed = true; input.update();
  expect(input.getInputState().attack).toBe(true);
  buttons[1].pressed = false; input.update();
  key('keydown', 'KeyX'); input.update();
  expect(input.getInputState().attack).toBe(true);
  key('keyup', 'KeyX'); input.setVirtualButton('stomp', true); input.update();
  expect(input.getInputState().attack).toBe(true);
});

test('stick click obeys held-input suppression after a menu handoff', () => {
  buttons[10].pressed = true;
  input.blockHeldGamepadOnNextPoll(); input.update();
  expect(input.getInputState().attack).toBe(false);
  input.update();
  expect(input.getInputState().attack).toBe(false);
  buttons[10].pressed = false; input.update();
  buttons[10].pressed = true; input.update();
  expect(input.getInputState().attack).toBe(true);
});

test.each(['keyboard', 'slider', 'controller'])('%s player acceleration uses saved sensitivity and the original input filter', source => {
  if (source === 'keyboard') key('keydown', 'ArrowRight');
  else if (source === 'slider') input.setVirtualAxis('horizontal', 1);
  else axes[0] = 1;
  input.update();
  const filter = originalConstant('InputGameInterface', source === 'keyboard' ? 'KEY_FILTER' : 'SLIDER_FILTER');
  for (const grounded of [false, true]) for (const sensitivity of [100, 50, 0]) {
    input.setControlSettings({ movementSensitivity: sensitivity });
    const player = new GameObject();
    player.width = 32; player.height = 48; player.getPosition().set(500, 500); player.setGameTime(1);
    if (grounded) player.setLastTouchedFloorTime(1);
    const component = new PlayerComponent();
    component.setSystems(input, new CollisionSystem(), { playSfx: () => undefined } as unknown as SoundSystem,
      { getLevelSize: () => ({ width: 4096, height: 4096 }) } as unknown as LevelSystem);
    component.update(1 / 120, player); // First step stays below the speed cap.
    const acceleration = originalConstant('PlayerComponent', grounded ? 'GROUND_IMPULSE_SPEED' : 'AIR_HORIZONTAL_IMPULSE_SPEED');
    expect(player.getVelocity().x).toBeCloseTo(filter * (sensitivity / 100) * acceleration / 120);
  }
});

test('possessed ground bodies retain analogue magnitude and the original directional-pad filter', () => {
  const registry = new SystemRegistry(); registry.register(input, 'input'); setGhostSystemRegistry(registry);
  const parent = new GameObject(); parent.life = 1;
  const ghost = new GhostComponent({ movementSpeed: 500 });
  const filter = originalConstant('InputGameInterface', 'SLIDER_FILTER');
  for (const push of [1, 0.5, 0.2, 0, -0.5, -1]) {
    input.setVirtualAxis('horizontal', push);
    ghost.update(1 / 60, parent);
    expect(parent.getTargetVelocity().x).toBeCloseTo(push * filter * 500);
  }
  input.setControlSettings({ movementSensitivity: 50 }); input.setVirtualAxis('horizontal', 1);
  ghost.update(1 / 60, parent);
  expect(parent.getTargetVelocity().x).toBeCloseTo(0.5 * filter * 500);
});

test('visible control help describes implemented web inputs and sensitivity limits', () => {
  const help = [UIStrings.preference_enable_click_attack_summary, UIStrings.preference_enable_screen_controls_summary,
    UIStrings.preference_movement_sensitivity_summary, UIStrings.preference_key_config_summary].join('\n');
  expect(help).not.toMatch(/trackball|optical sensor|hard keyboards|phones with/i);
  expect(UIStrings.preference_enable_click_attack_summary).toContain('L3');
  expect(UIStrings.preference_movement_sensitivity_summary).toContain('Does not change orb steering or menu navigation');
});

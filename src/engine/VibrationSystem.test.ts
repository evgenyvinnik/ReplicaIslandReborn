import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { VibrationSystem } from './VibrationSystem';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
});
function browser(value: unknown): void {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
}

test('unsupported and non-browser environments are harmless', () => {
  for (const environment of [undefined, {}]) {
    browser(environment);
    expect(() => {
      const vibration = new VibrationSystem();
      expect(vibration.isSupported()).toBe(false);
      vibration.vibrate(0.05);
      vibration.destroy();
    }).not.toThrow();
  }
});

test('the original stomp duration becomes one 50 ms device pulse', () => {
  const pulses: Array<number | number[]> = [];
  browser({ vibrate: (duration: number | number[]) => { pulses.push(duration); return true; } });
  const vibration = new VibrationSystem();
  expect(vibration.isSupported()).toBe(true);
  vibration.vibrate(0.05);
  expect(pulses).toEqual([50]);
  vibration.setEnabled(false);
  vibration.stopVibration(); // Repeated background frames must not spam the API.
  vibration.vibrate(0.05);
  expect(pulses).toEqual([50, 0]);
  vibration.setEnabled(true);
  vibration.vibrate(0.05);
  expect(pulses).toEqual([50, 0, 50]);
});

test('invalid durations and disconnected controllers never start rumble', () => {
  let pulses = 0;
  browser({ getGamepads: () => [{ connected: false, vibrationActuator: {
    playEffect: (): Promise<string> => { pulses++; return Promise.resolve('complete'); },
  } }] });
  const vibration = new VibrationSystem();
  expect(vibration.isSupported()).toBe(false);
  for (const duration of [NaN, Infinity, -1, 0, 0.05]) vibration.vibrate(duration);
  expect(pulses).toBe(0);
});

test('denied vibration and gamepad access do not interrupt gameplay', () => {
  browser({ vibrate: () => { throw new Error('denied'); }, getGamepads: () => { throw new Error('denied'); } });
  const vibration = new VibrationSystem();
  expect(() => vibration.vibrate(0.05)).not.toThrow();
  expect(() => vibration.destroy()).not.toThrow();
});

test.each(['reset', 'destroy', 'disable'] as const)('%s stops the controller that received the pulse', async stop => {
  const pulses: unknown[] = [];
  let resets = 0;
  const actuator = {
    playEffect: (effect: string, params: unknown): Promise<string> => { pulses.push([effect, params]); return Promise.resolve('complete'); },
    reset: (): Promise<string> => { resets++; return Promise.resolve('complete'); },
  };
  let pads: unknown[] = [{ connected: true, vibrationActuator: actuator }];
  browser({ getGamepads: () => pads });
  const vibration = new VibrationSystem();
  expect(vibration.isSupported()).toBe(true);
  vibration.vibrate(0.05);
  expect(pulses).toEqual([['dual-rumble', { duration: 50, strongMagnitude: 1, weakMagnitude: 0.5 }]]);
  pads = []; // A disconnected pad must still receive best-effort cancellation.
  if (stop === 'disable') vibration.setEnabled(false); else vibration[stop]();
  await Promise.resolve();
  expect(resets).toBe(1);
});

test('rejected controller play/reset promises are handled', async () => {
  browser({ getGamepads: () => [{ connected: true, vibrationActuator: {
    playEffect: (): Promise<string> => Promise.reject(new Error('unsupported effect')),
    reset: (): Promise<string> => Promise.reject(new Error('disconnected')),
  } }] });
  const vibration = new VibrationSystem();
  vibration.vibrate(0.05);
  await Promise.resolve();
  vibration.destroy();
  await Promise.resolve();
});

test('game creates haptics and cancels them on pause, surface suspension and teardown', () => {
  const game = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  expect(game).toContain('const vibrationSystem = new VibrationSystem()');
  expect(game).toContain("systemRegistry.register(vibrationSystem, 'vibration')");
  const pause = game.slice(game.indexOf('// Handle Canvas Pause Menu'), game.indexOf('// Handle Canvas Game Over'));
  expect(pause).toContain('vibrationSystem?.stopVibration()');
  const suspend = game.slice(game.indexOf('const surfaceActivity = new GameSurfaceActivity'), game.indexOf('surfaceActivityRef.current = surfaceActivity'));
  expect(suspend).toContain('vibrationSystem.stopVibration()');
  expect(game).toContain('vibrationSystem.destroy()');
});

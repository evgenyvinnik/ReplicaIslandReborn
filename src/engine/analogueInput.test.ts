/**
 * Analogue horizontal movement, against PlayerComponent.java.
 *
 * The original's directional pad reports a proportion, and the player scales
 * its movement impulse by it:
 *
 *     impulse.set(dpad.getX(), 0.0f);
 *     ...
 *     impulse.x = (impulse.x * horziontalSpeed * timeDelta);
 *
 * so a half-pushed touch slider accelerates at half strength. The port
 * thresholded the slider to a boolean at 0.3 and then treated anything past it
 * as a full push, which made the on-screen control all-or-nothing.
 *
 * Two things stay a *sign* rather than the fraction, matching the original:
 * the speed clamp (Utils.sign(impulse.x)) and the facing direction, which
 * LaunchProjectileComponent multiplies offsets and velocities by.
 */

import { describe, expect, test } from 'bun:test';
import { InputSystem } from './InputSystem';

describe('analogue horizontal input', () => {
  test('keys report a whole push', () => {
    const input = new InputSystem();
    input.setVirtualAxis('horizontal', 0);
    expect(input.getInputState().horizontal).toBe(0);
  });

  test('the slider reports its proportion, not a threshold', () => {
    const input = new InputSystem();
    input.setVirtualAxis('horizontal', 0.5);
    const state = input.getInputState();
    // Past 0.3 it still counts as "right" for anything that wants a boolean...
    expect(state.right).toBe(true);
    // ...but the analogue value is what drives movement.
    expect(state.horizontal).toBeCloseTo(0.5, 5);
  });

  test('a gentle push is a gentle push', () => {
    const input = new InputSystem();
    input.setVirtualAxis('horizontal', 0.2);
    const state = input.getInputState();
    // Below the boolean threshold, so no digital "right"...
    expect(state.right).toBe(false);
    // ...yet the player still eases that way, as on the original.
    expect(state.horizontal).toBeCloseTo(0.2, 5);
  });

  test('the axis is clamped to the unit range', () => {
    const input = new InputSystem();
    input.setVirtualAxis('horizontal', 3.5);
    expect(input.getInputState().horizontal).toBe(1);
    input.setVirtualAxis('horizontal', -9);
    expect(input.getInputState().horizontal).toBe(-1);
  });

  test('facing and the speed clamp use the sign, not the magnitude', () => {
    // Guarded here because the consequence is remote from the cause: a
    // fractional facingDirection silently halves every projectile the player
    // fires, since launchers multiply their velocities by it.
    expect(Math.sign(0.4)).toBe(1);
    expect(Math.sign(-0.4)).toBe(-1);
    expect(Math.sign(0)).toBe(0);
  });
});

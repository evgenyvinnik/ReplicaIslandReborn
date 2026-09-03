/**
 * Andou's movement constants, checked against PlayerComponent.java.
 *
 * These are the feel of the game. They are also the easiest thing to drift
 * without anyone noticing, because a wrong value still plays - it just plays
 * differently. Every number here is transcribed from the original; the only
 * legitimate difference is the sign of anything vertical, because the original
 * is Y-up and this port is Y-down.
 */

import { describe, expect, test } from 'bun:test';
import { PlayerComponent } from './PlayerComponent';

describe('player constants', () => {
  test('movement matches the original', () => {
    expect(PlayerComponent.GROUND_IMPULSE_SPEED).toBe(5000);
    expect(PlayerComponent.AIR_HORIZONTAL_IMPULSE_SPEED).toBe(4000);
    expect(PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED).toBe(1200);
    expect(PlayerComponent.AIR_VERTICAL_IMPULSE_FROM_GROUND).toBe(250);
    expect(PlayerComponent.AIR_DRAG_SPEED).toBe(4000);
    expect(PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED).toBe(500);
    expect(PlayerComponent.MAX_AIR_HORIZONTAL_SPEED).toBe(150);
    expect(PlayerComponent.MAX_UPWARD_SPEED).toBe(250);
    expect(PlayerComponent.VERTICAL_IMPULSE_TOLERANCE).toBe(50);
  });

  test('fuel and jets match the original', () => {
    expect(PlayerComponent.FUEL_AMOUNT).toBe(1.0);
    expect(PlayerComponent.JUMP_TO_JETS_DELAY).toBe(0.5);
  });

  test('the stomp matches the original', () => {
    // Original: STOMP_VELOCITY = -1000 in Y-up, which is downward. This port is
    // Y-down, so the same motion is +1000 - the sign is the conversion, not a
    // discrepancy.
    expect(Math.abs(PlayerComponent.STOMP_VELOCITY)).toBe(1000);
    expect(PlayerComponent.STOMP_DELAY_TIME).toBe(0.15);
    expect(PlayerComponent.STOMP_AIR_HANG_TIME).toBe(0);
    expect(PlayerComponent.STOMP_SHAKE_MAGNITUDE).toBe(15);
    expect(PlayerComponent.STOMP_VIBRATE_TIME).toBe(0.05);
    expect(PlayerComponent.HIT_REACT_TIME).toBe(0.5);
  });

  test('the ghost matches the original', () => {
    expect(PlayerComponent.GHOST_REACTIVATION_DELAY).toBe(0.3);
    expect(PlayerComponent.GHOST_CHARGE_TIME).toBe(0.75);
    expect(PlayerComponent.MAX_GEMS_PER_LEVEL).toBe(3);
    expect(PlayerComponent.NO_GEMS_GHOST_TIME).toBe(3.0);
    expect(PlayerComponent.ONE_GEM_GHOST_TIME).toBe(8.0);
    // Zero means unlimited with two gems, not "no ghost".
    expect(PlayerComponent.TWO_GEMS_GHOST_TIME).toBe(0);
  });

  test('a jump is airborne on the frame it happens, a jet frame is not', () => {
    // The tolerance exists to separate these two cases: leaving the ground
    // switches you to air control immediately, but a single frame of jet
    // thrust does not re-trigger that decision.
    const jumpImpulse = PlayerComponent.AIR_VERTICAL_IMPULSE_FROM_GROUND;
    const oneJetFrame = PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED * (1 / 60);
    expect(jumpImpulse).toBeGreaterThan(PlayerComponent.VERTICAL_IMPULSE_TOLERANCE);
    expect(oneJetFrame).toBeLessThan(PlayerComponent.VERTICAL_IMPULSE_TOLERANCE);
  });
});

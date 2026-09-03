/**
 * The jetpack's upward speed cap.
 *
 * The original:
 *
 *     if (velocity.y + impulse.y > MAX_UPWARD_SPEED && sign(impulse.y) > 0) {
 *         impulse.y = 0.0f;
 *         if (velocity.y < MAX_UPWARD_SPEED) velocity.y = MAX_UPWARD_SPEED;
 *     }
 *
 * Two things that a plain `clamp(velocity)` loses. It drops the *thrust*
 * rather than the speed, and the inner test only ever raises velocity *up to*
 * the cap - never down. So something already rising faster than the cap keeps
 * its speed: a cannon's LAUNCH throws Andou well past 250, and holding fly on
 * the way up must not brake him to 250.
 *
 * The port clamped velocity outright, which did exactly that.
 */

import { expect, test } from 'bun:test';
import { PlayerComponent } from './components/PlayerComponent';

const MAX = PlayerComponent.MAX_UPWARD_SPEED;

/** The original's rule, in its own Y-up terms. Returns the resulting velocity. */
function originalYUp(velocityY: number, impulseY: number): number {
  let v = velocityY;
  let i = impulseY;
  if (v + i > MAX && Math.sign(i) > 0) {
    i = 0;
    if (v < MAX) v = MAX;
  }
  return v + i;
}

/** The port's rule, in Y-down terms (up is negative). */
function portYDown(velocityY: number, thrustY: number): number {
  let v = velocityY;
  let t = thrustY;
  if (v + t < -MAX && t < 0) {
    t = 0;
    if (v > -MAX) v = -MAX;
  }
  return v + t;
}

test('the converted cap agrees with the original across the range', () => {
  const thrustPerFrame = (PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED * 1) / 60;
  const disagreements: string[] = [];

  for (let vUp = -800; vUp <= 800; vUp += 5) {
    for (const iUp of [0, thrustPerFrame, thrustPerFrame / 2, 250]) {
      const original = originalYUp(vUp, iUp);
      // Same physical state, expressed downward.
      const port = portYDown(-vUp, -iUp);
      if (Math.abs(original - -port) > 1e-9) {
        disagreements.push(`v=${vUp} i=${iUp}: original=${original} port=${-port}`);
      }
    }
  }

  expect(disagreements).toEqual([]);
});

test('thrust from below the cap accelerates, but not past it', () => {
  const thrust = -PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED / 60;
  // Rising slowly: the jets add speed.
  expect(portYDown(-100, thrust)).toBeLessThan(-100);
  // Just under the cap: the thrust is dropped and the speed pinned at the cap.
  expect(portYDown(-MAX + 5, thrust)).toBe(-MAX);
});

test('a launch faster than the cap is not braked by holding fly', () => {
  const thrust = -PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED / 60;
  // A cannon LAUNCH well past the cap.
  for (const launched of [-300, -500, -700, -1000]) {
    expect(portYDown(launched, thrust)).toBe(launched);
  }
});

test('falling is untouched by the upward cap', () => {
  const thrust = -PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED / 60;
  // Descending (positive in Y-down): the thrust applies normally.
  expect(portYDown(300, thrust)).toBeCloseTo(300 + thrust, 6);
});

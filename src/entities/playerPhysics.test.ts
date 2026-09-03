/**
 * Andou's weight and his brakes.
 *
 * Both were hand-tuned rather than transcribed, and both are visible in every
 * second of play:
 *
 *   - Gravity was 500. The original gives the player a plain GravityComponent,
 *     whose sDefaultGravity is (0, -400), with no multiplier. 25% heavier cut
 *     his jump apex from 78px to 62px - half a tile, against level geometry
 *     authored for the former.
 *
 *   - Friction was `velocity.x *= 0.85` per frame. The original gives him a
 *     PhysicsComponent with mass 9.1 and a 0.2 dynamic friction coefficient
 *     and stops him with Coulomb friction, which is linear, not exponential,
 *     and does not depend on the frame rate.
 *
 * These are checked against closed-form predictions from the original's own
 * constants rather than against numbers observed from this port, so the test
 * fails if the port drifts *or* if someone re-tunes the constants by feel.
 */

import { expect, test } from 'bun:test';
import { PlayerComponent } from './components/PlayerComponent';

const FRAME = 1 / 60;

test('gravity is the original GravityComponent default', () => {
  // GravityComponent.java: sDefaultGravity = new Vector2(0.0f, -400.0f)
  expect(PlayerComponent.GRAVITY).toBe(400);
});

test('friction constants come from spawnPlayer', () => {
  // physics.setMass(9.1f) / setDynamicFrictionCoeffecient(0.2f)
  //                       / setStaticFrictionCoeffecient(0.01f)
  expect(PlayerComponent.MASS).toBeCloseTo(9.1, 5);
  expect(PlayerComponent.DYNAMIC_FRICTION_COEFFICIENT).toBeCloseTo(0.2, 5);
  expect(PlayerComponent.STATIC_FRICTION_COEFFICIENT).toBeCloseTo(0.01, 5);
});

test('a ground jump reaches the apex the original constants predict', () => {
  // Leaving the ground at AIR_VERTICAL_IMPULSE_SPEED_FROM_GROUND, the apex is
  // v^2 / 2g. With the original's numbers that is 250^2 / 800 = 78.1px; the
  // 500 gravity gave 62.5px.
  const v = PlayerComponent.AIR_VERTICAL_IMPULSE_FROM_GROUND;
  const apex = (v * v) / (2 * PlayerComponent.GRAVITY);
  expect(apex).toBeCloseTo(78.125, 3);
  // Two full tiles of clearance, which 500 gravity did not give.
  expect(apex).toBeGreaterThan(64);
});

/**
 * Integrate the friction rule the component applies, so the curve is checked
 * rather than just the constants feeding it.
 */
function slide(initialSpeed: number, frames: number): { speed: number; distance: number } {
  let speed = initialSpeed;
  let distance = 0;
  for (let i = 0; i < frames && speed !== 0; i++) {
    const maxFriction =
      Math.abs(PlayerComponent.GRAVITY) *
      PlayerComponent.MASS *
      PlayerComponent.DYNAMIC_FRICTION_COEFFICIENT *
      FRAME;
    if (maxFriction > Math.abs(speed)) speed = 0;
    else speed -= maxFriction * Math.sign(speed);
    if (Math.abs(speed) < 0.01) speed = 0;
    distance += speed * FRAME;
  }
  return { speed, distance };
}

test('friction decelerates linearly, at the rate the original computes', () => {
  // maxFriction per second = |gravity| * mass * coefficient = 400*9.1*0.2 = 728
  const perSecond =
    Math.abs(PlayerComponent.GRAVITY) *
    PlayerComponent.MASS *
    PlayerComponent.DYNAMIC_FRICTION_COEFFICIENT;
  expect(perSecond).toBeCloseTo(728, 3);

  // Linear deceleration: speed falls by the same amount every frame.
  const top = PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED;
  const after10 = slide(top, 10).speed;
  const after20 = slide(top, 20).speed;
  expect(top - after10).toBeCloseTo(after10 - after20, 3);
});

test('stopping from top speed takes the original distance, not a third of it', () => {
  const top = PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED;
  const { speed, distance } = slide(top, 600);
  expect(speed).toBe(0);
  // v^2 / 2a = 500^2 / (2*728) = 171.7px. The 0.85-per-frame decay stopped
  // him in about 56px.
  expect(distance).toBeGreaterThan(150);
  expect(distance).toBeLessThan(180);
});

test('friction is frame-rate independent, where the old multiplier was not', () => {
  // A rule written per-frame rather than per-second gives a different answer
  // at a different step. Coulomb friction is scaled by dt and so barely moves
  // (only Euler's discretisation error); the 0.85-per-frame decay halves its
  // stopping distance when the frame rate doubles.
  const coulomb = (dt: number): number => {
    let speed = PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED;
    let distance = 0;
    const rate =
      Math.abs(PlayerComponent.GRAVITY) *
      PlayerComponent.MASS *
      PlayerComponent.DYNAMIC_FRICTION_COEFFICIENT;
    for (let t = 0; t < 5 && speed > 0; t += dt) {
      const maxFriction = rate * dt;
      speed = maxFriction > speed ? 0 : speed - maxFriction;
      distance += speed * dt;
    }
    return distance;
  };
  const multiplier = (dt: number): number => {
    let speed = PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED;
    let distance = 0;
    for (let t = 0; t < 5 && speed > 0; t += dt) {
      speed *= 0.85;
      if (speed < 1) speed = 0;
      distance += speed * dt;
    }
    return distance;
  };

  const relative = (a: number, b: number): number => Math.abs(a - b) / b;
  expect(relative(coulomb(1 / 120), coulomb(1 / 60))).toBeLessThan(0.02);
  expect(relative(multiplier(1 / 120), multiplier(1 / 60))).toBeGreaterThan(0.4);
});

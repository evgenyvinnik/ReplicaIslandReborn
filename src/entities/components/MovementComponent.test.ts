import { describe, expect, test } from 'bun:test';
import { GameObject } from '../GameObject';
import { MovementComponent } from './MovementComponent';
import { CollisionSystem } from '../../engine/CollisionSystemNew';
import { file } from 'bun';

describe('MovementComponent impulses', () => {
  test('consumes scripted impulses before integrating movement', () => {
    const object = new GameObject();
    const movement = new MovementComponent();
    object.getImpulse().set(100, -170);

    movement.update(0, object);

    expect(object.getVelocity().x).toBe(100);
    expect(object.getVelocity().y).toBe(-170);
    expect(object.getImpulse().x).toBe(0);
    expect(object.getImpulse().y).toBe(0);
  });

  test('still consumes impulses while an animation locks position', () => {
    const object = new GameObject();
    const movement = new MovementComponent();
    object.positionLocked = true;
    object.setPosition(12, 34);
    object.getImpulse().set(-25, 40);

    movement.update(1, object);

    expect(object.getVelocity().x).toBe(-25);
    expect(object.getVelocity().y).toBe(40);
    expect(object.getPosition().x).toBe(12);
    expect(object.getPosition().y).toBe(34);
    expect(object.getImpulse().lengthSquared()).toBe(0);
  });
});

describe('MovementComponent original velocity integration', () => {
  for (const [name, current, target, acceleration, dt, offset, finalVelocity] of [
    ['acceleration', 0, 100, 20, 0.5, 2.5, 10],
    ['deceleration', 100, 0, 20, 0.5, 47.5, 90],
    ['stopping frame', 100, 0, 100, 1, 50, 0],
    ['target overshoot', 90, 100, 100, 0.5, 57.5, 100],
    ['direction reversal', 10, -20, 30, 0.5, 1.25, -5],
    ['zero acceleration', 25, 0, 0, 0.5, 12.5, 25],
    ['near-target epsilon', 10.00005, 10, 100, 0.5, 5.000025, 10.00005],
  ] as const) {
    test(`${name} matches Android displacement and end velocity on both axes`, () => {
      const object = new GameObject();
      const movement = new MovementComponent();
      object.setPosition(12, 34);
      object.setVelocity(current, -current);
      object.setTargetVelocity(target, -target);
      object.setAcceleration(acceleration, acceleration);
      movement.update(dt, object);
      expect(object.getPosition().x).toBeCloseTo(12 + offset, 7);
      expect(object.getPosition().y).toBeCloseTo(34 - offset, 7);
      expect(object.getVelocity().x).toBeCloseTo(finalVelocity, 7);
      expect(object.getVelocity().y).toBeCloseTo(-finalVelocity, 7);
    });
  }

  test('animation-locked motion still interpolates velocity after consuming impulses', () => {
    const object = new GameObject();
    const movement = new MovementComponent();
    object.positionLocked = true;
    object.setPosition(12, 34);
    object.getImpulse().set(10, -10);
    object.setTargetVelocity(100, -100);
    object.setAcceleration(20, 20);
    movement.update(0.5, object);
    expect(object.getPosition().x).toBe(12);
    expect(object.getPosition().y).toBe(34);
    expect(object.getVelocity().x).toBe(20);
    expect(object.getVelocity().y).toBe(-20);
    expect(object.getImpulse().lengthSquared()).toBe(0);
    object.positionLocked = false;
    movement.update(0.5, object);
    expect(object.getPosition().x).toBe(24.5);
    expect(object.getPosition().y).toBe(21.5);
  });
});

async function room(): Promise<MovementComponent> {
  const collision = new CollisionSystem();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(await file(
      new URL('../../../public/assets/collision.json', import.meta.url)
    ).arrayBuffer())) as unknown as typeof fetch;
    expect(await collision.loadCollisionData('/assets/collision.json')).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  collision.setTileCollision(Array.from({ length: 400 }, (_, i) =>
    i % 20 === 0 || i % 20 === 19 || i < 20 || i >= 380 ? 1 : -1), 20, 20, 32, 32);
  const movement = new MovementComponent();
  movement.setCollisionSystem(collision);
  return movement;
}

test('the integrated stopping frame still collides with tiles on all four sides', async () => {
  const movement = await room();
  for (const [x, y, dx, dy, expectedX, expectedY] of [
    [570, 250, 1, 0, 575.9, 250],
    [38, 250, -1, 0, 32.1, 250],
    [250, 570, 0, 1, 250, 576],
    [250, 38, 0, -1, 250, 32],
  ]) {
    const object = new GameObject();
    object.width = object.height = 32;
    object.setPosition(x, y);
    object.setVelocity(dx * 100, dy * 100);
    object.setAcceleration(Math.abs(dx) * 100, Math.abs(dy) * 100);
    object.setGameTime(1);
    movement.update(1, object);
    expect(object.getPosition().x).toBeCloseTo(expectedX);
    expect(object.getPosition().y).toBeCloseTo(expectedY);
    expect(object.getVelocity().lengthSquared()).toBe(0);
  }
});

test('a reversal-frame wall collision does not bounce velocity already pointing away', async () => {
  const movement = await room();
  movement.setBounciness(0.4);
  const object = new GameObject();
  object.width = object.height = 32;
  object.setPosition(574.9, 250);
  object.setVelocity(10, 0);
  object.setTargetVelocity(-20, 0);
  object.setAcceleration(30, 0);
  object.setGameTime(1);
  movement.update(0.5, object);
  expect(object.getPosition().x).toBeCloseTo(575.9);
  expect(object.getVelocity().x).toBe(-5);
  expect(object.touchingRightWall()).toBe(true);
});

import { describe, expect, test } from 'bun:test';
import { GameObject } from '../GameObject';
import { MovementComponent } from './MovementComponent';

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

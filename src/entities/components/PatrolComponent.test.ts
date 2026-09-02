import { describe, expect, test } from 'bun:test';
import { ActionType } from '../../types';
import { GameObject } from '../GameObject';
import { PatrolComponent } from './PatrolComponent';

function makeFlyingPatrol(verticalVelocity: number): {
  object: GameObject;
  patrol: PatrolComponent;
} {
  const object = new GameObject();
  object.life = 1;
  object.setCurrentAction(ActionType.MOVE);
  object.setGameTime(1);
  object.getTargetVelocity().y = verticalVelocity;
  const patrol = new PatrolComponent({ maxSpeed: 100, acceleration: 300, flying: true });
  return { object, patrol };
}

describe('PatrolComponent Canvas coordinates', () => {
  test('a descending flyer reverses upward when it reaches the floor', () => {
    const { object, patrol } = makeFlyingPatrol(50);
    object.setLastTouchedFloorTime(1);

    patrol.update(0, object);

    expect(object.getTargetVelocity().y).toBe(-100);
  });

  test('an ascending flyer reverses downward when it reaches the ceiling', () => {
    const { object, patrol } = makeFlyingPatrol(-50);
    object.setLastTouchedCeilingTime(1);

    patrol.update(0, object);

    expect(object.getTargetVelocity().y).toBe(100);
  });
});

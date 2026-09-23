import { expect, test } from 'bun:test';
import { GameObject } from './GameObject';

test('fresh objects do not report phantom surface contact during startup', () => {
  const object = new GameObject();
  // Android GameObject requires gameTime > 0.1 before consulting its
  // 0.3-second contact stamps. All stamps start at zero on a fresh object.
  object.setGameTime(0.05);
  expect(object.touchingGround()).toBe(false);
  expect(object.touchingCeiling()).toBe(false);
  expect(object.touchingLeftWall()).toBe(false);
  expect(object.touchingRightWall()).toBe(false);

  object.setLastTouchedFloorTime(0.05);
  expect(object.touchingGround()).toBe(false);
  object.setGameTime(0.11);
  object.setLastTouchedFloorTime(0.11);
  expect(object.touchingGround()).toBe(true);
});

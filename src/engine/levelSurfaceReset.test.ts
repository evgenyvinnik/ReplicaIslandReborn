import { expect, test } from 'bun:test';
import { CollisionSystem } from './CollisionSystemNew';

test('a new map discards both active and queued surfaces from the old level', () => {
  const collision = new CollisionSystem();
  collision.setTileCollision(Array(16).fill(-1), 4, 4, 32, 32);

  // One old gate is already collidable; another was submitted by the old
  // object's update just before a scripted exit began loading the new map.
  collision.addTemporarySurface(64, 0, 64, 64, -1, 0);
  collision.updateTemporarySurfaces();
  collision.addTemporarySurface(96, 0, 96, 64, -1, 0);
  expect(collision.getTemporarySurfaces()).toHaveLength(1);
  expect(collision.raycast(32, 32, 1, 0, 80).hit).toBe(true);

  collision.setTileCollision(Array(16).fill(-1), 4, 4, 32, 32);
  expect(collision.getTemporarySurfaces()).toHaveLength(0);
  expect(collision.raycast(32, 32, 1, 0, 80).hit).toBe(false);

  collision.updateTemporarySurfaces();
  expect(collision.getTemporarySurfaces()).toHaveLength(0);
  expect(collision.raycast(32, 32, 1, 0, 80).hit).toBe(false);
});

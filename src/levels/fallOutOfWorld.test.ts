/**
 * Falling out of the world.
 *
 * The original kills anything that leaves the bottom of the level:
 *
 *     if (parentObject.getPosition().y < -parentObject.height)
 *
 * That reads "entirely below the level" only in its Y-up space, where the
 * world floor is y=0 and position.y is the object's *bottom*. Canvas puts the
 * floor at levelHeight and position.y at the object's *top*, which makes the
 * same test `position.y > levelHeight`.
 *
 * Copied across unconverted - which is what both the player path and
 * GhostComponent did - the test fires only when something climbs far above
 * the level, and never when it falls. A pit with no DIE tiles in it therefore
 * left Andou falling forever at full health with no way to restart: not a
 * death, a soft-lock.
 *
 * This pins the rule itself rather than the wiring, so it stays true wherever
 * the check lives.
 */

import { expect, test } from 'bun:test';

/**
 * The original's out-of-world test, expressed in its own Y-up terms.
 * `bottom` is the object's position in that space; the world floor is 0.
 */
function originalSaysDead(bottomYUp: number, height: number): boolean {
  return bottomYUp < -height;
}

/**
 * The same test as this port must express it: `top` is position.y and the
 * world floor is levelHeight.
 */
function portSaysDead(topYDown: number, levelHeight: number): boolean {
  return topYDown > levelHeight;
}

/** Convert a Y-up bottom coordinate to the Y-down top of the same object. */
function toYDownTop(bottomYUp: number, height: number, levelHeight: number): number {
  // A point h above the Y-up floor sits (levelHeight - h) below the Y-down top.
  const bottomYDown = levelHeight - bottomYUp;
  return bottomYDown - height;
}

test('the converted test agrees with the original everywhere', () => {
  const levelHeight = 960;
  const disagreements: string[] = [];

  for (const height of [32, 48, 64, 128]) {
    // Sweep from well above the level to well below it.
    for (let bottomYUp = -400; bottomYUp <= levelHeight + 400; bottomYUp += 8) {
      const original = originalSaysDead(bottomYUp, height);
      const port = portSaysDead(toYDownTop(bottomYUp, height, levelHeight), levelHeight);
      if (original !== port) {
        disagreements.push(`h=${height} yUp=${bottomYUp}: original=${original} port=${port}`);
      }
    }
  }

  expect(disagreements).toEqual([]);
});

test('an object entirely below the level is dead, one resting on the floor is not', () => {
  const levelHeight = 960;
  // Feet exactly on the floor: alive.
  expect(portSaysDead(levelHeight - 48, levelHeight)).toBe(false);
  // Sunk a whole body below the floor: dead.
  expect(portSaysDead(levelHeight + 1, levelHeight)).toBe(true);
});

test('flying high above the level is not falling out of it', () => {
  // The unconverted test killed things here, which is the exact inversion.
  const levelHeight = 960;
  expect(portSaysDead(-500, levelHeight)).toBe(false);
});

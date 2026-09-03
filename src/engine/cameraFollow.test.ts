/**
 * How the camera follows its target, against CameraSystem.java.
 *
 * The original does not smooth. It keeps the target inside a dead zone and
 * otherwise locks to it:
 *
 *   X_FOLLOW_DISTANCE      = 0     // horizontally the camera is welded on
 *   Y_UP_FOLLOW_DISTANCE   = 90    // the target may rise 90px before the view does
 *   Y_DOWN_FOLLOW_DISTANCE = 0     // falling is followed immediately
 *
 * That asymmetry is the point: an ordinary jump moves the player less than 90px
 * relative to the camera, so the screen stays put instead of bobbing, but a
 * fall is tracked at once so you can see where you are going to land.
 *
 * This port used to lerp toward the target with an invented smoothing factor,
 * which lagged horizontally and bobbed on every hop.
 */

import { describe, expect, test } from 'bun:test';
import { CameraSystem } from './CameraSystem';
import { Vector2 } from '../utils/Vector2';

const VIEW_W = 480;
const VIEW_H = 320;

interface MovableTarget {
  getPosition: () => Vector2;
  getVelocity: () => Vector2;
  width: number;
  height: number;
  moveTo: (x: number, y: number) => void;
}

/**
 * A target that can be moved in place. Swapping the camera's target instead
 * would start the hand-off easing, which is a different code path.
 */
function targetAt(x: number, y: number): MovableTarget {
  const position = new Vector2(x, y);
  return {
    getPosition: () => position,
    getVelocity: () => new Vector2(0, 0),
    width: 32,
    height: 48,
    moveTo: (nx: number, ny: number): void => { position.set(nx, ny); },
  };
}

/** The camera's centre, which is what the original tracks. */
function centreOf(camera: CameraSystem): { x: number; y: number } {
  return {
    x: camera.getFocusPositionX() + VIEW_W / 2,
    y: camera.getFocusPositionY() + VIEW_H / 2,
  };
}

function settle(camera: CameraSystem, frames = 10): void {
  for (let i = 0; i < frames; i++) camera.update(1 / 60);
}

describe('camera follow', () => {
  test('locks onto the target horizontally', () => {
    const camera = new CameraSystem(VIEW_W, VIEW_H);
    const target = targetAt(2000, 1000);
    camera.setTarget(target);
    settle(camera);

    const centre = centreOf(camera);
    // X_FOLLOW_DISTANCE is 0, so the camera sits exactly on the target's centre
    // (within the pixel snap the original applies).
    expect(Math.abs(centre.x - (2000 + 16))).toBeLessThanOrEqual(1);
  });

  test('a small rise does not move the view', () => {
    const camera = new CameraSystem(VIEW_W, VIEW_H);
    const target = targetAt(2000, 1000);
    camera.setTarget(target);
    settle(camera, 30);
    const before = centreOf(camera).y;

    // Lift the target 60px - less than the 90px of upward slack.
    target.moveTo(2000, 940);
    settle(camera, 30);

    expect(centreOf(camera).y).toBeCloseTo(before, 0);
  });

  test('rising past the dead zone pulls the view up', () => {
    const camera = new CameraSystem(VIEW_W, VIEW_H);
    const target = targetAt(2000, 1000);
    camera.setTarget(target);
    settle(camera, 30);
    const before = centreOf(camera).y;

    // 200px up is well past the threshold.
    target.moveTo(2000, 800);
    settle(camera, 30);

    const after = centreOf(camera).y;
    expect(after).toBeLessThan(before);
    // It trails the target by exactly the follow distance.
    expect(Math.abs(after - (800 + 24 + 90))).toBeLessThanOrEqual(2);
  });

  test('falling is followed immediately', () => {
    const camera = new CameraSystem(VIEW_W, VIEW_H);
    const target = targetAt(2000, 1000);
    camera.setTarget(target);
    settle(camera, 30);

    // Y_DOWN_FOLLOW_DISTANCE is 0: dropping the target moves the view with it.
    target.moveTo(2000, 1200);
    settle(camera, 30);

    expect(Math.abs(centreOf(camera).y - (1200 + 24))).toBeLessThanOrEqual(2);
  });

  test('the focus lands on whole pixels', () => {
    const camera = new CameraSystem(VIEW_W, VIEW_H);
    camera.setTarget(targetAt(1000.7, 500.3));
    settle(camera);
    // The original floors the focal point so pixel art does not shimmer.
    expect(camera.getFocusPositionX() % 1).toBe(0);
    expect(camera.getFocusPositionY() % 1).toBe(0);
  });

  test('shake moves the view vertically only', () => {
    const camera = new CameraSystem(VIEW_W, VIEW_H);
    camera.setTarget(targetAt(2000, 1000));
    settle(camera, 30);
    const steady = centreOf(camera);

    camera.shake(15, 0.5);
    const xs = new Set<number>();
    let sawVerticalMovement = false;
    for (let i = 0; i < 20; i++) {
      camera.update(1 / 60);
      const c = centreOf(camera);
      xs.add(c.x);
      if (Math.abs(c.y - steady.y) > 0.5) sawVerticalMovement = true;
    }
    // Original: mShakeOffsetY only - the X axis never shakes.
    expect(xs.size).toBe(1);
    expect(sawVerticalMovement).toBe(true);
  });
});

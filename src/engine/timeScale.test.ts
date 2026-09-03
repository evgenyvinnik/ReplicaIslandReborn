/**
 * Game-clock scaling, against TimeSystem.java.
 *
 * The original uses this in exactly one place: PlayerComponent.gotoWin() calls
 * appyScale(0.1f, 8.0f, true), dropping the game to a tenth speed as you take
 * the last gem and easing back out. The port had no scaling at all, so
 * finishing a level simply cut to the results screen.
 */

import { describe, expect, test } from 'bun:test';
import { TimeSystem } from './TimeSystem';

/** Advance a number of real 60fps frames and report the game time gained. */
function advance(time: TimeSystem, frames: number): number {
  const before = time.getGameTime();
  for (let i = 0; i < frames; i++) time.update(1 / 60);
  return time.getGameTime() - before;
}

describe('time scaling', () => {
  test('the clock runs at real speed by default', () => {
    const time = new TimeSystem();
    expect(advance(time, 60)).toBeCloseTo(1.0, 2);
  });

  test('an un-eased scale applies immediately', () => {
    const time = new TimeSystem();
    time.applyScale(0.5, 10, false);
    expect(advance(time, 60)).toBeCloseTo(0.5, 2);
  });

  test('the win flourish slows the clock to roughly a tenth', () => {
    const time = new TimeSystem();
    // Original: appyScale(0.1, 8.0, true).
    time.applyScale(0.1, 8.0, true);
    // Skip the half-second ease-in, then sample a second of real time.
    advance(time, 30);
    const during = advance(time, 60);
    expect(during).toBeCloseTo(0.1, 2);
  });

  test('an eased scale ramps in rather than snapping', () => {
    const eased = new TimeSystem();
    eased.applyScale(0.1, 8.0, true);
    const easedFirstFrames = advance(eased, 6);

    const abrupt = new TimeSystem();
    abrupt.applyScale(0.1, 8.0, false);
    const abruptFirstFrames = advance(abrupt, 6);

    // Easing in means the first frames are still close to full speed.
    expect(easedFirstFrames).toBeGreaterThan(abruptFirstFrames);
  });

  test('the scale expires on its own', () => {
    const time = new TimeSystem();
    time.applyScale(0.1, 1.0, false);
    advance(time, 90);            // 1.5s real, past the duration
    expect(time.isScaling()).toBe(false);
    expect(advance(time, 60)).toBeCloseTo(1.0, 2);
  });

  test('clearScale drops a running ramp', () => {
    // The win ramp lasts eight seconds but the level ends well before that,
    // so loading the next level has to clear it or it starts in slow motion.
    const time = new TimeSystem();
    time.applyScale(0.1, 8.0, true);
    expect(time.isScaling()).toBe(true);
    time.clearScale();
    expect(time.isScaling()).toBe(false);
    expect(advance(time, 60)).toBeCloseTo(1.0, 2);
  });

  test('freezing stops the clock outright', () => {
    const time = new TimeSystem();
    time.freeze(0.5);
    expect(advance(time, 12)).toBe(0);
  });
});

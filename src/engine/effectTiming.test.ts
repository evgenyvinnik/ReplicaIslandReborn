/**
 * Effect frame timing, checked against the original.
 *
 * EffectsSystem gave every effect one flat `frameDuration`, but several of the
 * original's are deliberately uneven. The big smoke puff is the clearest: it
 * runs through its four shape frames at 24fps and then sits on a single frame
 * for another 51 frames while it disperses - a two-second life. Flattened to
 * one rate it flashed past in a fifth of a second, which is why smoke in this
 * port never looked like smoke.
 *
 * Numbers are the `Utils.framesToTime(24, n)` arguments in the matching
 * spawnEffect* function of GameObjectFactory.java.
 */

import { describe, expect, test } from 'bun:test';
import { EffectsSystem, EffectType } from './EffectsSystem';

/** Total on-screen life of an effect, in seconds. */
function lifetimeOf(type: EffectType): number {
  const system = new EffectsSystem();
  system.spawn(type, 0, 0);
  let elapsed = 0;
  // Step until it dies, with a generous ceiling.
  for (let i = 0; i < 60 * 10; i++) {
    if (system.getActiveCount() === 0) break;
    system.update(1 / 60);
    elapsed += 1 / 60;
  }
  return elapsed;
}

describe('effect timing', () => {
  test('big smoke lingers instead of flashing past', () => {
    // 4 shape frames + 10 + 13 + 8 + 5 + 15 = 55 frames at 24fps.
    const seconds = lifetimeOf(EffectType.SMOKE_BIG);
    expect(seconds).toBeGreaterThan(1.8);
    expect(seconds).toBeLessThan(2.7);
  });

  test('small smoke holds its first frame then rushes', () => {
    // 10 + 1 + 1 + 1 + 1 = 14 frames at 24fps, a little under 0.6s.
    const seconds = lifetimeOf(EffectType.SMOKE_SMALL);
    expect(seconds).toBeGreaterThan(0.45);
    expect(seconds).toBeLessThan(0.85);
  });

  test('the small explosion is a seven-frame flash', () => {
    const seconds = lifetimeOf(EffectType.EXPLOSION_SMALL);
    expect(seconds).toBeGreaterThan(0.2);
    expect(seconds).toBeLessThan(0.45);
  });

  test('the giant explosion runs the big blast then the small one', () => {
    // Sixteen frames, where the port previously stopped after nine.
    const giant = lifetimeOf(EffectType.EXPLOSION_GIANT);
    const large = lifetimeOf(EffectType.EXPLOSION_LARGE);
    expect(giant).toBeGreaterThan(large);
  });

  test('smoke outlasts the explosion that usually accompanies it', () => {
    expect(lifetimeOf(EffectType.SMOKE_BIG))
      .toBeGreaterThan(lifetimeOf(EffectType.EXPLOSION_LARGE));
  });
});

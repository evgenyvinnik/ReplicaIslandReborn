/**
 * Effect frame timing, checked against the original.
 *
 * Big smoke chooses one of five animations: hold 01, then disperse through
 * 02–05. The five first-frame holds belong to separate animations, not one
 * 55-frame sequence. Tests must preserve that distinction from the Java source.
 *
 * Numbers are the `Utils.framesToTime(24, n)` arguments in the matching
 * spawnEffect* function of GameObjectFactory.java.
 */

import { describe, expect, test } from 'bun:test';
import { EffectsSystem, EffectType } from './EffectsSystem';
import { SortConstants } from './SortConstants';

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
  test('big smoke selects one of the five original first-frame holds', () => {
    const random = Math.random;
    try {
      for (const [variant, hold] of [10, 13, 8, 5, 15].entries()) {
        Math.random = (): number => (variant + 0.5) / 5;
        const seconds = lifetimeOf(EffectType.SMOKE_BIG);
        expect(Math.abs(seconds - (hold + 4) / 24)).toBeLessThanOrEqual(1 / 60 + 1e-8);
      }
    } finally { Math.random = random; }
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

  test('a delayed frame consumes elapsed animation time instead of extending effects', () => {
    const system = new EffectsSystem();
    system.spawn(EffectType.EXPLOSION_SMALL, 0, 0);
    system.update(1);
    expect(system.getActiveCount()).toBe(0);
  });

  test('a crush flash is two layers, one behind the object and one in front', () => {
    // Original: spawnEffectCrushFlash builds a 3-frame back animation at
    // EFFECT and a 7-frame front one at FOREGROUND_EFFECT. The port drew only
    // the front, so the flash never showed behind what it crushed.
    const system = new EffectsSystem();
    system.spawnCrushFlash(0, 0);
    expect(system.getActiveCount()).toBe(2);

    const drawn: Array<{ sprite: string; z: number }> = [];
    system.drawQueued(
      {
        hasSprite: (): boolean => true,
        drawSprite: (sprite: string, _x: number, _y: number, _f: number, z: number): void => {
          drawn.push({ sprite, z });
        },
      } as unknown as Parameters<EffectsSystem['drawQueued']>[0],
      SortConstants.EFFECT
    );

    const back = drawn.find((d) => d.sprite.includes('crush_back'));
    const front = drawn.find((d) => d.sprite.includes('crush_front'));
    expect(back, 'no back layer drawn').toBeDefined();
    expect(front, 'no front layer drawn').toBeDefined();
    expect(back!.z).toBe(SortConstants.EFFECT);
    expect(front!.z).toBe(SortConstants.FOREGROUND_EFFECT);
    expect(back!.z).toBeLessThan(front!.z);
  });
});

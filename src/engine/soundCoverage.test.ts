/**
 * Which shipped sounds the port actually plays.
 *
 * Every clip in `Original/res/raw` was copied across and is loaded at startup,
 * so a missing sound is silent rather than broken - nothing errors, the cue
 * just never happens. Several were sitting unused:
 *
 * - `deep_clang` is the player's take-hit sound
 *   (`hitReact.setTakeHitSound(HitType.HIT, ...)` in spawnPlayer). The port
 *   played `thump` instead, which in the original is the *stomp's* landing
 *   impact - so being hurt and landing a stomp sounded identical, and the
 *   stomp had no sound of its own.
 * - `rockets` is the jetpack's looping hum
 *   (`animation.setRocketSound(...)`). Flying was silent.
 * - `gem3` is the third note of the ruby motif
 *   (`animation.setRubySounds(gem1, gem2, gem3)`). Every ruby played gem2.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SoundEffects } from './SoundSystem';

const root = join(import.meta.dir, '../..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

/** Everything under src that could name a sound. */
function sourceText(): string {
  const files = [
    'src/components/Game.tsx',
    'src/entities/components/PlayerComponent.ts',
    'src/levels/LevelSystemNew.ts',
    'src/entities/components/GhostComponent.ts',
    'src/entities/components/LaunchProjectileComponent.ts',
    'src/entities/components/DoorAnimationComponent.ts',
    'src/entities/components/ButtonAnimationComponent.ts',
    'src/entities/components/HitReactionComponent.ts',
    'src/entities/components/LifetimeComponent.ts',
    'src/engine/EffectsSystem.ts',
  ];
  return files.map((f) => {
    try { return read(f); } catch { return ''; }
  }).join('\n');
}

describe('sound coverage', () => {
  test('every shipped clip exists on disk for the names the port uses', () => {
    const shipped = new Set(
      readdirSync(join(root, 'public/assets/sounds'))
        .filter((f) => f.endsWith('.ogg'))
        .map((f) => f.replace(/\.ogg$/, ''))
    );
    for (const [name, file] of Object.entries(SoundEffects)) {
      expect(shipped.has(file), `${name} -> ${file}.ogg is not shipped`).toBe(true);
    }
  });

  test('the cues the original gives the player are all wired up', () => {
    const source = sourceText();
    // Each of these was silent before; they are the player's own feedback.
    const required: Array<[string, string]> = [
      ['DEEP_CLANG', 'the player taking a hit'],
      ['THUMP', "the stomp's landing impact"],
      ['ROCKETS', 'the jetpack hum'],
      ['GEM1', 'the first ruby'],
      ['GEM2', 'the second ruby'],
      ['GEM3', 'the third ruby'],
      ['BREAK_BLOCK', 'a breakable block dying'],
    ];
    for (const [constant, what] of required) {
      expect(
        source.includes(`SoundEffects.${constant}`),
        `nothing plays ${constant} (${what})`
      ).toBe(true);
    }
  });

  test('the ruby motif rises rather than repeating one note', () => {
    const game = read('src/components/Game.tsx');
    // The three gems map to three different clips, keyed by the count.
    expect(game).toContain('RUBY_SOUNDS');
    expect(SoundEffects.GEM1).not.toBe(SoundEffects.GEM2);
    expect(SoundEffects.GEM2).not.toBe(SoundEffects.GEM3);
  });

  test('taking a hit and landing a stomp use different sounds', () => {
    // They were both `thump`, which made the two events indistinguishable.
    expect(SoundEffects.DEEP_CLANG).not.toBe(SoundEffects.THUMP);
    const game = read('src/components/Game.tsx');
    // onPlayerHit plays the hurt sound, not the landing one.
    const hitBlock = game.slice(game.indexOf('const onPlayerHit'), game.indexOf('const onPlayerHit') + 700);
    expect(hitBlock).toContain('SoundEffects.DEEP_CLANG');
    expect(hitBlock).not.toContain('SoundEffects.THUMP');
  });
});

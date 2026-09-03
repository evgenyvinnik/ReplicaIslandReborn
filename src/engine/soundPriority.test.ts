/**
 * Voice limit and priority, against SoundSystem.java.
 *
 * The original builds its SoundPool with MAX_STREAMS = 8 and hands every play()
 * a priority. When all eight voices are busy SoundPool steals one - the
 * lowest-priority stream, oldest first among equals - so a new sound always
 * plays. Only two priorities appear at its call sites: the jetpack loop and the
 * stomp's landing thump are HIGH, everything else is NORMAL.
 *
 * The port previously refused any sound past 32 concurrent, which both allowed
 * four times the polyphony and dropped the *new* sound rather than the least
 * important old one - so in a busy moment the sound you just caused was the one
 * you did not hear.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SoundPriority, chooseEvictionVictim } from './SoundSystem';

describe('sound priority', () => {
  test('the priority ladder matches the original', () => {
    expect(SoundPriority.LOW).toBe(0);
    expect(SoundPriority.NORMAL).toBe(1);
    expect(SoundPriority.HIGH).toBe(2);
    expect(SoundPriority.MUSIC).toBe(3);
  });

  test('the player\'s own cues are marked HIGH', () => {
    // Original: AnimationComponent plays the rocket loop and the land thump at
    // PRIORITY_HIGH. Everything else in the game is NORMAL, so those two are
    // the sounds that survive a crowded frame.
    const source = readFileSync(
      join(import.meta.dir, '../entities/components/PlayerComponent.ts'),
      'utf8'
    );

    const rockets = source.slice(source.indexOf('SoundEffects.ROCKETS'));
    expect(rockets.slice(0, 120)).toContain('SoundPriority.HIGH');

    const thump = source.slice(source.indexOf('SoundEffects.THUMP'));
    expect(thump.slice(0, 120)).toContain('SoundPriority.HIGH');
  });

  test('eviction prefers the lowest priority, then the oldest', () => {
    const playing = new Map([
      [1, { priority: SoundPriority.HIGH, startOrder: 1 }],
      [2, { priority: SoundPriority.NORMAL, startOrder: 2 }],
      [3, { priority: SoundPriority.NORMAL, startOrder: 3 }],
      [4, { priority: SoundPriority.LOW, startOrder: 4 }],
    ]);
    // The LOW stream goes first regardless of who is asking.
    expect(chooseEvictionVictim(playing, SoundPriority.NORMAL)).toBe(4);
    expect(chooseEvictionVictim(playing, SoundPriority.HIGH)).toBe(4);
    expect(chooseEvictionVictim(playing, SoundPriority.LOW)).toBe(4);
  });

  test('among equal priorities the oldest is taken', () => {
    const playing = new Map([
      [7, { priority: SoundPriority.NORMAL, startOrder: 9 }],
      [8, { priority: SoundPriority.NORMAL, startOrder: 4 }],
      [9, { priority: SoundPriority.NORMAL, startOrder: 6 }],
    ]);
    expect(chooseEvictionVictim(playing, SoundPriority.NORMAL)).toBe(8);
  });

  test('a sound cannot evict one that outranks it', () => {
    // With only HIGH streams playing, a NORMAL newcomer is the one dropped -
    // which is what keeps the jetpack audible through a burst of effects.
    const playing = new Map([
      [1, { priority: SoundPriority.HIGH, startOrder: 1 }],
      [2, { priority: SoundPriority.HIGH, startOrder: 2 }],
    ]);
    expect(chooseEvictionVictim(playing, SoundPriority.NORMAL)).toBeNull();
    // A HIGH newcomer may displace an equal.
    expect(chooseEvictionVictim(playing, SoundPriority.HIGH)).toBe(1);
  });

  test('nothing playing means nothing to evict', () => {
    expect(chooseEvictionVictim(new Map(), SoundPriority.NORMAL)).toBeNull();
  });
});

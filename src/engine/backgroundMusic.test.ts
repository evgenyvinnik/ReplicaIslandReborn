/**
 * Guards the converted background-music score.
 *
 * The original's music is a General MIDI file (bwv_115.mid) that Android played
 * through its built-in synth. The web port converts it once with
 * `scripts/convert-midi-to-json.ts` and synthesizes it at runtime, so the
 * committed score is the asset that matters — an empty or malformed note list
 * silently means "no music" rather than a visible failure.
 */

import { describe, expect, test } from 'bun:test';
import { file } from 'bun';
import { join } from 'node:path';

const SCORE = join(import.meta.dir, '../../public/assets/sounds/bwv_115.json');

interface Score {
  duration: number;
  ticksPerQuarter: number;
  notes: Array<{ time: number; duration: number; pitch: number; velocity: number }>;
}

describe('converted background music score', () => {
  test('ships a playable note list', async () => {
    expect(await file(SCORE).exists()).toBe(true);
    const score = await file(SCORE).json() as Score;

    expect(score.notes.length).toBeGreaterThan(100);
    expect(score.duration).toBeGreaterThan(30);
    expect(score.ticksPerQuarter).toBeGreaterThan(0);

    for (const note of score.notes) {
      // Every field must survive conversion; a dropped `pitch` still produces
      // valid JSON but renders as silence.
      expect(Number.isFinite(note.time)).toBe(true);
      expect(note.duration).toBeGreaterThan(0);
      expect(note.pitch).toBeGreaterThanOrEqual(0);
      expect(note.pitch).toBeLessThanOrEqual(127);
      expect(note.velocity).toBeGreaterThan(0);
      expect(note.velocity).toBeLessThanOrEqual(1);
    }
  });

  test('covers a musical pitch range and stays inside its stated duration', async () => {
    const score = await file(SCORE).json() as Score;
    const pitches = score.notes.map((note) => note.pitch);

    // A chorale spans more than a couple of semitones; a stuck-constant pitch
    // would mean the parser lost track of note identity.
    expect(Math.max(...pitches) - Math.min(...pitches)).toBeGreaterThan(12);

    const lastEnd = Math.max(...score.notes.map((note) => note.time + note.duration));
    expect(lastEnd).toBeLessThanOrEqual(score.duration + 0.001);
  });
});

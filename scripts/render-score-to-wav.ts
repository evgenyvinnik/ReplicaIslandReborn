/**
 * Render the converted BWV 115 score to mono 16-bit PCM for one-time encoding.
 *
 * Usage: bun scripts/render-score-to-wav.ts public/assets/sounds/bwv_115.json /tmp/bwv_115.wav
 * On macOS, encode it with:
 * afconvert -f m4af -d aac -b 96000 /tmp/bwv_115.wav public/assets/sounds/music.m4a
 * The voice and envelopes mirror SoundSystem.renderNote; encoding the result
 * avoids constructing hundreds of Web Audio nodes on every game launch.
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface Note {
  time: number;
  duration: number;
  pitch: number;
  velocity: number;
}

interface Score {
  duration: number;
  notes: Note[];
}

const [scorePath, outputPath] = process.argv.slice(2);
if (!scorePath || !outputPath) {
  throw new Error('Usage: bun scripts/render-score-to-wav.ts SCORE.json OUTPUT.wav');
}

const score = JSON.parse(readFileSync(scorePath, 'utf8')) as Score;
const sampleRate = 44_100;
const release = 0.25;
const attack = 0.008;
const lastEnd = Math.max(...score.notes.map(note => note.time + note.duration));
const duration = Math.max(score.duration, lastEnd) + release;
const samples = new Float32Array(Math.ceil(duration * sampleRate));

for (const note of score.notes) {
  const frequency = 440 * 2 ** ((note.pitch - 69) / 12);
  const startSample = Math.floor(note.time * sampleRate);
  const endSample = Math.min(samples.length, Math.ceil((note.time + note.duration + release) * sampleRate));
  const peak = Math.max(0.05, Math.min(1, note.velocity)) * 0.22;
  const held = peak * 0.35;

  for (let i = startSample; i < endSample; i++) {
    const elapsed = i / sampleRate - note.time;
    const envelope = elapsed < attack
      ? peak * elapsed / attack
      : elapsed < note.duration
        ? peak * (0.35 ** ((elapsed - attack) / (note.duration - attack)))
        : held * ((0.0001 / held) ** ((elapsed - note.duration) / release));
    const phase = 2 * Math.PI * frequency * elapsed;
    const triangle = 2 / Math.PI * Math.asin(Math.sin(phase));
    const overtonePhase = (2 * frequency * elapsed) % 1;
    const sawtooth = 2 * overtonePhase - 1;
    samples[i] += 0.5 * envelope * (triangle + 0.18 * sawtooth);
  }
}

const dataSize = samples.length * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataSize, 40);

for (let i = 0; i < samples.length; i++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
}

writeFileSync(outputPath, wav);
console.log(`Rendered ${score.notes.length} notes, ${duration.toFixed(2)}s, ${outputPath}`);

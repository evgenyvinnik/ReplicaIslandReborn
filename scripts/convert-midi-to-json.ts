/**
 * Convert the original background music (Original/res/raw/bwv_115.mid) into a
 * compact JSON note list the web port can synthesize with the Web Audio API.
 *
 * The original ships a General MIDI file and relies on Android's built-in
 * synthesizer. Browsers have no MIDI synth, so rather than bundling a rendered
 * audio file (and a soundfont toolchain to produce it) we parse the score once
 * at build time and let SoundSystem play the notes with oscillators.
 *
 * Usage: bun run scripts/convert-midi-to-json.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const SOURCE = join(projectRoot, 'Original/res/raw/bwv_115.mid');
const DESTINATION = join(projectRoot, 'public/assets/sounds/bwv_115.json');

/** A single sounded note, in seconds. */
interface Note {
  /** Start time from the beginning of the piece. */
  time: number;
  /** How long the note is held. */
  duration: number;
  /** MIDI note number (60 = middle C). */
  pitch: number;
  /** Velocity normalized to 0..1. */
  velocity: number;
}

class Reader {
  private offset = 0;
  constructor(private readonly data: Uint8Array) {}

  get position(): number {
    return this.offset;
  }

  get done(): boolean {
    return this.offset >= this.data.length;
  }

  byte(): number {
    if (this.offset >= this.data.length) {
      throw new Error('unexpected end of MIDI data');
    }
    return this.data[this.offset++];
  }

  peek(): number {
    return this.data[this.offset];
  }

  uint16(): number {
    return (this.byte() << 8) | this.byte();
  }

  uint32(): number {
    return ((this.byte() << 24) | (this.byte() << 16) | (this.byte() << 8) | this.byte()) >>> 0;
  }

  bytes(count: number): Uint8Array {
    const slice = this.data.subarray(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  }

  text(count: number): string {
    return String.fromCharCode(...this.bytes(count));
  }

  /** MIDI variable-length quantity: 7 bits per byte, high bit continues. */
  varInt(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.byte();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
    }
    return value;
  }
}

interface TempoChange {
  tick: number;
  microsecondsPerQuarter: number;
}

interface RawEvent {
  tick: number;
  type: 'on' | 'off';
  pitch: number;
  velocity: number;
}

function parseTrack(reader: Reader, length: number): { events: RawEvent[]; tempos: TempoChange[] } {
  const end = reader.position + length;
  const events: RawEvent[] = [];
  const tempos: TempoChange[] = [];
  let tick = 0;
  let runningStatus = 0;

  while (reader.position < end) {
    tick += reader.varInt();

    let status = reader.peek();
    if (status & 0x80) {
      reader.byte();
      runningStatus = status;
    } else {
      // Running status: reuse the previous channel-voice status byte.
      status = runningStatus;
    }

    if (status === 0xff) {
      const metaType = reader.byte();
      const metaLength = reader.varInt();
      const payload = reader.bytes(metaLength);
      if (metaType === 0x51 && metaLength === 3) {
        tempos.push({
          tick,
          microsecondsPerQuarter: (payload[0] << 16) | (payload[1] << 8) | payload[2],
        });
      }
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      reader.bytes(reader.varInt());
      continue;
    }

    const command = status & 0xf0;
    switch (command) {
      case 0x80: {
        const pitch = reader.byte();
        reader.byte();
        events.push({ tick, type: 'off', pitch, velocity: 0 });
        break;
      }
      case 0x90: {
        const pitch = reader.byte();
        const velocity = reader.byte();
        // A note-on with zero velocity is the conventional note-off.
        events.push({ tick, type: velocity === 0 ? 'off' : 'on', pitch, velocity });
        break;
      }
      case 0xa0:
      case 0xb0:
      case 0xe0:
        reader.byte();
        reader.byte();
        break;
      case 0xc0:
      case 0xd0:
        reader.byte();
        break;
      default:
        throw new Error(`unhandled MIDI status 0x${status.toString(16)}`);
    }
  }

  return { events, tempos };
}

/** Convert a tick position to seconds, honouring every tempo change before it. */
function tickToSeconds(tick: number, tempos: TempoChange[], ticksPerQuarter: number): number {
  let seconds = 0;
  let lastTick = 0;
  let microsecondsPerQuarter = 500_000; // MIDI default, 120bpm

  for (const tempo of tempos) {
    if (tempo.tick >= tick) break;
    seconds += ((tempo.tick - lastTick) / ticksPerQuarter) * (microsecondsPerQuarter / 1_000_000);
    lastTick = tempo.tick;
    microsecondsPerQuarter = tempo.microsecondsPerQuarter;
  }

  seconds += ((tick - lastTick) / ticksPerQuarter) * (microsecondsPerQuarter / 1_000_000);
  return seconds;
}

function convert(): void {
  const reader = new Reader(new Uint8Array(readFileSync(SOURCE)));

  if (reader.text(4) !== 'MThd') {
    throw new Error('not a MIDI file: missing MThd');
  }
  const headerLength = reader.uint32();
  const format = reader.uint16();
  const trackCount = reader.uint16();
  const division = reader.uint16();
  // Skip any header bytes beyond the 6 we understand.
  reader.bytes(headerLength - 6);

  if (division & 0x8000) {
    throw new Error('SMPTE time division is not supported');
  }
  const ticksPerQuarter = division;

  const allEvents: RawEvent[] = [];
  const allTempos: TempoChange[] = [];

  for (let i = 0; i < trackCount && !reader.done; i++) {
    const chunkType = reader.text(4);
    const chunkLength = reader.uint32();
    if (chunkType !== 'MTrk') {
      reader.bytes(chunkLength);
      continue;
    }
    const { events, tempos } = parseTrack(reader, chunkLength);
    allEvents.push(...events);
    allTempos.push(...tempos);
  }

  allTempos.sort((a, b) => a.tick - b.tick);
  allEvents.sort((a, b) => a.tick - b.tick);

  // Pair note-ons with their matching note-offs. Multiple voices can hold the
  // same pitch, so keep a stack per pitch and close the oldest first.
  const pending = new Map<number, Array<{ tick: number; velocity: number }>>();
  const notes: Note[] = [];

  for (const event of allEvents) {
    if (event.type === 'on') {
      const stack = pending.get(event.pitch) ?? [];
      stack.push({ tick: event.tick, velocity: event.velocity });
      pending.set(event.pitch, stack);
      continue;
    }
    const stack = pending.get(event.pitch);
    const start = stack?.shift();
    if (!start) continue;
    const startSeconds = tickToSeconds(start.tick, allTempos, ticksPerQuarter);
    const endSeconds = tickToSeconds(event.tick, allTempos, ticksPerQuarter);
    const duration = endSeconds - startSeconds;
    if (duration <= 0) continue;
    notes.push({
      time: Number(startSeconds.toFixed(4)),
      duration: Number(duration.toFixed(4)),
      // The stack is keyed by pitch, so the note-off carries the same pitch
      // that opened this note.
      pitch: event.pitch,
      velocity: Number((start.velocity / 127).toFixed(3)),
    });
  }

  notes.sort((a, b) => a.time - b.time || a.pitch - b.pitch);

  const lastNoteEnd = notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
  const output = {
    source: 'Original/res/raw/bwv_115.mid',
    title: 'BWV 115',
    format,
    ticksPerQuarter,
    // Round the loop point up to a whole beat so the repeat lands musically.
    duration: Number((Math.ceil(lastNoteEnd * 2) / 2).toFixed(4)),
    notes,
  };

  mkdirSync(dirname(DESTINATION), { recursive: true });
  writeFileSync(DESTINATION, JSON.stringify(output));

  const bytes = JSON.stringify(output).length;
  console.log(
    `Converted ${notes.length} notes (${output.duration.toFixed(2)}s) -> ${DESTINATION} (${bytes} bytes)`
  );
}

convert();

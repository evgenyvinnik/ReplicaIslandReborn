/** Development-only keyboard playback. Never imports or assigns game state. */
export interface KeyStep { codes: string[]; milliseconds: number }
export interface KeyScheduler {
  set(callback: () => void, milliseconds: number): unknown;
  clear(handle: unknown): void;
}
const keys: Record<string, string> = {
  LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', UP: 'ArrowUp', DOWN: 'ArrowDown',
  FLY: 'Space', ATTACK: 'KeyX', PAUSE: 'Escape',
};

export function parseKeySequence(source: string): KeyStep[] {
  const steps: KeyStep[] = [];
  let duration = 0;
  for (const [index, raw] of source.split('\n').entries()) {
    const line = raw.trim().toUpperCase();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z+]+)\s+(\d+)$/.exec(line);
    if (!match) throw new Error(`Line ${index + 1}: use KEYS milliseconds`);
    const names = match[1] === 'WAIT' ? [] : match[1].split('+');
    if (names.some(name => !keys[name])) throw new Error(`Line ${index + 1}: unknown key`);
    const milliseconds = Number(match[2]);
    if (milliseconds < 1 || milliseconds > 10000) throw new Error('Each step must be 1–10000 ms');
    duration += milliseconds;
    steps.push({ codes: [...new Set(names.map(name => keys[name]))], milliseconds });
    if (steps.length > 64 || duration > 30000) throw new Error('Limit: 64 steps and 30 seconds');
  }
  if (!steps.length) throw new Error('Enter at least one input step');
  return steps;
}

export class KeyboardSequence {
  private held = new Set<string>();
  private pending: unknown;
  private generation = 0;
  private active = false;

  constructor(
    private emit: (type: 'keydown' | 'keyup', code: string) => void,
    private scheduler: KeyScheduler,
    private done: (cancelled: boolean) => void,
  ) {}

  start(steps: KeyStep[]): boolean {
    if (this.active || !steps.length) return false;
    const sequence = steps.map(step => ({ ...step, codes: [...step.codes] }));
    this.active = true;
    const generation = ++this.generation;
    const play = (index: number): void => {
      if (!this.active || generation !== this.generation) return;
      if (index === sequence.length) { this.finish(false); return; }
      const step = sequence[index];
      const next = new Set(step.codes);
      for (const code of this.held) if (!next.has(code)) this.emit('keyup', code);
      for (const code of next) if (!this.held.has(code)) this.emit('keydown', code);
      this.held = next;
      this.pending = this.scheduler.set(() => play(index + 1), step.milliseconds);
    };
    play(0);
    return true;
  }

  cancel(): void { if (this.active) this.finish(true); }

  private finish(cancelled: boolean): void {
    this.active = false;
    ++this.generation;
    this.scheduler.clear(this.pending);
    this.pending = undefined;
    for (const code of this.held) this.emit('keyup', code);
    this.held.clear();
    this.done(cancelled);
  }
}

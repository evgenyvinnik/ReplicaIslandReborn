import { expect, test } from 'bun:test';
import { SoundSystem } from './SoundSystem';
import { readFileSync } from 'node:fs';

test('Game applies covered-surface suspension before initializing audio during startup', () => {
  const source = readFileSync(new URL('../components/Game.tsx', import.meta.url), 'utf8');
  const initialization = source.slice(source.indexOf('const initializeGame = async'));
  const guard = initialization.indexOf('if (!isSurfaceActive(canvas)) surfaceActivity.suspend()');
  expect(guard).toBeGreaterThan(0);
  expect(guard).toBeLessThan(initialization.indexOf('await soundSystem.initialize()'));
});

class AudioContextStub {
  static current: AudioContextStub;
  state = 'running';
  currentTime = 0;
  destination = {};
  gains: Array<{ gain: { value: number; linearRampToValueAtTime: (value: number) => void }; connect: () => void }> = [];
  sources = 0;
  resumes = 0;
  suspends = 0;
  constructor() { AudioContextStub.current = this; }
  createGain(): AudioContextStub['gains'][number] {
    const gain = { value: 1, linearRampToValueAtTime(value: number): void { this.value = value; } };
    const node = { gain, connect: (): void => {} };
    this.gains.push(node);
    return node;
  }
  createBufferSource(): unknown {
    this.sources++;
    return { connect: (): void => {}, disconnect: (): void => {}, start: (): void => {}, stop: (): void => {} };
  }
  decodeAudioData(): Promise<AudioBuffer> { return Promise.resolve({} as AudioBuffer); }
  resume(): Promise<void> { this.resumes++; this.state = 'running'; return Promise.resolve(); }
  suspend(): Promise<void> { this.suspends++; this.state = 'suspended'; return Promise.resolve(); }
  close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
}

async function withSound(check: (sound: SoundSystem) => Promise<void>): Promise<void> {
  const originalContext = globalThis.AudioContext;
  const originalFetch = globalThis.fetch;
  globalThis.AudioContext = AudioContextStub as unknown as typeof AudioContext;
  globalThis.fetch = (async () => new Response(new Uint8Array(128), {
    headers: { 'content-type': 'audio/ogg' },
  })) as unknown as typeof fetch;
  const sound = new SoundSystem();
  try { await check(sound); }
  finally {
    sound.destroy();
    globalThis.AudioContext = originalContext;
    globalThis.fetch = originalFetch;
  }
}

test('backgrounding before audio initialization remains silent until the surface returns', async () => {
  await withSound(async (sound) => {
    sound.pauseAll();
    await sound.initialize();
    const context = AudioContextStub.current;
    expect(context.state).toBe('suspended');
    expect(context.resumes).toBe(0);
    expect(context.gains[0].gain.value).toBe(0);
    sound.setMasterVolume(0.6);
    expect(context.gains[0].gain.value).toBe(0);
    sound.resumeAll();
    await Promise.resolve();
    expect(context.state).toBe('running');
    expect(context.gains[0].gain.value).toBe(0.6);
    expect(context.resumes).toBe(1);
  });
});

test('returning before initialization clears suspension rather than latching a stale pause', async () => {
  await withSound(async (sound) => {
    sound.pauseAll();
    sound.resumeAll();
    await sound.initialize();
    expect(AudioContextStub.current.state).toBe('running');
    expect(AudioContextStub.current.gains[0].gain.value).toBe(1);
  });
});

test('a pending autoplay resume resolving after backgrounding cannot revive audio', async () => {
  await withSound(async (sound) => {
    let finishResume = (): void => {};
    globalThis.AudioContext = class extends AudioContextStub {
      state = 'suspended';
      resume(): Promise<void> {
        this.resumes++;
        return new Promise(resolve => {
          finishResume = (): void => { this.state = 'running'; resolve(); };
        });
      }
    } as unknown as typeof AudioContext;
    await sound.initialize();
    const context = AudioContextStub.current;
    expect(context.resumes).toBe(1);
    sound.pauseAll();
    finishResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(context.state).toBe('suspended');
    expect(context.suspends).toBe(2);
    expect(context.gains[0].gain.value).toBe(0);
  });
});

test('a rejected context suspension is caught and master gain stays silent until return', async () => {
  await withSound(async (sound) => {
    globalThis.AudioContext = class extends AudioContextStub {
      suspend(): Promise<void> { return Promise.reject(new Error('Audio suspension denied')); }
    } as unknown as typeof AudioContext;
    await sound.initialize();
    sound.pauseAll();
    await Promise.resolve();
    expect(AudioContextStub.current.gains[0].gain.value).toBe(0);
    sound.resumeAll();
    await Promise.resolve();
    expect(AudioContextStub.current.gains[0].gain.value).toBe(1);
  });
});

test('music loaded after Pause waits for Resume and volume changes cannot bypass Pause', async () => {
  await withSound(async (sound) => {
    await sound.initialize();
    sound.startBackgroundMusic();
    sound.pauseBackgroundMusic();
    expect(await sound.loadBackgroundMusic('/test-music.ogg')).toBe(true);
    const context = AudioContextStub.current;
    expect(context.sources).toBe(0);
    expect(sound.isMusicPlaying()).toBe(false);
    sound.setMusicVolume(0.7);
    expect(context.gains[2].gain.value).toBe(0);
    sound.resumeBackgroundMusic();
    expect(sound.isMusicPlaying()).toBe(true);
    expect(context.sources).toBe(1);
    expect(context.gains[2].gain.value).toBe(0.7);
    sound.pauseBackgroundMusic();
    sound.setMusicVolume(0.4);
    expect(context.gains[2].gain.value).toBe(0);
    sound.resumeBackgroundMusic();
    expect(context.gains[2].gain.value).toBe(0.4);
    expect(context.sources).toBe(1);
  });
});

test('muting preserves the requested music, while explicit Stop cancels it', async () => {
  await withSound(async (sound) => {
    await sound.initialize();
    await sound.loadBackgroundMusic('/test-music.ogg');
    sound.startBackgroundMusic();
    expect(sound.isMusicPlaying()).toBe(true);
    sound.setEnabled(false);
    expect(sound.isMusicPlaying()).toBe(false);
    sound.setEnabled(true);
    expect(sound.isMusicPlaying()).toBe(true);
    sound.pauseBackgroundMusic();
    sound.setEnabled(false);
    sound.setEnabled(true);
    expect(sound.isMusicPlaying()).toBe(false);
    sound.resumeBackgroundMusic();
    expect(sound.isMusicPlaying()).toBe(true);
    sound.stopBackgroundMusic();
    sound.setEnabled(false);
    sound.setEnabled(true);
    sound.resumeBackgroundMusic();
    expect(sound.isMusicPlaying()).toBe(false);
  });
});

test('music requested while disabled starts only after unmute, even if loading finishes late', async () => {
  await withSound(async (sound) => {
    await sound.initialize();
    sound.setEnabled(false);
    sound.startBackgroundMusic();
    await sound.loadBackgroundMusic('/test-music.ogg');
    expect(sound.isMusicPlaying()).toBe(false);
    sound.setEnabled(true);
    expect(sound.isMusicPlaying()).toBe(true);
  });
});

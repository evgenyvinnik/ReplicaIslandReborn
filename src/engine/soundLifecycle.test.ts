import { expect, test } from 'bun:test';
import { SoundSystem } from './SoundSystem';

test('a pending autoplay resume does not block initialization or sound loading', async () => {
  const originalContext = globalThis.AudioContext;
  const originalFetch = globalThis.fetch;
  let finishResume = (): void => {};
  const resume = new Promise<void>(resolve => { finishResume = resolve; });
  let requests = 0;
  globalThis.AudioContext = class {
    state = 'suspended';
    createGain(): unknown { return { gain: { value: 1 }, connect: (): void => {} }; }
    resume(): Promise<void> { return resume; }
    close(): Promise<void> { return Promise.resolve(); }
    decodeAudioData(): Promise<AudioBuffer> { return Promise.resolve({} as AudioBuffer); }
  } as unknown as typeof AudioContext;
  globalThis.fetch = (async () => {
    requests++;
    return new Response(new Uint8Array(128), { headers: { 'content-type': 'audio/ogg' } });
  }) as unknown as typeof fetch;
  const sound = new SoundSystem();
  try {
    let initialized = false;
    void sound.initialize().then(() => { initialized = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(initialized).toBe(true);
    await sound.loadSound('ding', '/assets/sounds/ding.ogg');
    expect(requests).toBe(1);
    expect(sound.isLoaded('ding')).toBe(true);
  } finally {
    sound.destroy();
    finishResume();
    globalThis.AudioContext = originalContext;
    globalThis.fetch = originalFetch;
  }
});

test('autoplay rejection retries on input and removes listeners after unlocking or destruction', async () => {
  const originalContext = globalThis.AudioContext;
  const originalWindow = globalThis.window;
  const events = new globalThis.EventTarget();
  globalThis.window = events as unknown as typeof window;
  let resumes = 0;
  let allowAudio = false;
  globalThis.AudioContext = class {
    state = 'suspended';
    createGain(): unknown { return { gain: { value: 1 }, connect: (): void => {} }; }
    resume(): Promise<void> {
      resumes++;
      if (!allowAudio) return Promise.reject(new Error('Autoplay not yet allowed'));
      this.state = 'running';
      return Promise.resolve();
    }
    close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
  } as unknown as typeof AudioContext;
  const sound = new SoundSystem();
  const discarded = new SoundSystem();
  try {
    await sound.initialize();
    await Promise.resolve();
    expect(resumes).toBe(1);
    allowAudio = true;
    events.dispatchEvent(new globalThis.Event('keydown'));
    await Promise.resolve();
    expect(resumes).toBe(2);
    events.dispatchEvent(new globalThis.Event('pointerdown'));
    expect(resumes).toBe(2);
    allowAudio = false;
    await discarded.initialize();
    await Promise.resolve();
    expect(resumes).toBe(3);
    discarded.destroy();
    events.dispatchEvent(new globalThis.Event('touchend'));
    expect(resumes).toBe(3);
  } finally {
    sound.destroy();
    discarded.destroy();
    globalThis.AudioContext = originalContext;
    globalThis.window = originalWindow;
  }
});

test('resuming paused gameplay retries denied audio on the next gesture without unlocking while paused', async () => {
  const originalContext = globalThis.AudioContext;
  const originalWindow = globalThis.window;
  const events = new globalThis.EventTarget();
  globalThis.window = events as unknown as typeof window;
  let resumes = 0;
  let allowAudio = false;
  globalThis.AudioContext = class {
    state = 'running';
    createGain(): unknown { return { gain: { value: 1 }, connect: (): void => {} }; }
    suspend(): Promise<void> { this.state = 'suspended'; return Promise.resolve(); }
    resume(): Promise<void> {
      resumes++;
      if (!allowAudio) return Promise.reject(new Error('Resume requires a gesture'));
      this.state = 'running';
      return Promise.resolve();
    }
    close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
  } as unknown as typeof AudioContext;
  const sound = new SoundSystem();
  try {
    await sound.initialize();
    sound.pauseAll();
    events.dispatchEvent(new globalThis.Event('keydown'));
    expect(resumes).toBe(0);
    sound.resumeAll();
    await Promise.resolve();
    await Promise.resolve();
    expect(resumes).toBe(1);
    sound.pauseAll();
    events.dispatchEvent(new globalThis.Event('pointerdown'));
    expect(resumes).toBe(1);
    sound.resumeAll();
    await Promise.resolve();
    await Promise.resolve();
    expect(resumes).toBe(2);
    allowAudio = true;
    events.dispatchEvent(new globalThis.Event('touchend'));
    await Promise.resolve();
    expect(resumes).toBe(3);
    events.dispatchEvent(new globalThis.Event('keydown'));
    expect(resumes).toBe(3);
  } finally {
    sound.destroy();
    globalThis.AudioContext = originalContext;
    globalThis.window = originalWindow;
  }
});

test('destroyed audio cannot be reinitialized by a delayed preload or cache a late decode', async () => {
  const originalContext = globalThis.AudioContext;
  const originalFetch = globalThis.fetch;
  let contexts = 0;
  let requests = 0;
  let finishDecode = (_buffer: AudioBuffer): void => {};
  let beganDecode = (): void => {};
  const decoding = new Promise<void>((resolve) => { beganDecode = resolve; });
  const buffer = new Promise<AudioBuffer>((resolve) => { finishDecode = resolve; });
  globalThis.AudioContext = class {
    state = 'running';
    constructor() { contexts++; }
    createGain(): unknown { return { gain: { value: 1 }, connect: (): void => {} }; }
    close(): Promise<void> { return Promise.resolve(); }
    decodeAudioData(): Promise<AudioBuffer> { beganDecode(); return buffer; }
  } as unknown as typeof AudioContext;
  globalThis.fetch = (async () => {
    requests++;
    return new Response(new Uint8Array(128), { headers: { 'content-type': 'audio/ogg' } });
  }) as unknown as typeof fetch;
  const sound = new SoundSystem();
  try {
    await sound.initialize();
    const loading = sound.loadSound('ding', '/assets/sounds/ding.ogg');
    await decoding;
    sound.destroy();
    finishDecode({} as AudioBuffer);
    await loading;
    expect(sound.isLoaded('ding')).toBe(false);
    await sound.preloadAllSounds();
    await sound.initialize();
    expect(await sound.loadBackgroundMusic('/assets/sounds/music.ogg')).toBe(false);
    expect(await sound.loadBackgroundMusicScore('/assets/sounds/bwv_115.json')).toBe(false);
    expect(contexts).toBe(1);
    expect(requests).toBe(1);
    expect(sound.isInitialized()).toBe(false);
  } finally {
    sound.destroy();
    globalThis.AudioContext = originalContext;
    globalThis.fetch = originalFetch;
  }
});

import { expect, test } from 'bun:test';
import { SoundSystem } from './SoundSystem';

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

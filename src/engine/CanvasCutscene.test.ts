import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CanvasCutscene } from './CanvasCutscene';
import { CutsceneType } from '../data/cutscenes';

const originalWindow = globalThis.window;
const originalImage = globalThis.Image;
let pending: Array<{ src: string; onload: (() => void) | null }>;
let keys: globalThis.EventTarget;

beforeEach(() => {
  pending = [];
  keys = new globalThis.EventTarget();
  // No wall-clock timer APIs: playback must be driven by the display loop.
  globalThis.window = keys as unknown as typeof window;
  globalThis.Image = class {
    width = 0;
    height = 0;
    onload: (() => void) | null = null;
    private path = '';
    get src(): string { return this.path; }
    set src(path: string) {
      this.path = path;
      const png = readFileSync(join(import.meta.dir, '../../public', path));
      this.width = png.readUInt32BE(16);
      this.height = png.readUInt32BE(20);
      pending.push(this);
    }
  } as unknown as typeof Image;
});
afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.Image = originalImage;
});

function scene(): {
  cutscene: CanvasCutscene;
  images: Array<{ src: string; x: number; y: number }>;
  labels: Array<{ text: string; x: number; y: number; style: string }>;
} {
  const images: Array<{ src: string; x: number; y: number }> = [];
  const labels: Array<{ text: string; x: number; y: number; style: string }> = [];
  const ctx = new Proxy({
    fillStyle: '',
    drawImage: (image: HTMLImageElement, x: number, y: number): void => {
      images.push({ src: image.src, x, y });
    },
    fillText: (text: string, x: number, y: number): void => {
      labels.push({ text, x, y, style: ctx.fillStyle });
    },
  }, { get: (target, key): unknown => Reflect.get(target, key) ?? ((): void => {}) });
  return { images, labels, cutscene: new CanvasCutscene(ctx as unknown as CanvasRenderingContext2D,
    new globalThis.EventTarget() as HTMLCanvasElement, 480, 320) };
}

function loadImages(filter: (src: string) => boolean = () => true): void {
  const ready = pending.filter((image) => filter(image.src));
  pending = pending.filter((image) => !filter(image.src));
  ready.forEach((image) => image.onload?.());
}

function enter(): void {
  const event = new globalThis.Event('keydown', { cancelable: true });
  Object.defineProperty(event, 'key', { value: 'Enter' });
  keys.dispatchEvent(event);
}

test('Kyle shows all sixteen original 83ms frames and completes once at 1328ms', async () => {
  const { cutscene, images } = scene();
  let completed = 0;
  const loading = cutscene.play(CutsceneType.KYLE_DEATH, () => { completed++; });
  loadImages();
  await loading;
  for (let frame = 1; frame <= 16; frame++) {
    cutscene.render();
    expect(images[images.length - 1].src).toEndWith(`anime_kyle_fall${String(frame).padStart(2, '0')}.png`);
    expect(completed).toBe(0);
    cutscene.update(0.083);
  }
  expect(completed).toBe(1);
  expect(cutscene.isActive()).toBe(false);
  cutscene.update(10);
  enter();
  expect(completed).toBe(1);
});

test('late image loading cannot reset replacement playback or revive a stopped cutscene', async () => {
  const { cutscene, images } = scene();
  let oldCompleted = 0;
  const old = cutscene.play(CutsceneType.KYLE_DEATH, () => { oldCompleted++; });
  const next = cutscene.play(CutsceneType.WANDA_ENDING, () => {});
  loadImages((src) => src.includes('ui_good_ending'));
  await next;
  cutscene.update(8);
  cutscene.render();
  const last = images.slice(-2);
  loadImages();
  await old;
  cutscene.render();
  expect(images.slice(-2)).toEqual(last);
  expect(oldCompleted).toBe(0);
  const stopped = cutscene.play(CutsceneType.KABOCHA_ENDING, () => { oldCompleted++; });
  cutscene.stop();
  loadImages();
  await stopped;
  cutscene.update(20);
  enter();
  expect(cutscene.isActive()).toBe(false);
  expect(oldCompleted).toBe(0);
});

test.each([CutsceneType.WANDA_ENDING, CutsceneType.KABOCHA_ENDING, CutsceneType.ROKUDOU_ENDING])(
  'ending %s uses the original layer origin, text panel and dismissal timing', async (type) => {
    const { cutscene, images, labels } = scene();
    let completed = 0;
    const loading = cutscene.play(type, () => { completed++; });
    loadImages();
    await loading;
    cutscene.render();
    expect(images).toHaveLength(type === CutsceneType.ROKUDOU_ENDING ? 4 : 2);
    expect(images[0].x).toBe(0);
    expect(images[0].y).toBe(type === CutsceneType.ROKUDOU_ENDING ? -130 : 0);
    cutscene.update(5.9);
    enter();
    expect(completed).toBe(0);
    cutscene.update(0.1);
    cutscene.render();
    const hint = [...labels].reverse().find((label) => label.text === 'TAP TO CONTINUE');
    expect(hint).toBeDefined();
    cutscene.update(0.2);
    cutscene.render();
    expect([...labels].reverse().find((label) => label.text === 'TAP TO CONTINUE')!.style).not.toBe(hint!.style);
    cutscene.update(7.8);
    cutscene.render();
    if (type === CutsceneType.WANDA_ENDING) {
      expect([...labels].reverse().find((label) => label.text === 'PLAYING!')).toMatchObject({ x: 380, y: 67 });
    } else {
      expect([...labels].reverse().find((label) => label.text === 'GAME OVER')).toMatchObject({
        x: 100, y: type === CutsceneType.KABOCHA_ENDING ? 275 : 45,
      });
    }
    enter();
    enter();
    expect(completed).toBe(1);
    expect(cutscene.isActive()).toBe(false);
  }
);

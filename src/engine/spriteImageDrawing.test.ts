import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RenderSystem } from './RenderSystem';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { GameObject } from '../entities/GameObject';
import { createObjectAnimation } from '../data/objectAnimations';

test('individual coin, diary and orb PNGs draw finite, in-bounds source rectangles', async () => {
  const originalImage = globalThis.Image;
  // Keep real asset dimensions; only replace the browser's network/image loader.
  globalThis.Image = class {
    width = 0;
    height = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(path: string) {
      const png = readFileSync(join(import.meta.dir, '../../public', path));
      this.width = png.readUInt32BE(16);
      this.height = png.readUInt32BE(20);
      this.onload?.();
    }
  } as unknown as typeof Image;
  let draws = 0;
  const ctx = {
    save: (): void => {}, restore: (): void => {}, translate: (): void => {},
    drawImage: (img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number,
      dx: number, dy: number, dw: number, dh: number): void => {
      draws++;
      expect([sx, sy, sw, sh, dx, dy, dw, dh].every(Number.isFinite)).toBe(true);
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sx + sw).toBeLessThanOrEqual(img.width);
      expect(sy + sh).toBeLessThanOrEqual(img.height);
    },
  };
  try {
    const renderer = new RenderSystem({ getContext: () => ctx } as unknown as HTMLCanvasElement);
    for (const [kind, size] of [['coin', 16], ['diary', 32], ['ghost', 64]] as const) {
      const object = new GameObject();
      object.width = object.height = size;
      object.setPosition(100, 100);
      const animation = createObjectAnimation(kind, size, size)!;
      for (const name of new Set(animation.frames.map((frame) => frame.sprite!))) {
        const fileName = kind === 'ghost' ? name : `object_${name}`;
        await renderer.loadSingleImage(name, `/assets/sprites/${fileName}.png`);
      }
      const sprite = new SpriteComponent();
      sprite.setRenderSystem(renderer);
      sprite.addAnimation(kind, animation);
      sprite.playAnimation(kind);
      for (let frame = 0; frame < 120; frame++) {
        sprite.update(1 / 60, object);
        sprite.render(object);
        renderer.swap(0, 0);
      }
    }
    expect(draws).toBe(360);
  } finally {
    globalThis.Image = originalImage;
  }
});

import { afterEach, expect, test } from 'bun:test';
import { CanvasHUD } from './CanvasHUD';

const originalImage = globalThis.Image;
afterEach(() => { globalThis.Image = originalImage; });

test('the collectable HUD uses the original icon size, positions, and overlapping digit spacing', async () => {
  globalThis.Image = class {
    width = 32;
    height = 32;
    onload: (() => void) | null = null;
    source = '';
    set src(value: string) { this.source = value; this.onload?.(); }
  } as unknown as typeof Image;
  const draws: Array<{ name: string; x: number; y: number; width: number; height: number }> = [];
  const ctx = {
    save: (): void => undefined,
    restore: (): void => undefined,
    drawImage: (image: { source?: string }, x: number, y: number, width: number, height: number): void => {
      draws.push({ name: image.source ?? '', x, y, width, height });
    },
    imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D;
  const hud = new CanvasHUD(ctx, 480, 320);
  await hud.preload();
  hud.setInventory(0, 0);
  hud.render();

  expect(draws.filter(draw => draw.name.endsWith('ui_pearl.png'))).toEqual([
    { name: '/assets/sprites/ui_pearl.png', x: 224, y: 8, width: 32, height: 32 },
  ]);
  expect(draws.filter(draw => draw.name.endsWith('ui_gem.png'))).toEqual([
    { name: '/assets/sprites/ui_gem.png', x: 340, y: 8, width: 32, height: 32 },
  ]);
  expect(draws.filter(draw => draw.name.endsWith('ui_x.png')).map(draw => [draw.x, draw.y]))
    .toEqual([[248, 8], [364, 8]]);
  expect(draws.filter(draw => draw.name.endsWith('ui_0.png')).map(draw => [draw.x, draw.y]))
    .toEqual([[264, 8], [380, 8]]);

  draws.length = 0;
  hud.setInventory(12, 3);
  hud.render();
  expect(draws.filter(draw => draw.name.endsWith('ui_1.png')).map(draw => [draw.x, draw.y]))
    .toEqual([[264, 8]]);
  expect(draws.filter(draw => draw.name.endsWith('ui_2.png')).map(draw => [draw.x, draw.y]))
    .toEqual([[280, 8]]);
  expect(draws.filter(draw => draw.name.endsWith('ui_3.png')).map(draw => [draw.x, draw.y]))
    .toEqual([[380, 8]]);
});

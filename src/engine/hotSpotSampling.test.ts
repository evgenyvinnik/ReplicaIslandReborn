/**
 * Where hot spots are sampled on an object.
 *
 * The original queries `(getCenteredPositionX(), position.y + 10)`. Its origin
 * is the object's *bottom* (OpenGL, Y-up), so that point is 10 pixels above the
 * feet. This port is Y-down with the origin at the top, where the same
 * expression means 10 pixels below the *head* - for a 128px NPC that is nearly
 * four tiles from the tile it is standing on.
 *
 * Every sampler must therefore use `position.y + height - 10`. Two of the four
 * in the port did; `SelectDialogComponent` had transcribed the Y-up formula
 * literally, and the player's lookup in Game.tsx used the object's centre,
 * which reads the tile above the feet whenever the box straddles a boundary -
 * so death zones and END_LEVEL triggers fired late or not at all.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HotSpotSystem, HotSpotType } from './HotSpotSystem';

const root = join(import.meta.dir, '../..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

describe('hot spot sampling', () => {
  test('the sample point sits in the tile under the feet, not the one above', () => {
    const system = new HotSpotSystem();
    // One column, two rows: an ordinary tile above an END_LEVEL tile.
    // TiledWorldData is column-major: tiles[x][y].
    system.setWorld({
      width: 1,
      height: 2,
      tiles: [[HotSpotType.NONE, HotSpotType.END_LEVEL]],
    });
    system.setLevelDimensions(32, 64, 32, 32);

    // A 48px-tall object standing with its feet on the bottom row's floor.
    // Its top is inside the upper tile and its feet inside the lower one.
    const top = 16;
    const height = 48;
    const feetSample = top + height - 10;   // 54 -> row 1, the tile it stands in
    const centreSample = top + height / 2;  // 40 -> row 1 here as well

    expect(system.getHotSpot(16, feetSample)).toBe(HotSpotType.END_LEVEL);

    // Shift the object up by 16px: the centre now reads the *upper* tile while
    // the feet are still in the lower one. This is the case that silently broke
    // death zones and level exits.
    const shiftedTop = 0;
    expect(system.getHotSpot(16, shiftedTop + height - 10)).toBe(HotSpotType.END_LEVEL);
    expect(system.getHotSpot(16, shiftedTop + height / 2)).toBe(HotSpotType.NONE);
    expect(centreSample).toBeLessThan(feetSample);
  });

  test('every sampler in the port uses the feet, not the head or the centre', () => {
    const samplers: Array<[string, RegExp]> = [
      ['src/entities/components/PatrolComponent.ts', /getHotSpot\(/],
      ['src/entities/components/SelectDialogComponent.ts', /getHotSpot\(/],
      ['src/entities/components/NPCComponent.ts', /getHitTileY\(/],
      ['src/components/Game.tsx', /getHotSpot\(px, py\)/],
    ];

    for (const [path] of samplers) {
      const source = read(path);
      // The Y-up transcription bug: `position.y + 10` with no height term.
      expect(
        /getPosition\(\)\.y \+ 10\b/.test(source) || /currentPosition\.y \+ 10\b/.test(source),
        `${path} samples 10px below the head - that is the Y-up formula`
      ).toBe(false);
      // The correct form appears at least once.
      expect(
        /\.y \+ (?:parent|parentObject|player)?\.?height - 10/.test(source),
        `${path} should sample at y + height - 10`
      ).toBe(true);
    }
  });
});

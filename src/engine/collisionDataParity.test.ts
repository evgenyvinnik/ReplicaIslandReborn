import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollisionData, LineSegment } from './CollisionSystemNew';

const root = join(import.meta.dir, '../..');

test('every shipped collision segment is the Y-flipped Android binary segment', () => {
  const source = readFileSync(join(root, 'Original/res/raw/collision.bin'));
  const shipped = JSON.parse(readFileSync(join(root, 'public/assets/collision.json'), 'utf8')) as CollisionData;
  expect(source.readUInt8(0)).toBe(52);
  const tileCount = source.readUInt8(1);
  const expected: CollisionData['tiles'] = {};
  let offset = 2;
  // JSON has no signed zero; both +0 and -0 serialize as 0.
  const rounded = (value: number): number => {
    const result = Math.round(value * 1000) / 1000;
    return result === 0 ? 0 : result;
  };

  for (let tile = 0; tile < tileCount; tile++) {
    const index = source.readUInt8(offset++);
    const segmentCount = source.readUInt8(offset++);
    const segments: LineSegment[] = [];
    for (let segment = 0; segment < segmentCount; segment++) {
      const startX = source.readFloatLE(offset); offset += 4;
      const startY = source.readFloatLE(offset); offset += 4;
      const endX = source.readFloatLE(offset); offset += 4;
      const endY = source.readFloatLE(offset); offset += 4;
      const normalX = source.readFloatLE(offset); offset += 4;
      const normalY = source.readFloatLE(offset); offset += 4;
      segments.push({
        startX: rounded(startX), startY: rounded(32 - startY),
        endX: rounded(endX), endY: rounded(32 - endY),
        normalX: rounded(normalX), normalY: rounded(-normalY),
      });
    }
    expected[index] = { index, segments };
  }

  expect(offset).toBe(source.length);
  expect(shipped.tileCount).toBe(tileCount);
  expect(shipped.tiles).toEqual(expected);
});

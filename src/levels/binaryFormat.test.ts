/**
 * The level binary format, against LevelSystem.java and TiledWorld.java.
 *
 * The port ships pre-converted JSON, so this parser is not on the hot path -
 * which is exactly why its byte order was wrong and nobody noticed. The
 * original is explicit about it:
 *
 *     // Same as DataInputStream's 'readInt' method
 *     // int i = (((b[0] & 0xff) << 24) | ... | (b[3] & 0xff));
 *
 *     // little endian
 *     int i = (((b[3] & 0xff) << 24) | ... | (b[0] & 0xff));
 *
 * It keeps the big-endian form commented out beside the one it uses. The port
 * had implemented the commented-out one, which reads an 80-tile width as
 * 1342177280 and fails the parser's own sanity check.
 *
 * Parsing the real .bin files here keeps the format honest, and cross-checks
 * the shipped JSON against its source.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LevelParser } from './LevelParser';

const root = join(import.meta.dir, '../..');
const rawDir = join(root, 'Original/res/raw');
const jsonDir = join(root, 'public/assets/levels');

function binaryLevels(): string[] {
  return readdirSync(rawDir)
    .filter((f) => f.startsWith('level_') && f.endsWith('.bin'))
    .map((f) => f.replace(/\.bin$/, ''))
    .sort();
}

describe('level binary format', () => {
  test('the original ships the levels this port converted', () => {
    expect(binaryLevels().length).toBeGreaterThan(30);
  });

  test('every shipped .bin parses', () => {
    const parser = new LevelParser();
    const failures: string[] = [];
    for (const name of binaryLevels()) {
      const bytes = new Uint8Array(readFileSync(join(rawDir, `${name}.bin`)));
      const parsed = parser.parseLevelData(bytes);
      if (!parsed) { failures.push(name); continue; }
      // Signature 96, then layers of TiledWorlds with signature 42.
      if (parsed.layers.length === 0) {
        failures.push(`${name}: parsed but has no layers`);
      }
    }
    expect(failures, 'levels the binary parser cannot read').toEqual([]);
  });

  test('the parsed dimensions agree with the shipped JSON', () => {
    // If the byte order were wrong these would not merely differ, they would
    // be astronomically large - which is the tell this test exists to catch.
    const parser = new LevelParser();
    const mismatches: string[] = [];
    for (const name of binaryLevels()) {
      let json: { layers: Array<{ world: { width: number; height: number } }> };
      try {
        json = JSON.parse(readFileSync(join(jsonDir, `${name}.json`), 'utf8'));
      } catch { continue; }
      const bytes = new Uint8Array(readFileSync(join(rawDir, `${name}.bin`)));
      const parsed = parser.parseLevelData(bytes);
      if (!parsed) { mismatches.push(`${name}: did not parse`); continue; }

      const jsonSize = json.layers[0].world;
      const binSize = parsed.collisionLayer ?? parsed.layers[0]?.world;
      if (!binSize) { mismatches.push(`${name}: no layer to compare`); continue; }
      if (binSize.width !== jsonSize.width || binSize.height !== jsonSize.height) {
        mismatches.push(
          `${name}: bin ${binSize.width}x${binSize.height} vs json ${jsonSize.width}x${jsonSize.height}`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  test('all converted level tiles agree with their Android binaries', () => {
    const parser = new LevelParser();
    const mismatches: string[] = [];
    let checked = 0;
    let tileCount = 0;
    for (const name of binaryLevels()) {
      const source = parser.parseLevelData(new Uint8Array(readFileSync(join(rawDir, `${name}.bin`))));
      const converted = JSON.parse(readFileSync(join(jsonDir, `${name}.json`), 'utf8')) as {
        backgroundId: number;
        layers: Array<{ typeId: number; themeId: number; scrollSpeed: number;
          world: { width: number; height: number; tiles: number[][] } }>;
      };
      expect(source, name).not.toBeNull();
      checked++;
      if (source!.backgroundIndex !== converted.backgroundId ||
          source!.layers.length !== converted.layers.length) {
        mismatches.push(`${name}: header`);
        continue;
      }
      for (const [index, layer] of source!.layers.entries()) {
        const json = converted.layers[index];
        if (layer.type !== json.typeId || layer.themeIndex !== json.themeId ||
            Math.abs(layer.scrollSpeed - json.scrollSpeed) > 0.00001 ||
            layer.world.width !== json.world.width || layer.world.height !== json.world.height) {
          mismatches.push(`${name}: layer ${index} metadata`);
          continue;
        }
        for (let y = 0; y < layer.world.height; y++) {
          for (let x = 0; x < layer.world.width; x++) {
            tileCount++;
            const binaryTile = layer.world.tiles[x][y];
            // The binary parser calculates background skip lengths; each
            // negative value still denotes the same empty tile as JSON -1.
            const normalized = binaryTile < 0 ? -1 : binaryTile;
            if (normalized !== json.world.tiles[y][x] && mismatches.length < 20) {
              mismatches.push(`${name}: layer ${index} tile ${x},${y}: ${String(binaryTile)} vs ${json.world.tiles[y][x]}`);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
    expect(tileCount).toBeGreaterThan(700_000);
    expect(mismatches).toEqual([]);
  });

  test('tile bytes are read as signed, so 255 means empty', () => {
    // TiledWorld.java reads each tile as `(byte)byteStream.read()`, so 0xff is
    // -1 rather than 255. An unsigned read would turn every empty tile into a
    // tile index far past the end of the tileset.
    const parser = new LevelParser();
    const bytes = new Uint8Array(readFileSync(join(rawDir, 'level_0_1_sewer.bin')));
    const parsed = parser.parseLevelData(bytes);
    expect(parsed).not.toBeNull();
    const tiles = (parsed!.collisionLayer ?? parsed!.layers[0].world).tiles;
    const values = new Set<number>();
    for (const column of tiles) for (const value of column) values.add(value);
    expect([...values].some((v) => v === -1), 'no empty tiles found').toBe(true);
    expect([...values].every((v) => v >= -1 && v < 256)).toBe(true);
  });
});

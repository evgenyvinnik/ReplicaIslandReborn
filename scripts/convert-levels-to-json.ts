#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Convert binary .bin level files to JSON format
 * Run with: bun run scripts/convert-levels-to-json.ts
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Constants from the binary format
const LEVEL_SIGNATURE = 96;
const TILED_WORLD_SIGNATURE = 42;

const LayerTypeName: Record<number, string> = {
  0: 'background',
  1: 'collision',
  2: 'objects',
  3: 'hotspots',
};

const ThemeName: Record<number, string> = {
  0: 'grass',
  1: 'island',
  2: 'sewer',
  3: 'underground',
  4: 'lab',
  5: 'lighting',
  6: 'tutorial',
};

const BackgroundName: Record<number, string> = {
  0: 'sunset',
  1: 'island',
  2: 'sewer',
  3: 'underground',
  4: 'forest',
  5: 'island2',
  6: 'lab',
};

interface TiledWorldJSON {
  width: number;
  height: number;
  // Store as row-major 2D array for readability: tiles[y][x]
  tiles: number[][];
}

interface LayerJSON {
  type: string;
  typeId: number;
  theme: string;
  themeId: number;
  scrollSpeed: number;
  world: TiledWorldJSON;
}

interface LevelJSON {
  format: 'replica-island-level';
  version: 1;
  background: string;
  backgroundId: number;
  layers: LayerJSON[];
}

/**
 * Convert byte array to int (little endian)
 */
function byteArrayToInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset + 3] & 0xff) << 24) |
    ((bytes[offset + 2] & 0xff) << 16) |
    ((bytes[offset + 1] & 0xff) << 8) |
    (bytes[offset] & 0xff)
  );
}

/**
 * Convert byte array to float (little endian)
 */
function byteArrayToFloat(bytes: Uint8Array, offset: number): number {
  const intBits = byteArrayToInt(bytes, offset);
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, intBits);
  return view.getFloat32(0);
}

/**
 * Parse TiledWorld from binary data
 */
function parseTiledWorld(data: Uint8Array, offset: number): { world: TiledWorldJSON; bytesRead: number } | null {
  const signature = data[offset];
  if (signature !== TILED_WORLD_SIGNATURE) {
    console.error(`Invalid TiledWorld signature: ${signature}, expected ${TILED_WORLD_SIGNATURE}`);
    return null;
  }

  let currentOffset = offset + 1;

  const width = byteArrayToInt(data, currentOffset);
  currentOffset += 4;
  const height = byteArrayToInt(data, currentOffset);
  currentOffset += 4;

  if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
    console.error(`Invalid dimensions: ${width}x${height}`);
    return null;
  }

  // Read tiles in row-major order for JSON (tiles[y][x])
  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      let tileValue = data[currentOffset++];
      // Convert to signed byte
      if (tileValue > 127) {
        tileValue = tileValue - 256;
      }
      row.push(tileValue);
    }
    tiles.push(row);
  }

  return {
    world: { width, height, tiles },
    bytesRead: currentOffset - offset,
  };
}

/**
 * Parse binary level file to JSON structure
 */
function parseBinaryLevel(data: Uint8Array): LevelJSON | null {
  let offset = 0;

  const signature = data[offset++];
  if (signature !== LEVEL_SIGNATURE) {
    console.error(`Invalid level signature: ${signature}, expected ${LEVEL_SIGNATURE}`);
    return null;
  }

  const layerCount = data[offset++];
  const backgroundIndex = data[offset++];

  const layers: LayerJSON[] = [];

  for (let i = 0; i < layerCount; i++) {
    const layerType = data[offset++];
    const themeIndex = data[offset++];
    const scrollSpeed = byteArrayToFloat(data, offset);
    offset += 4;

    const result = parseTiledWorld(data, offset);
    if (!result) {
      console.error(`Failed to parse TiledWorld for layer ${i}`);
      return null;
    }
    offset += result.bytesRead;

    layers.push({
      type: LayerTypeName[layerType] || `unknown_${layerType}`,
      typeId: layerType,
      theme: ThemeName[themeIndex] || `unknown_${themeIndex}`,
      themeId: themeIndex,
      scrollSpeed: Math.round(scrollSpeed * 1000) / 1000, // Round to 3 decimal places
      world: result.world,
    });
  }

  return {
    format: 'replica-island-level',
    version: 1,
    background: BackgroundName[backgroundIndex] || `unknown_${backgroundIndex}`,
    backgroundId: backgroundIndex,
    layers,
  };
}

/**
 * Format level JSON with compact tile matrix representation
 * Keeps tiles as a readable matrix where each row is on one line
 */
function formatLevelJson(level: LevelJSON): string {
  const lines: string[] = [];
  lines.push('{');
  lines.push(`  "format": "${level.format}",`);
  lines.push(`  "version": ${level.version},`);
  lines.push(`  "background": "${level.background}",`);
  lines.push(`  "backgroundId": ${level.backgroundId},`);
  lines.push('  "layers": [');

  level.layers.forEach((layer, layerIndex) => {
    lines.push('    {');
    lines.push(`      "type": "${layer.type}",`);
    lines.push(`      "typeId": ${layer.typeId},`);
    lines.push(`      "theme": "${layer.theme}",`);
    lines.push(`      "themeId": ${layer.themeId},`);
    lines.push(`      "scrollSpeed": ${layer.scrollSpeed},`);
    lines.push('      "world": {');
    lines.push(`        "width": ${layer.world.width},`);
    lines.push(`        "height": ${layer.world.height},`);
    lines.push('        "tiles": [');

    // Format each row of tiles on a single line for readability
    layer.world.tiles.forEach((row, rowIndex) => {
      // Pad numbers to align columns (assuming tile values -128 to 127)
      const formattedRow = row.map(tile => {
        const val = tile ?? -1;  // Handle undefined/null tiles
        const str = val.toString();
        // Pad to 3 characters for alignment
        return str.padStart(3, ' ');
      }).join(',');
      
      const comma = rowIndex < layer.world.tiles.length - 1 ? ',' : '';
      lines.push(`          [${formattedRow}]${comma}`);
    });

    lines.push('        ]');
    lines.push('      }');
    
    const layerComma = layerIndex < level.layers.length - 1 ? ',' : '';
    lines.push(`    }${layerComma}`);
  });

  lines.push('  ]');
  lines.push('}');

  return lines.join('\n');
}

async function convertLevels(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const levelsDir = join(__dirname, '../public/assets/levels');
  
  console.log(`\nConverting levels in: ${levelsDir}\n`);
  
  const files = await readdir(levelsDir);
  const binFiles = files.filter((f: string) => f.endsWith('.bin'));
  
  console.log(`Found ${binFiles.length} .bin files to convert\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const binFile of binFiles) {
    const binPath = join(levelsDir, binFile);
    const jsonFile = binFile.replace('.bin', '.json');
    const jsonPath = join(levelsDir, jsonFile);
    
    try {
      const data = await readFile(binPath);
      const uint8Data = new Uint8Array(data);
      
      const levelJson = parseBinaryLevel(uint8Data);
      
      if (levelJson) {
        // Custom JSON formatting to keep tiles as readable matrix
        const jsonContent = formatLevelJson(levelJson);
        await writeFile(jsonPath, jsonContent);
        
        // Calculate sizes for report
        const binSize = data.length;
        const jsonSize = jsonContent.length;
        const ratio = (jsonSize / binSize).toFixed(1);
        
        console.log(`✓ ${binFile} → ${jsonFile}`);
        console.log(`  Layers: ${levelJson.layers.length}, Background: ${levelJson.background}`);
        console.log(`  Size: ${binSize} bytes → ${jsonSize} bytes (${ratio}x)\n`);
        successCount++;
      } else {
        console.error(`✗ Failed to parse: ${binFile}\n`);
        errorCount++;
      }
    } catch (err) {
      console.error(`✗ Error converting ${binFile}:`, err);
      errorCount++;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Conversion complete: ${successCount} succeeded, ${errorCount} failed`);
  console.log(`${'='.repeat(50)}\n`);
}

// Run the conversion
convertLevels().catch(console.error);

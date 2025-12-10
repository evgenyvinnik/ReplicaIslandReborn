/**
 * Convert collision.bin to JSON format
 * 
 * The collision.bin file format:
 * - Byte 0: Signature (must be 52)
 * - Byte 1: Number of collision tiles
 * - For each tile:
 *   - Byte: tile index
 *   - Byte: segment count
 *   - For each segment: 6 floats (24 bytes total)
 *     - startX, startY, endX, endY, normalX, normalY
 */

import * as fs from 'fs';
import * as path from 'path';

interface LineSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  normalX: number;
  normalY: number;
}

interface CollisionTile {
  index: number;
  segments: LineSegment[];
}

interface CollisionData {
  version: 1;
  tileCount: number;
  tiles: { [key: number]: CollisionTile };
}

function readFloat(buffer: Buffer, offset: number): number {
  return buffer.readFloatLE(offset);
}

function convertCollisionBin(inputPath: string, outputPath: string): void {
  // console.log(`Reading collision data from: ${inputPath}`);
  
  const buffer = fs.readFileSync(inputPath);
  
  // Check signature
  const signature = buffer.readUInt8(0);
  if (signature !== 52) {
    throw new Error(`Invalid signature: expected 52, got ${signature}`);
  }
  
  const tileCount = buffer.readUInt8(1);
  // console.log(`Found ${tileCount} collision tiles`);
  
  const collisionData: CollisionData = {
    version: 1,
    tileCount: tileCount,
    tiles: {}
  };
  
  let offset = 2; // Start after signature and tile count
  
  for (let i = 0; i < tileCount; i++) {
    const tileIndex = buffer.readUInt8(offset);
    offset += 1;
    
    const segmentCount = buffer.readUInt8(offset);
    offset += 1;
    
    const segments: LineSegment[] = [];
    
    for (let s = 0; s < segmentCount; s++) {
      const startX = readFloat(buffer, offset);
      offset += 4;
      const startY = readFloat(buffer, offset);
      offset += 4;
      const endX = readFloat(buffer, offset);
      offset += 4;
      const endY = readFloat(buffer, offset);
      offset += 4;
      const normalX = readFloat(buffer, offset);
      offset += 4;
      const normalY = readFloat(buffer, offset);
      offset += 4;
      
      // Convert from OpenGL coordinates (Y up, origin at bottom-left) 
      // to screen coordinates (Y down, origin at top-left)
      // Within a 32x32 tile: newY = 32 - oldY
      // Normal Y must also be negated
      const TILE_SIZE = 32;
      
      segments.push({
        startX: Math.round(startX * 1000) / 1000,
        startY: Math.round((TILE_SIZE - startY) * 1000) / 1000,
        endX: Math.round(endX * 1000) / 1000,
        endY: Math.round((TILE_SIZE - endY) * 1000) / 1000,
        normalX: Math.round(normalX * 1000) / 1000,
        normalY: Math.round(-normalY * 1000) / 1000,  // Negate Y normal
      });
    }
    
    collisionData.tiles[tileIndex] = {
      index: tileIndex,
      segments: segments
    };
    
    // console.log(`Tile ${tileIndex}: ${segmentCount} segments`);
  }
  
  // Write JSON output
  const jsonOutput = JSON.stringify(collisionData, null, 2);
  fs.writeFileSync(outputPath, jsonOutput);
  // console.log(`\nWritten collision data to: ${outputPath}`);
  
  // Print some statistics
  let totalSegments = 0;
  for (const tileIndex in collisionData.tiles) {
    totalSegments += collisionData.tiles[tileIndex].segments.length;
  }
  // console.log(`Total segments: ${totalSegments}`);
}

// Main
const scriptDir = path.dirname(process.argv[1]);
const projectRoot = path.resolve(scriptDir, '..');
const inputPath = path.join(projectRoot, 'Original/res/raw/collision.bin');
const outputPath = path.join(projectRoot, 'public/assets/collision.json');

try {
  convertCollisionBin(inputPath, outputPath);
} catch (error) {
  // console.error('Error converting collision data:', error);
  process.exit(1);
}

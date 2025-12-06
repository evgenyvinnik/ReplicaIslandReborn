
import { readFileSync } from 'fs';
import { join } from 'path';
import { LevelParser } from '../src/levels/LevelParser';

const parser = new LevelParser();
const levelPath = join(process.cwd(), 'public/assets/levels/level_0_1_sewer.bin');

console.log(`Reading level file from: ${levelPath}`);

try {
  const buffer = readFileSync(levelPath);
  const data = new Uint8Array(buffer);
  
  console.log(`File size: ${data.length} bytes`);
  console.log(`First byte (signature): ${data[0]}`);
  
  const parsed = parser.parseLevelData(data);
  
  if (parsed) {
    console.log('Level parsed successfully!');
    console.log(`Background Index: ${parsed.backgroundIndex}`);
    console.log(`Background Image: ${parsed.backgroundImage}`);
    console.log(`Layers: ${parsed.layers.length}`);
    console.log(`Dimensions: ${parsed.widthInTiles}x${parsed.heightInTiles}`);
    
    if (parsed.collisionLayer) {
        console.log('Collision layer present');
    } else {
        console.log('Collision layer MISSING');
    }
    
    if (parsed.objectLayer) {
        console.log('Object layer present');
    } else {
        console.log('Object layer MISSING');
    }

  } else {
    console.error('Failed to parse level data.');
  }
  
} catch (error) {
  console.error('Error reading or parsing file:', error);
}

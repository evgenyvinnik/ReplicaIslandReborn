/**
 * Level Parser - Parses binary .bin level files from the original Replica Island
 * Ported from: Original/src/com/replica/replicaisland/LevelSystem.java
 *              Original/src/com/replica/replicaisland/TiledWorld.java
 *              Original/src/com/replica/replicaisland/LevelBuilder.java
 * 
 * Binary Level Format (signature 96):
 * - Byte 0: Signature (must be 96)
 * - Byte 1: Layer count
 * - Byte 2: Background index (0-6, maps to background image)
 * - For each layer:
 *   - Byte 0: Layer type (0=background tiles, 1=collision, 2=objects, 3=hot spots)
 *   - Byte 1: Tile/theme index (maps to tileset image)
 *   - Bytes 2-5: Scroll speed (float, 4 bytes)
 *   - Then: TiledWorld data for this layer
 * 
 * TiledWorld Data Format (signature 42):
 * - Byte 0: Signature (must be 42)
 * - Bytes 1-4: Width in tiles (int, 4 bytes)
 * - Bytes 5-8: Height in tiles (int, 4 bytes)
 * - Remaining: Tile data (width × height bytes, row by row)
 */

// Layer type constants
export const LayerType = {
  BACKGROUND: 0,
  COLLISION: 1,
  OBJECTS: 2,
  HOT_SPOTS: 3,
} as const;

// Theme/tileset mapping
export const Theme = {
  GRASS: 0,
  ISLAND: 1,
  SEWER: 2,
  UNDERGROUND: 3,
  LAB: 4,
  LIGHTING: 5,
  TUTORIAL: 6,
} as const;

// Background image mapping
export const Background = {
  SUNSET: 0,
  ISLAND: 1,
  SEWER: 2,
  UNDERGROUND: 3,
  FOREST: 4,
  ISLAND2: 5,
  LAB: 6,
} as const;

// Theme to tileset image mapping
export const ThemeTilesets: Record<number, string> = {
  [Theme.GRASS]: 'grass',
  [Theme.ISLAND]: 'island',
  [Theme.SEWER]: 'sewage',
  [Theme.UNDERGROUND]: 'cave',
  [Theme.LAB]: 'lab',
  [Theme.LIGHTING]: 'titletileset',
  [Theme.TUTORIAL]: 'tutorial',
};

// Background index to image mapping
export const BackgroundImages: Record<number, string> = {
  [Background.SUNSET]: 'background_sunset',
  [Background.ISLAND]: 'background_island',
  [Background.SEWER]: 'background_sewage',
  [Background.UNDERGROUND]: 'background_underground',
  [Background.FOREST]: 'background_grass2',
  [Background.ISLAND2]: 'background_island2',
  [Background.LAB]: 'background_lab01',
};

/**
 * Represents a TiledWorld layer
 * Note: tiles are stored in COLUMN-MAJOR order as tiles[x][y] to match original Java code
 */
export interface TiledWorldData {
  width: number;
  height: number;
  tiles: number[][]; // tiles[x][y] - column-major order
}

/**
 * Represents a parsed layer from the level file
 */
export interface ParsedLayer {
  type: number;
  themeIndex: number;
  scrollSpeed: number;
  world: TiledWorldData;
}

/**
 * Represents a fully parsed level
 */
export interface ParsedLevel {
  backgroundIndex: number;
  backgroundImage: string;
  layers: ParsedLayer[];
  
  // Extracted layer references for convenience
  backgroundLayers: ParsedLayer[];
  collisionLayer: TiledWorldData | null;
  objectLayer: TiledWorldData | null;
  hotSpotLayer: TiledWorldData | null;
  
  // Dimensions from collision layer
  widthInTiles: number;
  heightInTiles: number;
  tileWidth: number;
  tileHeight: number;
}

/**
 * Utility to convert byte array to int (big endian)
 */
function byteArrayToInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0xff) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff)
  );
}

/**
 * Utility to convert byte array to float
 */
function byteArrayToFloat(bytes: Uint8Array, offset: number): number {
  const intBits = byteArrayToInt(bytes, offset);
  // Convert int bits to float using DataView
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, intBits);
  return view.getFloat32(0);
}

/**
 * Parse a TiledWorld from binary data
 * Format: signature (42), width (4 bytes), height (4 bytes), tile data
 * Note: Data is read row by row but stored column-major as tiles[x][y] to match original Java
 */
function parseTiledWorld(data: Uint8Array, offset: number): { world: TiledWorldData; bytesRead: number } | null {
  const signature = data[offset];
  if (signature !== 42) {
    console.error(`Invalid TiledWorld signature: ${signature}, expected 42`);
    return null;
  }

  let currentOffset = offset + 1;

  // Read width and height
  const width = byteArrayToInt(data, currentOffset);
  currentOffset += 4;
  const height = byteArrayToInt(data, currentOffset);
  currentOffset += 4;

  // Initialize column-major tiles array: tiles[x][y]
  const tiles: number[][] = [];
  for (let x = 0; x < width; x++) {
    tiles[x] = new Array(height);
  }

  // Read tile data row by row, but store in column-major order
  // This matches the original Java: mTilesArray[x][y] = (byte)byteStream.read()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Tile values are signed bytes
      let tileValue = data[currentOffset++];
      // Convert to signed
      if (tileValue > 127) {
        tileValue = tileValue - 256;
      }
      tiles[x][y] = tileValue;
    }
  }

  const bytesRead = currentOffset - offset;

  return {
    world: { width, height, tiles },
    bytesRead,
  };
}

/**
 * Calculate skip values for empty tiles (optimization from original game)
 * Empty tiles are marked with negative values indicating how many tiles to skip
 * tiles[x][y] - column-major order
 */
function calculateSkips(world: TiledWorldData): void {
  let emptyTileCount = 0;
  for (let y = world.height - 1; y >= 0; y--) {
    for (let x = world.width - 1; x >= 0; x--) {
      if (world.tiles[x][y] < 0) {
        emptyTileCount++;
        world.tiles[x][y] = -emptyTileCount;
      } else {
        emptyTileCount = 0;
      }
    }
  }
}

/**
 * Main level parser class
 */
export class LevelParser {
  /**
   * Parse a binary level file
   */
  async parseLevel(url: string): Promise<ParsedLevel | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch level: ${response.status} ${response.statusText}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      return this.parseLevelData(data);
    } catch (error) {
      console.error('Error parsing level:', error);
      return null;
    }
  }

  /**
   * Parse level data from a Uint8Array
   */
  parseLevelData(data: Uint8Array): ParsedLevel | null {
    let offset = 0;

    // Check signature
    const signature = data[offset++];
    if (signature !== 96) {
      console.error(`Invalid level signature: ${signature}, expected 96`);
      return null;
    }

    // Read header
    const layerCount = data[offset++];
    const backgroundIndex = data[offset++];

    // Default tile size (as in original)
    const tileWidth = 32;
    const tileHeight = 32;

    const layers: ParsedLayer[] = [];
    const backgroundLayers: ParsedLayer[] = [];
    let collisionLayer: TiledWorldData | null = null;
    let objectLayer: TiledWorldData | null = null;
    let hotSpotLayer: TiledWorldData | null = null;
    let widthInTiles = 0;
    let heightInTiles = 0;

    // Parse each layer
    for (let i = 0; i < layerCount; i++) {
      const layerType = data[offset++];
      const themeIndex = data[offset++];

      // Read scroll speed (4 bytes float)
      const scrollSpeed = byteArrayToFloat(data, offset);
      offset += 4;

      // Parse the TiledWorld for this layer
      const result = parseTiledWorld(data, offset);
      if (!result) {
        console.error(`Failed to parse TiledWorld for layer ${i}`);
        return null;
      }

      offset += result.bytesRead;

      const layer: ParsedLayer = {
        type: layerType,
        themeIndex,
        scrollSpeed,
        world: result.world,
      };

      layers.push(layer);

      // Sort into appropriate category
      switch (layerType) {
        case LayerType.BACKGROUND:
          // Calculate skips for background layers
          calculateSkips(result.world);
          backgroundLayers.push(layer);
          break;

        case LayerType.COLLISION:
          // Collision layer defines world boundaries
          widthInTiles = result.world.width;
          heightInTiles = result.world.height;
          collisionLayer = result.world;
          break;

        case LayerType.OBJECTS:
          objectLayer = result.world;
          break;

        case LayerType.HOT_SPOTS:
          hotSpotLayer = result.world;
          break;
      }
    }

    // Determine background image
    const backgroundImage = BackgroundImages[backgroundIndex] || 'background_island';

    return {
      backgroundIndex,
      backgroundImage,
      layers,
      backgroundLayers,
      collisionLayer,
      objectLayer,
      hotSpotLayer,
      widthInTiles,
      heightInTiles,
      tileWidth,
      tileHeight,
    };
  }

  /**
   * Get the tileset name for a layer's theme
   */
  getTilesetForTheme(themeIndex: number): string {
    return ThemeTilesets[themeIndex] || 'island';
  }

  /**
   * Get tile at world position
   */
  getTileAtWorldPos(
    world: TiledWorldData,
    worldX: number,
    worldY: number,
    tileWidth: number,
    tileHeight: number,
    levelHeight: number
  ): number {
    // Convert world coordinates to tile coordinates
    // Note: Y is flipped in the original game (origin at bottom-left)
    const tileX = Math.floor(worldX / tileWidth);
    const tileY = Math.floor((levelHeight - worldY) / tileHeight);

    return this.getTile(world, tileX, tileY);
  }

  /**
   * Get tile at tile coordinates
   * tiles[x][y] - column-major order
   */
  getTile(world: TiledWorldData, tileX: number, tileY: number): number {
    if (tileX < 0 || tileX >= world.width || tileY < 0 || tileY >= world.height) {
      return -1;
    }
    return world.tiles[tileX][tileY];
  }
}

// Export singleton instance
export const levelParser = new LevelParser();

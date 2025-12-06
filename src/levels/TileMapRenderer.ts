/**
 * Tile Map Renderer - Renders tiled backgrounds from parsed level data
 * Ported from: Original/src/com/replica/replicaisland/TiledVertexGrid.java
 *              Original/src/com/replica/replicaisland/ScrollerComponent.java
 * 
 * Supports:
 * - Multiple tile layers with different parallax speeds
 * - Tileset-based rendering
 * - Optimized rendering with skip markers
 */

import type { RenderSystem } from '../engine/RenderSystem';
import type { CameraSystem } from '../engine/CameraSystem';
import type { ParsedLevel, ParsedLayer, TiledWorldData } from './LevelParser';
import { ThemeTilesets } from './LevelParser';

/**
 * Tile layer configuration for rendering
 */
interface TileLayerConfig {
  world: TiledWorldData;
  tileset: string;
  scrollSpeedX: number;
  scrollSpeedY: number;
  priority: number;  // z-order
}

/**
 * Tile Map Renderer
 * Efficiently renders tile-based backgrounds with parallax scrolling
 */
export class TileMapRenderer {
  private layers: TileLayerConfig[] = [];
  private tileWidth: number = 32;
  private tileHeight: number = 32;
  private viewWidth: number = 480;
  private viewHeight: number = 320;
  
  // Level bounds
  private levelWidth: number = 0;
  private levelHeight: number = 0;

  /**
   * Initialize from a parsed level
   */
  initializeFromLevel(level: ParsedLevel): void {
    this.layers = [];
    this.tileWidth = level.tileWidth;
    this.tileHeight = level.tileHeight;
    this.levelWidth = level.widthInTiles * level.tileWidth;
    this.levelHeight = level.heightInTiles * level.tileHeight;

    // Add background layers with increasing priority
    let priority = -100;
    for (const bgLayer of level.backgroundLayers) {
      this.addLayerFromParsed(bgLayer, priority);
      priority += 10;
    }
  }

  /**
   * Add a layer from parsed level data
   */
  private addLayerFromParsed(layer: ParsedLayer, priority: number): void {
    const tileset = ThemeTilesets[layer.themeIndex] || 'island';
    
    // Calculate scroll speeds
    // Original game locks parallax to smaller dimension
    let scrollSpeedX = 1.0;
    let scrollSpeedY = 1.0;

    if (layer.world.width > layer.world.height) {
      scrollSpeedX = layer.scrollSpeed;
    } else {
      scrollSpeedY = layer.scrollSpeed;
    }

    this.layers.push({
      world: layer.world,
      tileset,
      scrollSpeedX,
      scrollSpeedY,
      priority,
    });

    // Sort layers by priority
    this.layers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Set the viewport dimensions
   */
  setViewport(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  /**
   * Set level dimensions
   */
  setLevelSize(width: number, height: number): void {
    this.levelWidth = width;
    this.levelHeight = height;
  }

  /**
   * Add a custom layer
   */
  addLayer(config: TileLayerConfig): void {
    this.layers.push(config);
    this.layers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Clear all layers
   */
  clearLayers(): void {
    this.layers = [];
  }

  /**
   * Render all tile layers
   */
  render(renderSystem: RenderSystem, camera: CameraSystem): void {
    const cameraX = camera.getFocusPositionX() - this.viewWidth / 2;
    const cameraY = camera.getFocusPositionY() - this.viewHeight / 2;

    for (const layer of this.layers) {
      this.renderLayer(renderSystem, layer, cameraX, cameraY);
    }
  }

  /**
   * Render a single tile layer
   */
  private renderLayer(
    renderSystem: RenderSystem,
    layer: TileLayerConfig,
    cameraX: number,
    cameraY: number
  ): void {
    const world = layer.world;
    
    // Calculate parallax-adjusted camera position
    const parallaxX = cameraX * layer.scrollSpeedX;
    const parallaxY = cameraY * layer.scrollSpeedY;

    // Calculate tile coordinates for rendering
    // Note: Y is flipped (world origin at bottom-left, tile origin at top-left)
    const startTileX = Math.max(0, Math.floor(parallaxX / this.tileWidth) - 1);
    const endTileX = Math.min(
      world.width,
      Math.ceil((parallaxX + this.viewWidth) / this.tileWidth) + 1
    );

    // For Y, we need to account for the coordinate flip
    // In the original game, world origin is at bottom-left
    // Tiles are stored with y=0 at top of level
    const worldYBottom = cameraY;
    const worldYTop = cameraY + this.viewHeight;
    
    // Convert to tile coordinates 
    // The world height represents the full level, Y=0 is at bottom
    // Tile y=0 is at the TOP of the level, so we need to flip
    const tilesPerColumn = world.height;
    const startTileY = Math.max(0, tilesPerColumn - 1 - Math.ceil((worldYTop) / this.tileHeight) - 1);
    const endTileY = Math.min(
      world.height,
      tilesPerColumn - Math.floor((worldYBottom) / this.tileHeight) + 1
    );

    // Render visible tiles - tiles[x][y] is column-major
    for (let tileY = startTileY; tileY < endTileY; tileY++) {
      let tileX = startTileX;
      
      while (tileX < endTileX) {
        // Access tiles in column-major order: tiles[x][y]
        const tileValue = world.tiles[tileX]?.[tileY];
        
        // Handle skip markers (negative values indicate how many empty tiles to skip)
        if (tileValue === undefined || tileValue < 0) {
          if (tileValue !== undefined && tileValue < -1) {
            // Skip marker - jump ahead
            tileX += Math.min(-tileValue, endTileX - tileX);
          } else {
            tileX++;
          }
          continue;
        }

        // Calculate world position for this tile
        // X: direct mapping
        // Y: flipped (tile row 0 is at top of level, but world Y=0 at bottom)
        const worldX = tileX * this.tileWidth;
        const worldY = (tilesPerColumn - 1 - tileY) * this.tileHeight;

        // Apply parallax offset for rendering
        const renderX = worldX + (cameraX - parallaxX);
        const renderY = worldY + (cameraY - parallaxY);

        // Queue tile for rendering
        renderSystem.drawTile(
          layer.tileset,
          renderX,
          renderY,
          tileValue,
          layer.priority
        );

        tileX++;
      }
    }
  }

  /**
   * Get tile at world position from the collision/main layer
   * tiles[x][y] - column-major order
   */
  getTileAt(worldX: number, worldY: number, layerIndex: number = 0): number {
    if (layerIndex >= this.layers.length) return -1;

    const layer = this.layers[layerIndex];
    const tileX = Math.floor(worldX / this.tileWidth);
    
    // Flip Y coordinate: world Y=0 is bottom, tile Y=0 is top
    const tilesPerColumn = layer.world.height;
    const tileY = tilesPerColumn - 1 - Math.floor(worldY / this.tileHeight);

    if (tileX < 0 || tileX >= layer.world.width || 
        tileY < 0 || tileY >= layer.world.height) {
      return -1;
    }

    // Column-major: tiles[x][y]
    return layer.world.tiles[tileX][tileY];
  }

  /**
   * Get tile dimensions
   */
  getTileSize(): { width: number; height: number } {
    return { width: this.tileWidth, height: this.tileHeight };
  }

  /**
   * Get level dimensions in pixels
   */
  getLevelSize(): { width: number; height: number } {
    return { width: this.levelWidth, height: this.levelHeight };
  }

  /**
   * Get number of layers
   */
  getLayerCount(): number {
    return this.layers.length;
  }
}

// Export singleton instance
export const tileMapRenderer = new TileMapRenderer();

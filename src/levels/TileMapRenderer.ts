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
    // Note: Collision layer is NOT rendered - it only contains collision data
    // The visual tiles come from background layers only
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
   * Renders directly to canvas to handle parallax correctly
   */
  render(renderSystem: RenderSystem, camera: CameraSystem): void {
    const cameraX = camera.getFocusPositionX() - this.viewWidth / 2;
    const cameraY = camera.getFocusPositionY() - this.viewHeight / 2;

    // Get canvas context for direct rendering
    const ctx = (renderSystem as unknown as { ctx: CanvasRenderingContext2D }).ctx;
    
    if (!ctx || this.layers.length === 0) {
      console.warn('[TileMapRenderer.render] Early exit - ctx:', !!ctx, 'layers:', this.layers.length);
      return;
    }

    for (const layer of this.layers) {
      this.renderLayerDirect(renderSystem, ctx, layer, cameraX, cameraY);
    }
  }

  /**
   * Render a single tile layer directly to canvas
   * This handles parallax scrolling by calculating screen positions directly
   */
  private renderLayerDirect(
    renderSystem: RenderSystem,
    ctx: CanvasRenderingContext2D,
    layer: TileLayerConfig,
    cameraX: number,
    cameraY: number
  ): void {
    const world = layer.world;
    
    // Calculate parallax-adjusted camera position for this layer
    const parallaxCameraX = cameraX * layer.scrollSpeedX;
    const parallaxCameraY = cameraY * layer.scrollSpeedY;

    // Calculate tile coordinates for rendering based on parallax camera
    const startTileX = Math.max(0, Math.floor(parallaxCameraX / this.tileWidth) - 1);
    const endTileX = Math.min(
      world.width,
      Math.ceil((parallaxCameraX + this.viewWidth) / this.tileWidth) + 1
    );

    const startTileY = Math.max(0, Math.floor(parallaxCameraY / this.tileHeight) - 1);
    const endTileY = Math.min(
      world.height,
      Math.ceil((parallaxCameraY + this.viewHeight) / this.tileHeight) + 1
    );

    // Get tileset image
    const tilesetImage = renderSystem.getSpriteImage(layer.tileset);
    if (!tilesetImage) {
      console.warn('[TileMapRenderer] No tileset image for:', layer.tileset);
      return;
    }
    
    // Calculate tileset grid dimensions
    const tilesPerRow = Math.floor(tilesetImage.width / this.tileWidth);
    
    // Debug: count rendered tiles
    let tilesRendered = 0;

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
        const worldX = tileX * this.tileWidth;
        const worldY = tileY * this.tileHeight;

        // Calculate screen position with parallax
        // Screen position = world position - parallax camera offset
        const screenX = worldX - parallaxCameraX;
        const screenY = worldY - parallaxCameraY;

        // Calculate source rectangle in tileset
        const srcX = (tileValue % tilesPerRow) * this.tileWidth;
        const srcY = Math.floor(tileValue / tilesPerRow) * this.tileHeight;

        // Draw the tile directly to canvas
        ctx.drawImage(
          tilesetImage,
          srcX,
          srcY,
          this.tileWidth,
          this.tileHeight,
          Math.floor(screenX),
          Math.floor(screenY),
          this.tileWidth,
          this.tileHeight
        );

        tilesRendered++;
        tileX++;
      }
    }
    
    // Log once per layer to see if tiles are being rendered
    if (tilesRendered === 0) {
      console.warn('[TileMapRenderer] NO tiles rendered for layer', layer.tileset, 
        'camera:', cameraX.toFixed(0), cameraY.toFixed(0),
        'tile range x:', startTileX, '-', endTileX,
        'tile range y:', startTileY, '-', endTileY,
        'world size:', world.width, 'x', world.height,
        'tiles array:', world.tiles?.length, 'x', world.tiles?.[0]?.length);
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
    const tileY = Math.floor(worldY / this.tileHeight);  // Direct mapping, no Y flip

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

/**
 * Tile Map - Renders tiled backgrounds
 * Ported from: Original/src/com/replica/replicaisland/TiledWorld.java
 */

import type { LevelLayer } from '../types';
import type { RenderSystem } from '../engine/RenderSystem';
import type { CameraSystem } from '../engine/CameraSystem';

export class TileMap {
  private layers: LevelLayer[] = [];
  private tileWidth: number = 32;
  private tileHeight: number = 32;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  private tilesetName: string = 'tileset';

  /**
   * Set the tileset sprite name
   */
  setTileset(name: string): void {
    this.tilesetName = name;
  }

  /**
   * Set tile dimensions
   */
  setTileSize(width: number, height: number): void {
    this.tileWidth = width;
    this.tileHeight = height;
  }

  /**
   * Set map dimensions (in tiles)
   */
  setMapSize(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  /**
   * Set the layers to render
   */
  setLayers(layers: LevelLayer[]): void {
    this.layers = layers;
  }

  /**
   * Add a layer
   */
  addLayer(layer: LevelLayer): void {
    this.layers.push(layer);
  }

  /**
   * Clear all layers
   */
  clearLayers(): void {
    this.layers = [];
  }

  /**
   * Load from a simple tile array
   */
  loadFromArray(
    data: number[],
    width: number,
    height: number,
    tileSize: number = 32
  ): void {
    this.mapWidth = width;
    this.mapHeight = height;
    this.tileWidth = tileSize;
    this.tileHeight = tileSize;

    // Create a single layer from the data
    this.layers = [
      {
        name: 'main',
        data: [...data],
        visible: true,
        parallaxX: 1,
        parallaxY: 1,
      },
    ];
  }

  /**
   * Render visible tiles
   */
  render(renderSystem: RenderSystem, camera: CameraSystem): void {
    const cameraX = camera.getFocusPositionX();
    const cameraY = camera.getFocusPositionY();
    const viewWidth = camera.getViewportWidth();
    const viewHeight = camera.getViewportHeight();

    // Calculate visible tile range with buffer
    const startTileX = Math.max(0, Math.floor(cameraX / this.tileWidth) - 1);
    const startTileY = Math.max(0, Math.floor(cameraY / this.tileHeight) - 1);
    const endTileX = Math.min(
      this.mapWidth,
      Math.ceil((cameraX + viewWidth) / this.tileWidth) + 1
    );
    const endTileY = Math.min(
      this.mapHeight,
      Math.ceil((cameraY + viewHeight) / this.tileHeight) + 1
    );

    // Render each layer
    for (const layer of this.layers) {
      if (!layer.visible) continue;

      // Calculate parallax offset
      const parallaxOffsetX = cameraX * (1 - layer.parallaxX);
      const parallaxOffsetY = cameraY * (1 - layer.parallaxY);

      // Determine z-depth based on layer name
      let zDepth = -10;
      if (layer.name.includes('foreground')) {
        zDepth = 10;
      } else if (layer.name.includes('background')) {
        zDepth = -20;
      }

      // Render visible tiles
      for (let y = startTileY; y < endTileY; y++) {
        for (let x = startTileX; x < endTileX; x++) {
          const tileIndex = y * this.mapWidth + x;
          const tileId = layer.data[tileIndex];

          // Skip empty tiles (0 typically means empty)
          if (tileId <= 0) continue;

          // Calculate world position with parallax
          const worldX = x * this.tileWidth + parallaxOffsetX;
          const worldY = y * this.tileHeight + parallaxOffsetY;

          // Queue tile for rendering (tileId - 1 because tileset indices often start at 1)
          renderSystem.drawTile(
            this.tilesetName,
            worldX,
            worldY,
            tileId - 1,
            zDepth
          );
        }
      }
    }
  }

  /**
   * Get tile at world position
   */
  getTileAt(worldX: number, worldY: number, layerIndex: number = 0): number {
    if (layerIndex >= this.layers.length) return 0;

    const tileX = Math.floor(worldX / this.tileWidth);
    const tileY = Math.floor(worldY / this.tileHeight);

    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
      return 0;
    }

    const index = tileY * this.mapWidth + tileX;
    return this.layers[layerIndex].data[index];
  }

  /**
   * Set tile at position
   */
  setTileAt(
    worldX: number,
    worldY: number,
    tileId: number,
    layerIndex: number = 0
  ): void {
    if (layerIndex >= this.layers.length) return;

    const tileX = Math.floor(worldX / this.tileWidth);
    const tileY = Math.floor(worldY / this.tileHeight);

    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
      return;
    }

    const index = tileY * this.mapWidth + tileX;
    this.layers[layerIndex].data[index] = tileId;
  }

  /**
   * Get tile dimensions
   */
  getTileSize(): { width: number; height: number } {
    return { width: this.tileWidth, height: this.tileHeight };
  }

  /**
   * Get map dimensions in tiles
   */
  getMapSize(): { width: number; height: number } {
    return { width: this.mapWidth, height: this.mapHeight };
  }

  /**
   * Get map dimensions in pixels
   */
  getMapPixelSize(): { width: number; height: number } {
    return {
      width: this.mapWidth * this.tileWidth,
      height: this.mapHeight * this.tileHeight,
    };
  }
}

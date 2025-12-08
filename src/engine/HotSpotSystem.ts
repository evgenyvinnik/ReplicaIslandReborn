/**
 * Hot Spot System - Handles special tile behaviors
 * Ported from: Original/src/com/replica/replicaisland/HotSpotSystem.java
 * 
 * Hot spots are tiles that provide hints to game objects about how to act
 * in particular areas. They're used to direct AI, define death zones,
 * trigger level endings, and more.
 */

import type { TiledWorldData } from '../levels/LevelParser';

/**
 * Hot spot type constants
 * These values correspond to tile values in the hot spot layer
 */
export const HotSpotType = {
  NONE: -1,
  
  // Basic movement directions (for AI)
  GO_RIGHT: 0,
  GO_LEFT: 1,
  GO_UP: 2,
  GO_DOWN: 3,
  
  // Wait behaviors
  WAIT_SHORT: 4,
  WAIT_MEDIUM: 5,
  WAIT_LONG: 6,
  
  // Actions
  ATTACK: 7,
  TALK: 8,
  DIE: 9,  // Instant death zone
  WALK_AND_TALK: 10,
  
  // Camera control
  TAKE_CAMERA_FOCUS: 11,
  RELEASE_CAMERA_FOCUS: 12,
  
  // Game events
  END_LEVEL: 13,
  GAME_EVENT: 14,
  NPC_RUN_QUEUED_COMMANDS: 15,
  
  // NPC movement directions
  NPC_GO_RIGHT: 16,
  NPC_GO_LEFT: 17,
  NPC_GO_UP: 18,
  NPC_GO_DOWN: 19,
  NPC_GO_UP_RIGHT: 20,
  NPC_GO_UP_LEFT: 21,
  NPC_GO_DOWN_LEFT: 22,
  NPC_GO_DOWN_RIGHT: 23,
  NPC_GO_TOWARDS_PLAYER: 24,
  NPC_GO_RANDOM: 25,
  NPC_GO_UP_FROM_GROUND: 26,
  NPC_GO_DOWN_FROM_CEILING: 27,
  NPC_STOP: 28,
  NPC_SLOW: 29,
  
  // Dialog triggers
  NPC_SELECT_DIALOG_1_1: 32,
  NPC_SELECT_DIALOG_1_2: 33,
  NPC_SELECT_DIALOG_1_3: 34,
  NPC_SELECT_DIALOG_1_4: 35,
  NPC_SELECT_DIALOG_1_5: 36,
  
  NPC_SELECT_DIALOG_2_1: 38,
  NPC_SELECT_DIALOG_2_2: 39,
  NPC_SELECT_DIALOG_2_3: 40,
  NPC_SELECT_DIALOG_2_4: 41,
  NPC_SELECT_DIALOG_2_5: 42,
} as const;

export type HotSpotTypeValue = typeof HotSpotType[keyof typeof HotSpotType];

/**
 * Hot Spot System
 * Tests positions against hot spots embedded in level tile map data
 */
export class HotSpotSystem {
  private world: TiledWorldData | null = null;
  private levelWidth: number = 0;
  private levelHeight: number = 0;

  /**
   * Reset the system
   */
  reset(): void {
    this.world = null;
    this.levelWidth = 0;
    this.levelHeight = 0;
  }

  /**
   * Set the hot spot world data
   */
  setWorld(world: TiledWorldData): void {
    this.world = world;
  }

  /**
   * Set level dimensions
   */
  setLevelDimensions(
    levelWidth: number,
    levelHeight: number,
    _tileWidth: number = 32,
    _tileHeight: number = 32
  ): void {
    this.levelWidth = levelWidth;
    this.levelHeight = levelHeight;
    console.warn(`[HotSpotSystem] setLevelDimensions: levelWidth=${levelWidth}, levelHeight=${levelHeight}, tileWidth=${_tileWidth}, tileHeight=${_tileHeight}`);
    if (this.world) {
      console.warn(`[HotSpotSystem] world: width=${this.world.width}, height=${this.world.height}`);
    }
  }

  /**
   * Get hot spot at world position
   */
  getHotSpot(worldX: number, worldY: number): number {
    if (!this.world || this.levelWidth === 0) {
      return HotSpotType.NONE;
    }

    const tileX = this.getHitTileX(worldX);
    const tileY = this.getHitTileY(worldY);

    return this.getHotSpotByTile(tileX, tileY);
  }

  /**
   * Get hot spot by tile coordinates
   * tiles[x][y] - column-major order
   */
  getHotSpotByTile(tileX: number, tileY: number): number {
    if (!this.world) {
      return HotSpotType.NONE;
    }

    if (tileX < 0 || tileX >= this.world.width || tileY < 0 || tileY >= this.world.height) {
      return HotSpotType.NONE;
    }

    // Column-major: tiles[x][y]
    return this.world.tiles[tileX][tileY];
  }


  /**
   * Convert world X to tile X
   */
  getHitTileX(worldX: number): number {
    if (!this.world || this.levelWidth === 0) {
      return 0;
    }
    return Math.floor((worldX / this.levelWidth) * this.world.width);
  }

  /**
   * Convert world Y to tile Y
   */
  getHitTileY(worldY: number): number {
    if (!this.world || this.levelHeight === 0) {
      return 0;
    }
    return Math.floor((worldY / this.levelHeight) * this.world.height);
  }

  /**
   * Get the center world X position of a tile
   */
  getTileCenterWorldPositionX(tileX: number): number {
    if (!this.world || this.levelWidth === 0) {
      return 0;
    }
    const tileWidthWorld = this.levelWidth / this.world.width;
    return tileX * tileWidthWorld + tileWidthWorld / 2;
  }

  /**
   * Get the center world Y position of a tile
   */
  getTileCenterWorldPositionY(tileY: number): number {
    if (!this.world || this.levelHeight === 0) {
      return 0;
    }
    const tileHeightWorld = this.levelHeight / this.world.height;
    return tileY * tileHeightWorld + tileHeightWorld / 2;
  }

  /**
   * Check if a hot spot indicates the player should die
   */
  isDeathZone(hotSpot: number): boolean {
    return hotSpot === HotSpotType.DIE;
  }

  /**
   * Check if a hot spot is a level end trigger
   */
  isLevelEnd(hotSpot: number): boolean {
    return hotSpot === HotSpotType.END_LEVEL;
  }

  /**
   * Check if a hot spot is a dialog trigger
   */
  isDialogTrigger(hotSpot: number): boolean {
    return (
      (hotSpot >= HotSpotType.NPC_SELECT_DIALOG_1_1 && hotSpot <= HotSpotType.NPC_SELECT_DIALOG_1_5) ||
      (hotSpot >= HotSpotType.NPC_SELECT_DIALOG_2_1 && hotSpot <= HotSpotType.NPC_SELECT_DIALOG_2_5)
    );
  }

  /**
   * Check if a hot spot is a movement direction hint
   */
  isMovementHint(hotSpot: number): boolean {
    return hotSpot >= HotSpotType.GO_RIGHT && hotSpot <= HotSpotType.GO_DOWN;
  }

  /**
   * Check if a hot spot is an NPC movement command
   */
  isNPCMovementCommand(hotSpot: number): boolean {
    return hotSpot >= HotSpotType.NPC_GO_RIGHT && hotSpot <= HotSpotType.NPC_SLOW;
  }

  /**
   * Check if a hot spot is a wait command
   */
  isWaitCommand(hotSpot: number): boolean {
    return hotSpot >= HotSpotType.WAIT_SHORT && hotSpot <= HotSpotType.WAIT_LONG;
  }

  /**
   * Get wait duration for a wait hot spot (in seconds)
   */
  getWaitDuration(hotSpot: number): number {
    switch (hotSpot) {
      case HotSpotType.WAIT_SHORT:
        return 1.0;
      case HotSpotType.WAIT_MEDIUM:
        return 2.0;
      case HotSpotType.WAIT_LONG:
        return 4.0;
      default:
        return 0;
    }
  }

  /**
   * Get movement direction from a hot spot
   * Returns { x, y } normalized direction vector
   */
  getMovementDirection(hotSpot: number): { x: number; y: number } {
    switch (hotSpot) {
      case HotSpotType.GO_RIGHT:
      case HotSpotType.NPC_GO_RIGHT:
        return { x: 1, y: 0 };
      case HotSpotType.GO_LEFT:
      case HotSpotType.NPC_GO_LEFT:
        return { x: -1, y: 0 };
      case HotSpotType.GO_UP:
      case HotSpotType.NPC_GO_UP:
        return { x: 0, y: 1 };
      case HotSpotType.GO_DOWN:
      case HotSpotType.NPC_GO_DOWN:
        return { x: 0, y: -1 };
      case HotSpotType.NPC_GO_UP_RIGHT:
        return { x: 0.707, y: 0.707 };
      case HotSpotType.NPC_GO_UP_LEFT:
        return { x: -0.707, y: 0.707 };
      case HotSpotType.NPC_GO_DOWN_RIGHT:
        return { x: 0.707, y: -0.707 };
      case HotSpotType.NPC_GO_DOWN_LEFT:
        return { x: -0.707, y: -0.707 };
      case HotSpotType.NPC_STOP:
        return { x: 0, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  }

  /**
   * Get the world data
   */
  getWorld(): TiledWorldData | null {
    return this.world;
  }

  /**
   * Check if the system has been initialized with world data
   */
  hasWorld(): boolean {
    return this.world !== null;
  }
}

// Export singleton instance
export const hotSpotSystem = new HotSpotSystem();

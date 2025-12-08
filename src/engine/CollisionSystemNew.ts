/**
 * Collision System - Handles collision detection using line segments
 * Ported from: Original/src/com/replica/replicaisland/CollisionSystem.java
 * 
 * This implementation uses line segment-based collision like the original game,
 * rather than simple tile-based collision. Each collision tile type has a set
 * of line segments defining its shape (for slopes, corners, etc.)
 */

import { Vector2 } from '../utils/Vector2';
import type { Rect } from '../types';
import type { GameObject } from '../entities/GameObject';
import { FixedSizeArray } from '../utils/ObjectPool';

// ============================================================================
// Interfaces
// ============================================================================

export interface CollisionResult {
  hit: boolean;
  normal: Vector2;
  penetration: number;
  point: Vector2;
}

export interface TileCollisionResult {
  grounded: boolean;
  ceiling: boolean;
  leftWall: boolean;
  rightWall: boolean;
  normal: Vector2;
}

export interface SlopeCheckResult {
  canClimb: boolean;
  newY: number;
}

/** Line segment with start, end points and a normal vector */
export interface LineSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  normalX: number;
  normalY: number;
  owner?: GameObject | null;
}

/** A collision tile containing line segments */
export interface CollisionTile {
  index: number;
  segments: LineSegment[];
}

/** Loaded collision data format */
export interface CollisionData {
  version: number;
  tileCount: number;
  tiles: { [key: number]: CollisionTile };
}

/** Temporary collision surface for moving platforms */
export interface TemporarySurface extends LineSegment {
  owner: GameObject | null;
}

// ============================================================================
// CollisionSystem Class
// ============================================================================

export class CollisionSystem {
  // Collision tile definitions (loaded from collision.json)
  private collisionTileDefinitions: Map<number, CollisionTile> = new Map();
  
  // World tile map (tile index per position)
  private worldTiles: number[] = [];
  private worldWidth: number = 0;
  private worldHeight: number = 0;
  private tileWidth: number = 32;
  private tileHeight: number = 32;
  
  // Flag to track if collision data is loaded
  private collisionDataLoaded: boolean = false;

  // Object collision pools
  private maxColliders: number = 256;
  private colliders: FixedSizeArray<GameObject>;

  // Temporary surfaces for moving platforms
  private temporarySurfaces: TemporarySurface[] = [];
  private pendingTemporarySurfaces: TemporarySurface[] = [];

  // Workspace vectors (pre-allocated for performance)
  private tileSpaceStart: Vector2 = new Vector2();
  private tileSpaceEnd: Vector2 = new Vector2();
  private tileSpaceOffset: Vector2 = new Vector2();
  private movementDirection: Vector2 = new Vector2();
  private tempHitPoint: Vector2 = new Vector2();

  constructor() {
    this.colliders = new FixedSizeArray<GameObject>(this.maxColliders);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Load collision tile definitions from collision.json
   */
  async loadCollisionData(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to load collision data: ${response.statusText}`);
        return false;
      }
      
      const data: CollisionData = await response.json();
      
      // Store collision tile definitions
      this.collisionTileDefinitions.clear();
      for (const key in data.tiles) {
        const tile = data.tiles[key];
        this.collisionTileDefinitions.set(tile.index, tile);
      }
      
      this.collisionDataLoaded = true;
      console.warn(`Loaded ${this.collisionTileDefinitions.size} collision tile definitions`);
      return true;
    } catch (error) {
      console.error('Error loading collision data:', error);
      return false;
    }
  }

  /**
   * Check if collision data is loaded
   */
  isCollisionDataLoaded(): boolean {
    return this.collisionDataLoaded;
  }

  /**
   * Reset the collision system
   */
  reset(): void {
    this.worldTiles = [];
    this.colliders.clear();
    this.worldWidth = 0;
    this.worldHeight = 0;
    this.temporarySurfaces = [];
    this.pendingTemporarySurfaces = [];
  }

  /**
   * Set tile collision map (the world grid)
   */
  setTileCollision(
    tiles: number[],
    width: number,
    height: number,
    tileWidth: number,
    tileHeight: number
  ): void {
    this.worldTiles = tiles;
    this.worldWidth = width;
    this.worldHeight = height;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
  }

  /**
   * Set world collision segments (for backward compatibility)
   * Note: The new system uses tile-based collision segments loaded from collision.json
   * This method is kept for compatibility with legacy level formats.
   */
  setWorldCollision(_segments: { startX: number; startY: number; endX: number; endY: number; normalX: number; normalY: number }[]): void {
    // Legacy method - in the new system, collision segments are loaded per-tile from collision.json
    // We could add support for world-level segments here if needed
    console.warn('[CollisionSystem] setWorldCollision called - using tile-based collision instead');
  }

  // ==========================================================================
  // Object Registration
  // ==========================================================================

  registerCollider(object: GameObject): void {
    this.colliders.add(object);
  }

  unregisterCollider(object: GameObject): void {
    this.colliders.remove(object);
  }

  clearColliders(): void {
    this.colliders.clear();
  }

  // ==========================================================================
  // Line-Line Intersection (from original game)
  // ==========================================================================

  /**
   * Calculate intersection between two line segments.
   * Reference: http://local.wasp.uwa.edu.au/~pbourke/geometry/lineline2d/
   * 
   * @returns true if segments intersect, with hitPoint set to intersection point
   */
  private calculateSegmentIntersection(
    seg1StartX: number, seg1StartY: number, seg1EndX: number, seg1EndY: number,
    seg2StartX: number, seg2StartY: number, seg2EndX: number, seg2EndY: number,
    hitPoint: Vector2
  ): boolean {
    const x1 = seg1StartX;
    const x2 = seg1EndX;
    const x3 = seg2StartX;
    const x4 = seg2EndX;
    const y1 = seg1StartY;
    const y2 = seg1EndY;
    const y3 = seg2StartY;
    const y4 = seg2EndY;
    
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 0.0001) {
      return false; // Lines are parallel
    }
    
    const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    
    // Check if intersection is within both segments
    if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
      hitPoint.x = x1 + uA * (x2 - x1);
      hitPoint.y = y1 + uA * (y2 - y1);
      return true;
    }
    
    return false;
  }

  // ==========================================================================
  // Ray Casting (from original game)
  // ==========================================================================

  /**
   * Test a ray against a list of segments, finding the closest intersection.
   * Only considers segments whose normal opposes the movement direction.
   */
  private testSegmentAgainstList(
    segments: LineSegment[],
    startPoint: Vector2,
    endPoint: Vector2,
    hitPoint: Vector2,
    hitNormal: Vector2,
    movementDir: Vector2,
    excludeObject: GameObject | null
  ): boolean {
    let foundHit = false;
    let closestDistanceSq = -1;
    let hitX = 0;
    let hitY = 0;
    let normalX = 0;
    let normalY = 0;
    
    for (const segment of segments) {
      // Filter: only consider surfaces that oppose movement direction
      // If no movement direction given, consider all surfaces
      const dot = (movementDir.x !== 0 || movementDir.y !== 0)
        ? movementDir.x * segment.normalX + movementDir.y * segment.normalY
        : -1;
      
      if (dot < 0 && 
          (excludeObject === null || segment.owner !== excludeObject)) {
        
        if (this.calculateSegmentIntersection(
          segment.startX, segment.startY, segment.endX, segment.endY,
          startPoint.x, startPoint.y, endPoint.x, endPoint.y,
          this.tempHitPoint
        )) {
          const dx = this.tempHitPoint.x - startPoint.x;
          const dy = this.tempHitPoint.y - startPoint.y;
          const distanceSq = dx * dx + dy * dy;
          
          if (!foundHit || closestDistanceSq > distanceSq) {
            closestDistanceSq = distanceSq;
            foundHit = true;
            normalX = segment.normalX;
            normalY = segment.normalY;
            hitX = this.tempHitPoint.x;
            hitY = this.tempHitPoint.y;
          }
        }
      }
    }
    
    if (foundHit) {
      hitPoint.set(hitX, hitY);
      hitNormal.set(normalX, normalY);
    }
    
    return foundHit;
  }

  /**
   * Execute a ray through the tile world, testing against collision segments.
   * Uses Bresenham-style line algorithm to traverse tiles.
   */
  private executeRay(
    startPoint: Vector2,
    endPoint: Vector2,
    hitPoint: Vector2,
    hitNormal: Vector2,
    movementDir: Vector2,
    excludeObject: GameObject | null
  ): boolean {
    if (!this.collisionDataLoaded || this.worldTiles.length === 0) {
      return false;
    }
    
    const startTileX = this.worldToTileColumn(startPoint.x);
    const startTileY = this.worldToTileRow(startPoint.y);
    const endTileX = this.worldToTileColumn(endPoint.x);
    const endTileY = this.worldToTileRow(endPoint.y);
    
    let currentX = startTileX;
    let currentY = startTileY;
    
    const deltaX = endTileX - startTileX;
    const deltaY = endTileY - startTileY;
    
    // Handle straight lines (horizontal or vertical)
    if (deltaX === 0 || deltaY === 0) {
      return this.executeStraightRay(
        startPoint, endPoint, startTileX, startTileY, endTileX, endTileY,
        deltaX, deltaY, hitPoint, hitNormal, movementDir, excludeObject
      );
    }
    
    const xIncrement = deltaX !== 0 ? Math.sign(deltaX) : 0;
    const yIncrement = deltaY !== 0 ? Math.sign(deltaY) : 0;
    
    const lateralDelta = Math.abs(deltaX) + 1;
    const verticalDelta = Math.abs(deltaY) + 1;
    
    const deltaX2 = lateralDelta * 2;
    const deltaY2 = verticalDelta * 2;
    
    // Bresenham line algorithm in tile space
    if (lateralDelta >= verticalDelta) {
      let error = deltaY2 - lateralDelta;
      for (let i = 0; i < lateralDelta; i++) {
        if (this.visitTile(currentX, currentY, startPoint, endPoint, hitPoint, hitNormal, movementDir, excludeObject)) {
          return true;
        }
        
        if (error > 0) {
          currentY += yIncrement;
          error -= deltaX2;
        }
        
        error += deltaY2;
        currentX += xIncrement;
      }
    } else {
      let error = deltaX2 - verticalDelta;
      for (let i = 0; i < verticalDelta; i++) {
        if (this.visitTile(currentX, currentY, startPoint, endPoint, hitPoint, hitNormal, movementDir, excludeObject)) {
          return true;
        }
        
        if (error > 0) {
          currentX += xIncrement;
          error -= deltaY2;
        }
        
        error += deltaX2;
        currentY += yIncrement;
      }
    }
    
    return false;
  }

  /**
   * Execute a straight ray (horizontal or vertical)
   */
  private executeStraightRay(
    startPoint: Vector2,
    endPoint: Vector2,
    startTileX: number,
    startTileY: number,
    _endTileX: number,
    _endTileY: number,
    deltaX: number,
    deltaY: number,
    hitPoint: Vector2,
    hitNormal: Vector2,
    movementDir: Vector2,
    excludeObject: GameObject | null
  ): boolean {
    let currentX = startTileX;
    let currentY = startTileY;
    
    let xIncrement = 0;
    let yIncrement = 0;
    let distance = 0;
    
    if (deltaX !== 0) {
      distance = Math.abs(deltaX) + 1;
      xIncrement = Math.sign(deltaX);
    } else if (deltaY !== 0) {
      distance = Math.abs(deltaY) + 1;
      yIncrement = Math.sign(deltaY);
    }
    
    for (let i = 0; i < distance; i++) {
      if (this.visitTile(currentX, currentY, startPoint, endPoint, hitPoint, hitNormal, movementDir, excludeObject)) {
        return true;
      }
      currentX += xIncrement;
      currentY += yIncrement;
    }
    
    return false;
  }

  /**
   * Visit a tile during ray traversal, testing against its segments
   */
  private visitTile(
    tileX: number,
    tileY: number,
    startPoint: Vector2,
    endPoint: Vector2,
    hitPoint: Vector2,
    hitNormal: Vector2,
    movementDir: Vector2,
    excludeObject: GameObject | null
  ): boolean {
    const tileIndex = this.getTileAt(tileX, tileY);
    if (tileIndex < 0) {
      return false;
    }
    
    const collisionTile = this.collisionTileDefinitions.get(tileIndex);
    if (!collisionTile || collisionTile.segments.length === 0) {
      return false;
    }
    
    // Convert ray to tile-local space
    this.tileSpaceOffset.set(tileX * this.tileWidth, tileY * this.tileHeight);
    this.tileSpaceStart.set(startPoint.x - this.tileSpaceOffset.x, startPoint.y - this.tileSpaceOffset.y);
    this.tileSpaceEnd.set(endPoint.x - this.tileSpaceOffset.x, endPoint.y - this.tileSpaceOffset.y);
    
    const foundHit = this.testSegmentAgainstList(
      collisionTile.segments,
      this.tileSpaceStart,
      this.tileSpaceEnd,
      hitPoint,
      hitNormal,
      movementDir,
      excludeObject
    );
    
    if (foundHit) {
      // Convert hit point back to world space
      hitPoint.x += this.tileSpaceOffset.x;
      hitPoint.y += this.tileSpaceOffset.y;
    }
    
    return foundHit;
  }

  /**
   * Convert world X coordinate to tile column
   */
  private worldToTileColumn(x: number): number {
    return Math.max(0, Math.min(Math.floor(x / this.tileWidth), this.worldWidth - 1));
  }

  /**
   * Convert world Y coordinate to tile row
   */
  private worldToTileRow(y: number): number {
    return Math.max(0, Math.min(Math.floor(y / this.tileHeight), this.worldHeight - 1));
  }

  /**
   * Get the tile index at a tile coordinate
   */
  private getTileAt(tileX: number, tileY: number): number {
    if (tileX < 0 || tileX >= this.worldWidth || tileY < 0 || tileY >= this.worldHeight) {
      return -1;
    }
    return this.worldTiles[tileY * this.worldWidth + tileX];
  }

  // ==========================================================================
  // Public Collision API
  // ==========================================================================

  /**
   * Cast a ray into the collision world.
   * This is the main method for line segment collision detection.
   * 
   * @param startPoint Starting point of the ray
   * @param endPoint Ending point of the ray
   * @param movementDirection If set, only segments with normals opposing this direction are considered
   * @param hitPoint Output: point of intersection
   * @param hitNormal Output: normal of the intersecting surface
   * @param excludeObject If set, dynamic surfaces from this object will be ignored
   * @returns true if a valid intersection was found
   */
  castRay(
    startPoint: Vector2,
    endPoint: Vector2,
    movementDirection: Vector2 | null,
    hitPoint: Vector2,
    hitNormal: Vector2,
    excludeObject: GameObject | null = null
  ): boolean {
    let hit = false;
    
    // Set up movement direction
    if (movementDirection) {
      this.movementDirection.set(movementDirection);
      this.movementDirection.normalize();
    } else {
      this.movementDirection.zero();
    }
    
    // Test against tile-based collision
    if (this.collisionDataLoaded) {
      hit = this.executeRay(
        startPoint, endPoint, hitPoint, hitNormal,
        this.movementDirection, excludeObject
      );
    }
    
    // Test against temporary surfaces (moving platforms)
    if (this.temporarySurfaces.length > 0) {
      const tempHit = new Vector2();
      const tempNormal = new Vector2();
      
      if (this.testSegmentAgainstList(
        this.temporarySurfaces, startPoint, endPoint,
        tempHit, tempNormal, this.movementDirection, excludeObject
      )) {
        if (hit) {
          // Compare distances, use closer hit
          const existingDist = startPoint.distanceSquared(hitPoint);
          const newDist = startPoint.distanceSquared(tempHit);
          if (newDist < existingDist) {
            hitPoint.set(tempHit);
            hitNormal.set(tempNormal);
          }
        } else {
          hit = true;
          hitPoint.set(tempHit);
          hitNormal.set(tempNormal);
        }
      }
    }
    
    return hit;
  }

  /**
   * Check if a tile has collision data (for backward compatibility)
   */
  isTileSolid(tileX: number, tileY: number): boolean {
    const tileIndex = this.getTileAt(tileX, tileY);
    if (tileIndex < 0) {
      return tileX < 0 || tileX >= this.worldWidth || tileY < 0 || tileY >= this.worldHeight;
    }
    return this.collisionTileDefinitions.has(tileIndex);
  }

  /**
   * Line segment-based collision check using raycasting.
   * This properly handles slopes by casting rays and checking against line segments.
   */
  checkTileCollision(
    x: number,
    y: number,
    width: number,
    height: number,
    velocityX: number,
    velocityY: number
  ): TileCollisionResult {
    const result: TileCollisionResult = {
      grounded: false,
      ceiling: false,
      leftWall: false,
      rightWall: false,
      normal: new Vector2(),
    };

    if (this.worldTiles.length === 0) {
      return result;
    }

    // If collision data is loaded, use line segment collision
    if (this.collisionDataLoaded) {
      return this.checkTileCollisionWithSegments(x, y, width, height, velocityX, velocityY);
    }

    // Fallback to simple tile-based collision if no segment data
    return this.checkTileCollisionSimple(x, y, width, height, velocityX, velocityY);
  }

  /**
   * Line segment-based collision detection.
   * Casts rays from multiple points on the collision box to detect surfaces.
   */
  private checkTileCollisionWithSegments(
    x: number,
    y: number,
    width: number,
    height: number,
    velocityX: number,
    velocityY: number
  ): TileCollisionResult {
    const result: TileCollisionResult = {
      grounded: false,
      ceiling: false,
      leftWall: false,
      rightWall: false,
      normal: new Vector2(),
    };

    const hitPoint = new Vector2();
    const hitNormal = new Vector2();
    const movementDir = new Vector2();
    
    // Center of the object
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    // Small penetration test distance
    const testDistance = 2;

    // ========================================================================
    // Ground check - cast ray from center-bottom downward
    // ========================================================================
    if (velocityY >= 0) {
      const groundStart = new Vector2(centerX, y + height - testDistance);
      const groundEnd = new Vector2(centerX, y + height + testDistance);
      movementDir.set(0, 1); // Moving downward
      
      if (this.castRay(groundStart, groundEnd, movementDir, hitPoint, hitNormal, null)) {
        // Check if the normal points upward (floor surface)
        if (hitNormal.y < -0.3) { // Allow some angle for slopes
          result.grounded = true;
          result.normal.set(hitNormal);
        }
      }
      
      // Additional ground checks at left and right edges for wide objects
      if (!result.grounded) {
        // Left foot
        groundStart.set(x + 4, y + height - testDistance);
        groundEnd.set(x + 4, y + height + testDistance);
        if (this.castRay(groundStart, groundEnd, movementDir, hitPoint, hitNormal, null)) {
          if (hitNormal.y < -0.3) {
            result.grounded = true;
            result.normal.set(hitNormal);
          }
        }
      }
      
      if (!result.grounded) {
        // Right foot
        groundStart.set(x + width - 4, y + height - testDistance);
        groundEnd.set(x + width - 4, y + height + testDistance);
        if (this.castRay(groundStart, groundEnd, movementDir, hitPoint, hitNormal, null)) {
          if (hitNormal.y < -0.3) {
            result.grounded = true;
            result.normal.set(hitNormal);
          }
        }
      }
    }

    // ========================================================================
    // Ceiling check - cast ray from center-top upward
    // ========================================================================
    if (velocityY <= 0) {
      const ceilingStart = new Vector2(centerX, y + testDistance);
      const ceilingEnd = new Vector2(centerX, y - testDistance);
      movementDir.set(0, -1); // Moving upward
      
      if (this.castRay(ceilingStart, ceilingEnd, movementDir, hitPoint, hitNormal, null)) {
        // Check if the normal points downward (ceiling surface)
        if (hitNormal.y > 0.3) {
          result.ceiling = true;
          if (result.normal.lengthSquared() === 0) {
            result.normal.set(hitNormal);
          }
        }
      }
    }

    // ========================================================================
    // Left wall check - cast ray from left edge leftward
    // ========================================================================
    if (velocityX <= 0) {
      const leftStart = new Vector2(x + testDistance, centerY);
      const leftEnd = new Vector2(x - testDistance, centerY);
      movementDir.set(-1, 0); // Moving left
      
      if (this.castRay(leftStart, leftEnd, movementDir, hitPoint, hitNormal, null)) {
        // Check if the normal points right (left wall surface)
        if (hitNormal.x > 0.7) { // Steeper threshold for walls
          result.leftWall = true;
          if (result.normal.lengthSquared() === 0) {
            result.normal.set(hitNormal);
          }
        }
      }
      
      // Additional check at bottom-left (common case for slopes)
      if (!result.leftWall) {
        leftStart.set(x + testDistance, y + height - 8);
        leftEnd.set(x - testDistance, y + height - 8);
        if (this.castRay(leftStart, leftEnd, movementDir, hitPoint, hitNormal, null)) {
          if (hitNormal.x > 0.7) {
            result.leftWall = true;
            if (result.normal.lengthSquared() === 0) {
              result.normal.set(hitNormal);
            }
          }
        }
      }
    }

    // ========================================================================
    // Right wall check - cast ray from right edge rightward
    // ========================================================================
    if (velocityX >= 0) {
      const rightStart = new Vector2(x + width - testDistance, centerY);
      const rightEnd = new Vector2(x + width + testDistance, centerY);
      movementDir.set(1, 0); // Moving right
      
      if (this.castRay(rightStart, rightEnd, movementDir, hitPoint, hitNormal, null)) {
        // Check if the normal points left (right wall surface)
        if (hitNormal.x < -0.7) { // Steeper threshold for walls
          result.rightWall = true;
          if (result.normal.lengthSquared() === 0) {
            result.normal.set(hitNormal);
          }
        }
      }
      
      // Additional check at bottom-right (common case for slopes)
      if (!result.rightWall) {
        rightStart.set(x + width - testDistance, y + height - 8);
        rightEnd.set(x + width + testDistance, y + height - 8);
        if (this.castRay(rightStart, rightEnd, movementDir, hitPoint, hitNormal, null)) {
          if (hitNormal.x < -0.7) {
            result.rightWall = true;
            if (result.normal.lengthSquared() === 0) {
              result.normal.set(hitNormal);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Simple tile-based collision check (fallback when no segment data).
   */
  private checkTileCollisionSimple(
    x: number,
    y: number,
    width: number,
    height: number,
    velocityX: number,
    velocityY: number
  ): TileCollisionResult {
    const result: TileCollisionResult = {
      grounded: false,
      ceiling: false,
      leftWall: false,
      rightWall: false,
      normal: new Vector2(),
    };

    // Use a small margin to prevent edge-case clipping
    const margin = 0.5;

    // Calculate tile ranges to check
    const left = Math.floor((x + margin) / this.tileWidth);
    const right = Math.floor((x + width - margin) / this.tileWidth);
    const top = Math.floor((y + margin) / this.tileHeight);
    const bottom = Math.floor((y + height - margin) / this.tileHeight);

    // Check each tile in range
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (this.isTileSolid(tx, ty)) {
          const tileLeft = tx * this.tileWidth;
          const tileRight = tileLeft + this.tileWidth;
          const tileTop = ty * this.tileHeight;
          const tileBottom = tileTop + this.tileHeight;

          const objectRight = x + width;
          const objectBottom = y + height;

          // Calculate overlap on each side
          const overlapLeft = objectRight - tileLeft;
          const overlapRight = tileRight - x;
          const overlapTop = objectBottom - tileTop;
          const overlapBottom = tileBottom - y;

          // Only process if there's actual overlap
          if (overlapLeft > 0 && overlapRight > 0 && overlapTop > 0 && overlapBottom > 0) {
            const minOverlapX = Math.min(overlapLeft, overlapRight);
            const minOverlapY = Math.min(overlapTop, overlapBottom);

            const absVelX = Math.abs(velocityX);
            const absVelY = Math.abs(velocityY);
            
            let resolveHorizontal: boolean;
            
            if (Math.abs(minOverlapX - minOverlapY) < 2) {
              resolveHorizontal = absVelX > absVelY;
            } else {
              resolveHorizontal = minOverlapX < minOverlapY;
            }
            
            if (resolveHorizontal) {
              if (overlapLeft <= overlapRight) {
                if (velocityX >= 0) {
                  result.rightWall = true;
                  result.normal.x = -1;
                }
              } else {
                if (velocityX <= 0) {
                  result.leftWall = true;
                  result.normal.x = 1;
                }
              }
            } else {
              if (overlapTop <= overlapBottom) {
                if (velocityY >= 0) {
                  result.grounded = true;
                  result.normal.y = -1;
                }
              } else {
                if (velocityY <= 0) {
                  result.ceiling = true;
                  result.normal.y = 1;
                }
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if the player can climb a slope using raycasting.
   * This properly detects slope surfaces and finds the correct Y position.
   */
  checkSlopeClimb(
    x: number,
    y: number,
    width: number,
    height: number,
    velocityX: number,
    maxStepHeight: number = this.tileHeight * 0.7
  ): SlopeCheckResult {
    const result: SlopeCheckResult = {
      canClimb: false,
      newY: y,
    };

    // If we have collision segment data, use raycast-based slope detection
    if (this.collisionDataLoaded) {
      return this.checkSlopeClimbWithRaycast(x, y, width, height, velocityX, maxStepHeight);
    }

    // Fallback to step-up based approach
    const stepIncrement = 2;
    
    for (let stepY = stepIncrement; stepY <= maxStepHeight; stepY += stepIncrement) {
      const testY = y - stepY;
      const collision = this.checkTileCollision(x, testY, width, height, velocityX, 0);

      if (!collision.leftWall && !collision.rightWall) {
        for (let groundY = testY; groundY <= y + stepIncrement; groundY += stepIncrement) {
          const groundCheck = this.checkTileCollision(x, groundY, width, height, 0, 1);
          
          if (groundCheck.grounded) {
            result.canClimb = true;
            const bottomTileY = Math.floor((groundY + height) / this.tileHeight);
            result.newY = bottomTileY * this.tileHeight - height;
            return result;
          }
        }
        
        result.canClimb = true;
        result.newY = testY;
        return result;
      }
    }

    return result;
  }

  /**
   * Raycast-based slope climbing check.
   * Casts a diagonal ray from the player's feet in the direction of movement
   * to find the slope surface and calculate the correct Y position.
   */
  private checkSlopeClimbWithRaycast(
    x: number,
    y: number,
    width: number,
    height: number,
    velocityX: number,
    maxStepHeight: number
  ): SlopeCheckResult {
    const result: SlopeCheckResult = {
      canClimb: false,
      newY: y,
    };

    // Determine the leading edge based on movement direction
    const leadingEdgeX = velocityX > 0 ? x + width : x;
    const footY = y + height;
    
    // Movement direction for filtering
    const movementDir = new Vector2(Math.sign(velocityX), 0);
    const hitPoint = new Vector2();
    const hitNormal = new Vector2();

    // Cast a vertical ray from above the maximum step height to the foot level
    // This finds the ground surface at the new X position
    const rayStartX = leadingEdgeX;
    const rayStartY = footY - maxStepHeight;
    const rayEndX = leadingEdgeX;
    const rayEndY = footY + 4; // Slightly below feet
    
    const rayStart = new Vector2(rayStartX, rayStartY);
    const rayEnd = new Vector2(rayEndX, rayEndY);
    const downDir = new Vector2(0, 1); // Looking for floor surfaces
    
    if (this.castRay(rayStart, rayEnd, downDir, hitPoint, hitNormal, null)) {
      // Check if this is a floor-like surface (normal points upward)
      if (hitNormal.y < -0.3) {
        // Calculate the new Y position (snap player's bottom to the surface)
        const newY = hitPoint.y - height;
        
        // Only climb if the step height is within limits
        const stepHeight = y - newY;
        if (stepHeight > 0 && stepHeight <= maxStepHeight) {
          // Verify there's no horizontal collision at the new position
          const testCollision = this.checkTileCollision(x, newY, width, height, velocityX, 0);
          
          if (!testCollision.leftWall && !testCollision.rightWall) {
            result.canClimb = true;
            result.newY = newY;
            return result;
          }
        }
      }
    }

    // Second approach: cast a diagonal ray from current feet position
    // in the direction of movement + downward
    const diagonalEndX = velocityX > 0 ? x + width + 16 : x - 16;
    const diagonalEndY = footY + 8;
    
    rayStart.set(x + width / 2, footY - 4);
    rayEnd.set(diagonalEndX, diagonalEndY);
    
    if (this.castRay(rayStart, rayEnd, movementDir, hitPoint, hitNormal, null)) {
      // Check if this is a slope surface (normal has both vertical and horizontal components)
      const isSlope = Math.abs(hitNormal.x) > 0.1 && Math.abs(hitNormal.y) > 0.3;
      
      if (isSlope || hitNormal.y < -0.5) {
        // This is a slope or floor we can walk on
        const newY = hitPoint.y - height;
        const stepHeight = y - newY;
        
        if (stepHeight > 0 && stepHeight <= maxStepHeight) {
          result.canClimb = true;
          result.newY = newY;
          return result;
        }
      }
    }

    return result;
  }

  // ==========================================================================
  // Object Collision
  // ==========================================================================

  rectIntersects(a: Rect, b: Rect): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  checkObjectCollision(object: GameObject): GameObject[] {
    const collisions: GameObject[] = [];
    const objectRect = object.getCollisionRect();

    this.colliders.forEach((other) => {
      if (other !== object && other.isActive()) {
        const otherRect = other.getCollisionRect();
        if (this.rectIntersects(objectRect, otherRect)) {
          collisions.push(other);
        }
      }
    });

    return collisions;
  }

  // ==========================================================================
  // Legacy API (for backward compatibility)
  // ==========================================================================

  raycast(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number
  ): CollisionResult {
    const startPoint = new Vector2(startX, startY);
    const endPoint = new Vector2(startX + dirX * maxDistance, startY + dirY * maxDistance);
    const movementDir = new Vector2(dirX, dirY);
    const hitPoint = new Vector2();
    const hitNormal = new Vector2();
    
    const hit = this.castRay(startPoint, endPoint, movementDir, hitPoint, hitNormal, null);
    
    return {
      hit,
      normal: hitNormal,
      penetration: hit ? maxDistance - startPoint.distance(hitPoint) : 0,
      point: hit ? hitPoint : endPoint,
    };
  }

  resolveCollision(
    x: number,
    y: number,
    width: number,
    height: number,
    velocityX: number,
    velocityY: number
  ): { x: number; y: number; velocityX: number; velocityY: number } {
    const result = { x, y, velocityX, velocityY };
    const collision = this.checkTileCollision(x, y, width, height, velocityX, velocityY);

    if (collision.grounded) {
      const tileY = Math.floor((y + height) / this.tileHeight);
      result.y = tileY * this.tileHeight - height;
      result.velocityY = 0;
    }

    if (collision.ceiling) {
      const tileY = Math.floor(y / this.tileHeight);
      result.y = (tileY + 1) * this.tileHeight;
      result.velocityY = 0;
    }

    if (collision.leftWall) {
      const tileX = Math.floor(x / this.tileWidth);
      result.x = (tileX + 1) * this.tileWidth;
      result.velocityX = 0;
    }

    if (collision.rightWall) {
      const tileX = Math.floor((x + width) / this.tileWidth);
      result.x = tileX * this.tileWidth - width;
      result.velocityX = 0;
    }

    return result;
  }

  // ==========================================================================
  // Temporary Surfaces (Moving Platforms)
  // ==========================================================================

  addTemporarySurface(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    normalX: number,
    normalY: number,
    owner: GameObject | null = null
  ): void {
    this.pendingTemporarySurfaces.push({
      startX,
      startY,
      endX,
      endY,
      normalX,
      normalY,
      owner,
    });
  }

  updateTemporarySurfaces(): void {
    this.temporarySurfaces = [];
    const swap = this.temporarySurfaces;
    this.temporarySurfaces = this.pendingTemporarySurfaces;
    this.pendingTemporarySurfaces = swap;
  }

  getTemporarySurfaces(): TemporarySurface[] {
    return this.temporarySurfaces;
  }
}

/**
 * Collision System - Handles collision detection
 * Ported from: Original/src/com/replica/replicaisland/CollisionSystem.java
 */

import { Vector2 } from '../utils/Vector2';
import type { Rect, CollisionSegment } from '../types';
import type { GameObject } from '../entities/GameObject';
import { FixedSizeArray } from '../utils/ObjectPool';

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

/** Temporary collision surface for moving platforms */
export interface TemporarySurface {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  normalX: number;
  normalY: number;
  owner: GameObject | null;
}

export class CollisionSystem {
  private worldCollision: CollisionSegment[] = [];
  private tileWidth: number = 32;
  private tileHeight: number = 32;
  private collisionTiles: number[] = [];
  private worldWidth: number = 0;
  private worldHeight: number = 0;

  // Object collision pools
  private maxColliders: number = 256;
  private colliders: FixedSizeArray<GameObject>;

  // Temporary surfaces for moving platforms
  private temporarySurfaces: TemporarySurface[] = [];
  private pendingTemporarySurfaces: TemporarySurface[] = [];

  // Reusable vectors for calculations (prefixed with _ as may be used in future)
  private _tempNormal: Vector2 = new Vector2();
  private _tempPoint: Vector2 = new Vector2();

  constructor() {
    this.colliders = new FixedSizeArray<GameObject>(this.maxColliders);
  }

  /**
   * Get temp vectors for external use
   */
  getTempVectors(): { normal: Vector2; point: Vector2 } {
    return { normal: this._tempNormal, point: this._tempPoint };
  }

  /**
   * Reset the collision system
   */
  reset(): void {
    this.worldCollision = [];
    this.collisionTiles = [];
    this.colliders.clear();
    this.worldWidth = 0;
    this.worldHeight = 0;
  }

  /**
   * Set world collision data
   */
  setWorldCollision(segments: CollisionSegment[]): void {
    this.worldCollision = segments;
  }

  /**
   * Set tile collision map
   */
  setTileCollision(
    tiles: number[],
    width: number,
    height: number,
    tileWidth: number,
    tileHeight: number
  ): void {
    this.collisionTiles = tiles;
    this.worldWidth = width;
    this.worldHeight = height;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
  }

  /**
   * Register a collider
   */
  registerCollider(object: GameObject): void {
    this.colliders.add(object);
  }

  /**
   * Unregister a collider
   */
  unregisterCollider(object: GameObject): void {
    this.colliders.remove(object);
  }

  /**
   * Check collision between two rectangles
   */
  rectIntersects(a: Rect, b: Rect): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Check collision with world tiles
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

    if (this.collisionTiles.length === 0) {
      return result;
    }

    // Calculate tile ranges to check
    const left = Math.floor(x / this.tileWidth);
    const right = Math.floor((x + width) / this.tileWidth);
    const top = Math.floor(y / this.tileHeight);
    const bottom = Math.floor((y + height) / this.tileHeight);

    // Check each tile in range
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (this.isTileSolid(tx, ty)) {
          const tileRect: Rect = {
            x: tx * this.tileWidth,
            y: ty * this.tileHeight,
            width: this.tileWidth,
            height: this.tileHeight,
          };

          const objectRect: Rect = { x, y, width, height };

          if (this.rectIntersects(objectRect, tileRect)) {
            // Determine collision direction based on velocity and overlap
            const overlapLeft = x + width - tileRect.x;
            const overlapRight = tileRect.x + tileRect.width - x;
            const overlapTop = y + height - tileRect.y;
            const overlapBottom = tileRect.y + tileRect.height - y;

            // Find minimum overlap
            const minOverlapX = Math.min(overlapLeft, overlapRight);
            const minOverlapY = Math.min(overlapTop, overlapBottom);

            if (minOverlapX < minOverlapY) {
              // Horizontal collision
              if (overlapLeft < overlapRight && velocityX > 0) {
                result.rightWall = true;
                result.normal.x = -1;
              } else if (velocityX < 0) {
                result.leftWall = true;
                result.normal.x = 1;
              }
            } else {
              // Vertical collision
              // Use >= 0 for grounded check so standing still also counts as grounded
              if (overlapTop < overlapBottom && velocityY >= 0) {
                result.grounded = true;
                result.normal.y = -1;
              } else if (velocityY < 0) {
                result.ceiling = true;
                result.normal.y = 1;
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if a tile is solid
   */
  isTileSolid(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.worldWidth || tileY < 0 || tileY >= this.worldHeight) {
      return true; // Treat out of bounds as solid
    }

    const index = tileY * this.worldWidth + tileX;
    // Tile value > 0 means solid (convention)
    return this.collisionTiles[index] > 0;
  }

  /**
   * Check collision between game objects
   */
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

  /**
   * Raycast against world collision
   */
  raycast(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    maxDistance: number
  ): CollisionResult {
    const result: CollisionResult = {
      hit: false,
      normal: new Vector2(),
      penetration: 0,
      point: new Vector2(startX + dirX * maxDistance, startY + dirY * maxDistance),
    };

    // Check against world segments
    let closestT = maxDistance;

    for (const segment of this.worldCollision) {
      const t = this.raySegmentIntersection(
        startX,
        startY,
        dirX,
        dirY,
        segment.startX,
        segment.startY,
        segment.endX,
        segment.endY
      );

      if (t !== null && t < closestT && t > 0) {
        closestT = t;
        result.hit = true;
        result.point.set(startX + dirX * t, startY + dirY * t);
        result.normal.set(segment.normalX, segment.normalY);
        result.penetration = maxDistance - t;
      }
    }

    return result;
  }

  /**
   * Ray-segment intersection test
   */
  private raySegmentIntersection(
    rayX: number,
    rayY: number,
    rayDirX: number,
    rayDirY: number,
    segStartX: number,
    segStartY: number,
    segEndX: number,
    segEndY: number
  ): number | null {
    const segDirX = segEndX - segStartX;
    const segDirY = segEndY - segStartY;

    const denominator = rayDirX * segDirY - rayDirY * segDirX;

    // Parallel lines
    if (Math.abs(denominator) < 0.0001) {
      return null;
    }

    const t = ((segStartX - rayX) * segDirY - (segStartY - rayY) * segDirX) / denominator;
    const u = ((segStartX - rayX) * rayDirY - (segStartY - rayY) * rayDirX) / denominator;

    // Check if intersection is within segment and in front of ray
    if (t >= 0 && u >= 0 && u <= 1) {
      return t;
    }

    return null;
  }

  /**
   * Resolve collision by pushing object out
   */
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
      // Snap to top of tile
      const tileY = Math.floor((y + height) / this.tileHeight);
      result.y = tileY * this.tileHeight - height;
      result.velocityY = 0;
    }

    if (collision.ceiling) {
      // Snap to bottom of tile
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

  /**
   * Clear all registered colliders
   */
  clearColliders(): void {
    this.colliders.clear();
  }

  /**
   * Add a temporary surface for moving platforms
   * The surface will persist for one frame
   */
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

  /**
   * Update temporary surfaces - call once per frame
   * Swaps pending surfaces into active surfaces
   */
  updateTemporarySurfaces(): void {
    // Clear old temporary surfaces
    this.temporarySurfaces = [];

    // Swap pending into active
    const swap = this.temporarySurfaces;
    this.temporarySurfaces = this.pendingTemporarySurfaces;
    this.pendingTemporarySurfaces = swap;
  }

  /**
   * Get active temporary surfaces
   */
  getTemporarySurfaces(): TemporarySurface[] {
    return this.temporarySurfaces;
  }
}

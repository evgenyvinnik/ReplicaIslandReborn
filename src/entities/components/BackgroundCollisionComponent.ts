/**
 * Background Collision Component - Handles collision against the background
 * Ported from: Original/src/com/replica/replicaisland/BackgroundCollisionComponent.java
 *
 * Snaps colliding objects out of collision and reports the hit to the parent game object.
 * This component uses ray casting to detect collisions between the object's previous
 * position and current position, then snaps the object out of any intersecting surfaces.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import { Vector2 } from '../../utils/Vector2';
import type { CollisionSystem } from '../../engine/CollisionSystemNew';
import type { LevelSystem } from '../../levels/LevelSystem';
import type { TimeSystem } from '../../engine/TimeSystem';

/**
 * Configuration for the collision bounding box
 */
export interface BackgroundCollisionConfig {
  width: number;
  height: number;
  horizontalOffset: number;
  verticalOffset: number;
}

/**
 * Handles collision against the background tiles/world
 */
export class BackgroundCollisionComponent extends GameComponent {
  // Collision box dimensions and offsets
  private collisionWidth: number = 0;
  private collisionHeight: number = 0;
  private horizontalOffset: number = 0;
  private verticalOffset: number = 0;

  // Previous frame position tracking
  private previousPosition: Vector2 = new Vector2();

  // System references
  private collisionSystem: CollisionSystem | null = null;
  private levelSystem: LevelSystem | null = null;
  private timeSystem: TimeSystem | null = null;

  // Workspace vectors - allocated up front for performance
  private currentPosition: Vector2 = new Vector2();
  private previousCenter: Vector2 = new Vector2();
  private delta: Vector2 = new Vector2();
  private filterDirection: Vector2 = new Vector2();
  private horizontalHitPoint: Vector2 = new Vector2();
  private horizontalHitNormal: Vector2 = new Vector2();
  private verticalHitPoint: Vector2 = new Vector2();
  private verticalHitNormal: Vector2 = new Vector2();
  private rayStart: Vector2 = new Vector2();
  private rayEnd: Vector2 = new Vector2();
  private testPointStart: Vector2 = new Vector2();
  private testPointEnd: Vector2 = new Vector2();
  private mergedNormal: Vector2 = new Vector2();

  /**
   * Create a background collision component
   */
  constructor(config?: BackgroundCollisionConfig) {
    super(ComponentPhase.COLLISION_RESPONSE);

    if (config) {
      this.collisionWidth = config.width;
      this.collisionHeight = config.height;
      this.horizontalOffset = config.horizontalOffset;
      this.verticalOffset = config.verticalOffset;
    }
  }

  /**
   * Set collision system reference
   */
  setCollisionSystem(collision: CollisionSystem): void {
    this.collisionSystem = collision;
  }

  /**
   * Set level system reference
   */
  setLevelSystem(level: LevelSystem): void {
    this.levelSystem = level;
  }

  /**
   * Set time system reference
   */
  setTimeSystem(time: TimeSystem): void {
    this.timeSystem = time;
  }

  /**
   * Set the collision bounding box size
   */
  setSize(width: number, height: number): void {
    this.collisionWidth = width;
    this.collisionHeight = height;
  }

  /**
   * Set the collision bounding box offset from object origin
   */
  setOffset(horizontalOffset: number, verticalOffset: number): void {
    this.horizontalOffset = horizontalOffset;
    this.verticalOffset = verticalOffset;
  }

  /**
   * Reset the component to initial state
   */
  reset(): void {
    this.previousPosition.zero();
  }

  /**
   * Main collision response logic.
   *
   * The collision detection and response algorithm:
   * 1. Cast a ray from the center point of the box at its position last frame to the edge
   *    of the box at its current position. If the ray intersects anything, snap the box
   *    back to the point of intersection.
   * 2. Perform Step 1 twice: once looking for surfaces opposing horizontal movement and
   *    again for surfaces opposing vertical movement. These two ray tests approximate the
   *    movement of the box between the previous frame and this one.
   * 3. Since most collisions are collisions with the ground, more precision is required for
   *    vertical intersections. Perform another ray test, this time from the top of the
   *    box's position (after snapping in Step 2) to the bottom. Snap out of any vertical
   *    surfaces that the ray encounters.
   * 4. Add the normals of the surfaces that were hit up and normalize the result to produce
   *    a direction describing the average slope of the surfaces that the box is resting on.
   */
  update(_deltaTime: number, parent: GameObject): void {
    // Reset collision normal
    parent.setBackgroundCollisionNormal(Vector2.zero());

    // Skip if we don't have a previous position yet
    if (this.previousPosition.lengthSquared() === 0) {
      this.previousPosition.set(parent.getPosition());
      return;
    }

    if (!this.collisionSystem) {
      this.previousPosition.set(parent.getPosition());
      return;
    }

    // Calculate collision box bounds
    const left = this.horizontalOffset;
    const bottom = this.verticalOffset;
    const right = left + this.collisionWidth;
    const top = bottom + this.collisionHeight;
    const centerOffsetX = this.collisionWidth / 2 + left;
    const centerOffsetY = this.collisionHeight / 2 + bottom;

    // Get current position and calculate delta
    this.currentPosition.set(parent.getPosition());
    this.delta.set(this.currentPosition).subtract(this.previousPosition);

    // Calculate previous center for ray casting
    this.previousCenter.set(centerOffsetX, centerOffsetY);
    this.previousCenter.add(this.previousPosition);

    let horizontalHit = false;
    let verticalHit = false;

    // Clear hit points and normals
    this.verticalHitPoint.zero();
    this.verticalHitNormal.zero();
    this.horizontalHitPoint.zero();
    this.horizontalHitNormal.zero();

    // The order in which we sweep the horizontal and vertical space can affect the
    // final result because we perform incremental snapping mid-sweep. So it is
    // necessary to sweep in the primary direction of movement first.
    if (Math.abs(this.delta.x) > Math.abs(this.delta.y)) {
      horizontalHit = this.sweepHorizontal(
        this.previousCenter,
        this.currentPosition,
        this.delta,
        left,
        right,
        centerOffsetY,
        this.horizontalHitPoint,
        this.horizontalHitNormal,
        parent
      );
      verticalHit = this.sweepVertical(
        this.previousCenter,
        this.currentPosition,
        this.delta,
        bottom,
        top,
        centerOffsetX,
        this.verticalHitPoint,
        this.verticalHitNormal,
        parent
      );
    } else {
      verticalHit = this.sweepVertical(
        this.previousCenter,
        this.currentPosition,
        this.delta,
        bottom,
        top,
        centerOffsetX,
        this.verticalHitPoint,
        this.verticalHitNormal,
        parent
      );
      horizontalHit = this.sweepHorizontal(
        this.previousCenter,
        this.currentPosition,
        this.delta,
        left,
        right,
        centerOffsetY,
        this.horizontalHitPoint,
        this.horizontalHitNormal,
        parent
      );
    }

    // Force the collision volume to stay within the bounds of the world
    if (this.levelSystem) {
      const levelSize = this.levelSystem.getLevelSize();

      // Left boundary
      if (this.currentPosition.x + left < 0) {
        this.currentPosition.x = -left + 1;
        horizontalHit = true;
        this.horizontalHitNormal.x += 1;
        this.horizontalHitNormal.normalize();
      }
      // Right boundary
      else if (this.currentPosition.x + right > levelSize.width) {
        this.currentPosition.x = levelSize.width - right - 1;
        this.horizontalHitNormal.x -= 1;
        this.horizontalHitNormal.normalize();
        horizontalHit = true;
      }

      // Top boundary (note: in this game, y increases upward)
      if (this.currentPosition.y + top > levelSize.height) {
        this.currentPosition.y = levelSize.height - top - 1;
        this.verticalHitNormal.y -= 1;
        this.verticalHitNormal.normalize();
        verticalHit = true;
      }
    }

    // Additional alignment tests to ensure we're aligned with surfaces
    if (this.delta.x !== 0 && this.delta.y !== 0) {
      // Shoot a vertical line through the middle of the box
      this.rayStart.set(centerOffsetX, top);
      this.rayStart.add(this.currentPosition);

      this.rayEnd.set(centerOffsetX, bottom);
      this.rayEnd.add(this.currentPosition);

      this.filterDirection.set(this.delta);

      const verticalCast = this.castRay(
        this.rayStart,
        this.rayEnd,
        this.filterDirection,
        this.verticalHitPoint,
        this.verticalHitNormal,
        parent
      );

      if (verticalCast) {
        verticalHit = true;
        // Snap position
        if (this.verticalHitNormal.y > 0) {
          this.currentPosition.y = this.verticalHitPoint.y - bottom;
        } else if (this.verticalHitNormal.y < 0) {
          this.currentPosition.y = this.verticalHitPoint.y - top;
        }
      }

      // Horizontal alignment test
      let xStart = left;
      let xEnd = right;
      if (this.delta.x < 0) {
        xStart = right;
        xEnd = left;
      }

      this.rayStart.set(xStart, centerOffsetY);
      this.rayStart.add(this.currentPosition);

      this.rayEnd.set(xEnd, centerOffsetY);
      this.rayEnd.add(this.currentPosition);

      this.filterDirection.set(this.delta);

      const horizontalCast = this.castRay(
        this.rayStart,
        this.rayEnd,
        this.filterDirection,
        this.horizontalHitPoint,
        this.horizontalHitNormal,
        parent
      );

      if (horizontalCast) {
        horizontalHit = true;
        // Snap position
        if (this.horizontalHitNormal.x > 0) {
          this.currentPosition.x = this.horizontalHitPoint.x - left;
        } else if (this.horizontalHitNormal.x < 0) {
          this.currentPosition.x = this.horizontalHitPoint.x - right;
        }
      }
    }

    // Record the intersection for other systems to use
    if (this.timeSystem) {
      const time = this.timeSystem.getGameTime();

      if (horizontalHit) {
        if (this.horizontalHitNormal.x > 0) {
          parent.setLastTouchedLeftWallTime(time);
        } else {
          parent.setLastTouchedRightWallTime(time);
        }
      }

      if (verticalHit) {
        if (this.verticalHitNormal.y > 0) {
          parent.setLastTouchedFloorTime(time);
        } else {
          parent.setLastTouchedCeilingTime(time);
        }
      }

      // Merge normals from both hits
      this.mergedNormal.set(this.verticalHitNormal);
      this.mergedNormal.add(this.horizontalHitNormal);
      if (this.mergedNormal.lengthSquared() > 0) {
        this.mergedNormal.normalize();
      }
      parent.setBackgroundCollisionNormal(this.mergedNormal);

      parent.setPosition(this.currentPosition);
    }

    // Store current position for next frame
    this.previousPosition.set(parent.getPosition());
  }

  /**
   * Sweeps the space between two points looking for surfaces that oppose horizontal movement
   */
  private sweepHorizontal(
    previousPosition: Vector2,
    currentPosition: Vector2,
    delta: Vector2,
    left: number,
    right: number,
    centerY: number,
    hitPoint: Vector2,
    hitNormal: Vector2,
    _parent: GameObject
  ): boolean {
    if (Math.abs(delta.x) < 0.0001) {
      return false;
    }

    // Shoot a ray from the center of the previous frame's box to the edge
    // (left or right, depending on the direction of movement) of the current box
    this.testPointStart.y = centerY;
    this.testPointStart.x = left;
    let offset = -left;

    if (delta.x > 0) {
      this.testPointStart.x = right;
      offset = -right;
    }

    // Filter out surfaces that do not oppose motion in the horizontal direction
    this.filterDirection.set(delta);
    this.filterDirection.y = 0;

    this.testPointEnd.set(currentPosition);
    this.testPointEnd.add(this.testPointStart);

    const hit = this.castRay(
      previousPosition,
      this.testPointEnd,
      this.filterDirection,
      hitPoint,
      hitNormal,
      _parent
    );

    if (hit) {
      // Snap position
      currentPosition.x = hitPoint.x + offset;
    }

    return hit;
  }

  /**
   * Sweeps the space between two points looking for surfaces that oppose vertical movement
   */
  private sweepVertical(
    previousPosition: Vector2,
    currentPosition: Vector2,
    delta: Vector2,
    bottom: number,
    top: number,
    centerX: number,
    hitPoint: Vector2,
    hitNormal: Vector2,
    _parent: GameObject
  ): boolean {
    if (Math.abs(delta.y) < 0.0001) {
      return false;
    }

    // Shoot a ray from the center of the previous frame's box to the edge
    // (top or bottom, depending on the direction of movement) of the current box
    this.testPointStart.x = centerX;
    this.testPointStart.y = bottom;
    let offset = -bottom;

    if (delta.y > 0) {
      this.testPointStart.y = top;
      offset = -top;
    }

    // Filter out surfaces that do not oppose motion in the vertical direction
    this.filterDirection.set(delta);
    this.filterDirection.x = 0;

    this.testPointEnd.set(currentPosition);
    this.testPointEnd.add(this.testPointStart);

    const hit = this.castRay(
      previousPosition,
      this.testPointEnd,
      this.filterDirection,
      hitPoint,
      hitNormal,
      _parent
    );

    if (hit) {
      // Snap position
      currentPosition.y = hitPoint.y + offset;
    }

    return hit;
  }

  /**
   * Cast a ray and check for collision
   * Uses the collision system's raycast functionality
   */
  private castRay(
    startPoint: Vector2,
    endPoint: Vector2,
    _movementDirection: Vector2,
    hitPoint: Vector2,
    hitNormal: Vector2,
    _parent: GameObject
  ): boolean {
    if (!this.collisionSystem) {
      return false;
    }

    // Calculate ray direction and distance
    const dirX = endPoint.x - startPoint.x;
    const dirY = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dirX * dirX + dirY * dirY);

    if (distance < 0.0001) {
      return false;
    }

    // Normalize direction
    const normalizedDirX = dirX / distance;
    const normalizedDirY = dirY / distance;

    // Use collision system's raycast
    const result = this.collisionSystem.raycast(
      startPoint.x,
      startPoint.y,
      normalizedDirX,
      normalizedDirY,
      distance
    );

    if (result.hit) {
      hitPoint.set(result.point);
      hitNormal.set(result.normal);
      return true;
    }

    // Also check tile collision along the ray
    // For simpler tile-based collision, we'll check multiple points along the ray
    const steps = Math.ceil(distance / 16); // Check every 16 pixels
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const checkX = startPoint.x + dirX * t;
      const checkY = startPoint.y + dirY * t;

      // Simple tile collision check
      const tileCollision = this.collisionSystem.checkTileCollision(
        checkX,
        checkY,
        1,
        1,
        dirX,
        dirY
      );

      if (
        tileCollision.grounded ||
        tileCollision.ceiling ||
        tileCollision.leftWall ||
        tileCollision.rightWall
      ) {
        hitPoint.set(checkX, checkY);
        hitNormal.set(tileCollision.normal);
        return true;
      }
    }

    return false;
  }
}

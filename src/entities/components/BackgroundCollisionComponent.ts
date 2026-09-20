/**
 * Background Collision Component - Handles collision against the background
 *
 * PlayerComponent and MovementComponent use this response when segment data is
 * loaded. Coordinates and surface normals are Canvas Y-down. Projectiles
 * with SimpleCollisionComponent retain their original point-ray path.
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
import type { LevelSystem } from '../../levels/LevelSystemNew';
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
  private hasPreviousPosition = false;

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
    this.hasPreviousPosition = false;
  }

  /** Seed from immediately before movement, also safe after a teleport. */
  setPreviousPosition(position: Vector2): void {
    this.previousPosition.set(position);
    this.hasPreviousPosition = true;
  }

  getHorizontalHitNormal(): Vector2 {
    return this.horizontalHitNormal;
  }

  getVerticalHitNormal(): Vector2 {
    return this.verticalHitNormal;
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
    if (!this.hasPreviousPosition) {
      this.setPreviousPosition(parent.getPosition());
      return;
    }

    if (!this.collisionSystem) {
      this.previousPosition.set(parent.getPosition());
      return;
    }

    // Calculate collision box bounds
    const left = this.horizontalOffset;
    const top = this.verticalOffset;
    const right = left + this.collisionWidth;
    const bottom = top + this.collisionHeight;
    const centerOffsetX = this.collisionWidth / 2 + left;
    const centerOffsetY = this.collisionHeight / 2 + top;

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
        top,
        bottom,
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
        top,
        bottom,
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
    const levelSize = this.levelSystem?.getLevelSize() ?? this.collisionSystem.getWorldSize();
    if (levelSize) {

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

      // Android clamps the upper world edge. Leave the bottom open for pits.
      if (this.currentPosition.y + top < 0) {
        this.currentPosition.y = -top + 1;
        this.verticalHitNormal.y += 1;
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
          this.currentPosition.y = this.verticalHitPoint.y - top;
        } else if (this.verticalHitNormal.y < 0) {
          this.currentPosition.y = this.verticalHitPoint.y - bottom;
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
    {
      const time = this.timeSystem?.getGameTime() ?? parent.getGameTime();

      if (horizontalHit) {
        if (this.horizontalHitNormal.x > 0) {
          parent.setLastTouchedLeftWallTime(time);
        } else if (this.horizontalHitNormal.x < 0) {
          parent.setLastTouchedRightWallTime(time);
        }
      }

      if (verticalHit) {
        // Y-down normals: a floor's points up, at -1. The original's
        // `normal.y > 0` is a floor only in its Y-up world.
        if (this.verticalHitNormal.y < 0) {
          parent.setLastTouchedFloorTime(time);
        } else if (this.verticalHitNormal.y > 0) {
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
    top: number,
    bottom: number,
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
    this.testPointStart.y = top;
    let offset = -top;

    if (delta.y > 0) {
      this.testPointStart.y = bottom;
      offset = -bottom;
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
    movementDirection: Vector2,
    hitPoint: Vector2,
    hitNormal: Vector2,
    parent: GameObject
  ): boolean {
    if (!this.collisionSystem) {
      return false;
    }

    return this.collisionSystem.castRay(
      startPoint, endPoint, movementDirection, hitPoint, hitNormal, parent
    );
  }
}

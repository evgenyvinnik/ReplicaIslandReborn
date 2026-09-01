/**
 * Movement Component - Handles position updates based on velocity
 * Ported from: Original/src/com/replica/replicaisland/MovementComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { CollisionSystem } from '../../engine/CollisionSystemNew';

/**
 * Move `current` towards `target` at `acceleration` per second, without
 * overshooting. Mirrors the original's Interpolator: zero acceleration means no
 * change, so an object that sets its velocity directly keeps it.
 */
function interpolate(
  current: number,
  target: number,
  acceleration: number,
  deltaTime: number
): number {
  if (acceleration <= 0 || current === target) return current;

  const step = acceleration * deltaTime;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

export class MovementComponent extends GameComponent {
  /** Background collision box; null means use the object's full size. */
  private boxWidth: number | null = null;
  private boxHeight: number | null = null;
  private boxOffsetX: number = 0;
  private boxOffsetY: number = 0;

  private collisionSystem: CollisionSystem | null = null;
  private tileWidth: number = 32;
  private tileHeight: number = 32;

  constructor() {
    super(ComponentPhase.MOVEMENT);
  }

  /**
   * Set collision system reference
   */
  setCollisionSystem(collision: CollisionSystem): void {
    this.collisionSystem = collision;
  }

  /**
   * Set tile dimensions for proper collision snapping
   */
  setTileDimensions(width: number, height: number): void {
    this.tileWidth = width;
    this.tileHeight = height;
  }

  /**
   * Update position based on velocity
   */
  /**
   * Restrict background collision to a box inside the sprite.
   *
   * The original keeps this on BackgroundCollisionComponent (setSize/setOffset)
   * because a character's sprite is much wider than the space it occupies -
   * Wanda is a 64x128 sprite standing in a 32x82 box. Colliding with the full
   * sprite wedges her into walls she should walk past.
   *
   * Offsets are in this port's Y-down sprite space.
   */
  setCollisionBox(width: number, height: number, offsetX: number, offsetY: number): void {
    this.boxWidth = width;
    this.boxHeight = height;
    this.boxOffsetX = offsetX;
    this.boxOffsetY = offsetY;
  }

  /** Move without ever colliding with the background, as the flyers do. */
  disableBackgroundCollision(): void {
    this.collisionSystem = null;
  }

  update(deltaTime: number, parent: GameObject): void {
    if (parent.positionLocked) return;

    const position = parent.getPosition();
    const velocity = parent.getVelocity();
    const targetVelocity = parent.getTargetVelocity();
    const acceleration = parent.getAcceleration();

    // Interpolate velocity towards the target using acceleration, exactly as
    // the original's MovementComponent does through its Interpolator. With zero
    // acceleration this leaves velocity alone, so objects that set velocity
    // directly (projectiles) are unaffected.
    velocity.x = interpolate(velocity.x, targetVelocity.x, acceleration.x, deltaTime);
    velocity.y = interpolate(velocity.y, targetVelocity.y, acceleration.y, deltaTime);

    const gameTime = parent.getGameTime();

    // Calculate new position
    let newX = position.x + velocity.x * deltaTime;
    let newY = position.y + velocity.y * deltaTime;

    // Check collision if collision system is available
    if (this.collisionSystem) {
      // The collision box may be smaller than the sprite; work in box space and
      // convert back when writing the position.
      const boxWidth = this.boxWidth ?? parent.width;
      const boxHeight = this.boxHeight ?? parent.height;
      const offsetX = this.boxWidth === null ? 0 : this.boxOffsetX;
      const offsetY = this.boxHeight === null ? 0 : this.boxOffsetY;

      // Handle horizontal movement first
      const horizontalCollision = this.collisionSystem.checkTileCollision(
        newX + offsetX,
        position.y + offsetY,
        boxWidth,
        boxHeight,
        velocity.x,
        0
      );

      if (horizontalCollision.leftWall || horizontalCollision.rightWall) {
        // Snap to tile edge
        if (horizontalCollision.leftWall) {
          // Box's left edge hit a wall (moving left)
          const tileX = Math.floor((newX + offsetX) / this.tileWidth);
          // Snap left edge just past the right edge of the blocking tile
          newX = (tileX + 1) * this.tileWidth + 0.1 - offsetX;
          velocity.x = Math.max(0, velocity.x);
          parent.setLastTouchedLeftWallTime(gameTime);
        }
        if (horizontalCollision.rightWall) {
          // Box's right edge hit a wall (moving right)
          const tileX = Math.floor((newX + offsetX + boxWidth) / this.tileWidth);
          // Snap right edge just before the left edge of the blocking tile
          newX = tileX * this.tileWidth - boxWidth - 0.1 - offsetX;
          velocity.x = Math.min(0, velocity.x);
          parent.setLastTouchedRightWallTime(gameTime);
        }
      }

      // Now handle vertical movement with the adjusted X position
      const verticalCollision = this.collisionSystem.checkTileCollision(
        newX + offsetX,
        newY + offsetY,
        boxWidth,
        boxHeight,
        0,
        velocity.y
      );

      if (verticalCollision.grounded) {
        // Snap the box's feet to the top of the tile
        const tileY = Math.floor((newY + offsetY + boxHeight) / this.tileHeight);
        newY = tileY * this.tileHeight - boxHeight - offsetY;
        velocity.y = 0;
        parent.setLastTouchedFloorTime(gameTime);
      }

      if (verticalCollision.ceiling) {
        // Snap the box's head to the bottom of the tile
        const tileY = Math.floor((newY + offsetY) / this.tileHeight);
        newY = (tileY + 1) * this.tileHeight - offsetY;
        velocity.y = Math.max(0, velocity.y);
        parent.setLastTouchedCeilingTime(gameTime);
      }

      // Merge normals for background collision
      const normal = horizontalCollision.normal.clone();
      normal.add(verticalCollision.normal);
      if (normal.lengthSquared() > 0) {
        normal.normalize();
      }
      parent.setBackgroundCollisionNormal(normal);
    } else {
      // No collision system, just update position
    }

    // Update position
    position.x = newX;
    position.y = newY;
  }

  /**
   * Reset component
   */
  reset(): void {
    // Nothing to reset
  }
}

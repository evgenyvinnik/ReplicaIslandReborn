/**
 * Movement Component - Handles position updates based on velocity
 * Ported from: Original/src/com/replica/replicaisland/MovementComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { CollisionSystem } from '../../engine/CollisionSystemNew';

export class MovementComponent extends GameComponent {
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
  update(deltaTime: number, parent: GameObject): void {
    if (parent.positionLocked) return;

    const position = parent.getPosition();
    const velocity = parent.getVelocity();

    // Calculate new position
    let newX = position.x + velocity.x * deltaTime;
    let newY = position.y + velocity.y * deltaTime;

    // Check collision if collision system is available
    if (this.collisionSystem) {
      // Handle horizontal movement first
      const horizontalCollision = this.collisionSystem.checkTileCollision(
        newX,
        position.y,
        parent.width,
        parent.height,
        velocity.x,
        0
      );

      if (horizontalCollision.leftWall || horizontalCollision.rightWall) {
        // Snap to tile edge
        if (horizontalCollision.leftWall) {
          // Object's left edge hit a wall (moving left)
          // Find the tile that the left edge collided with
          const tileX = Math.floor(newX / this.tileWidth);
          // Snap left edge just past the right edge of the blocking tile
          newX = (tileX + 1) * this.tileWidth + 0.1;
          velocity.x = Math.max(0, velocity.x);
          parent.setLastTouchedLeftWallTime(performance.now() / 1000);
        }
        if (horizontalCollision.rightWall) {
          // Object's right edge hit a wall (moving right)
          // Find the tile that the right edge collided with
          const tileX = Math.floor((newX + parent.width) / this.tileWidth);
          // Snap right edge just before the left edge of the blocking tile
          newX = tileX * this.tileWidth - parent.width - 0.1;
          velocity.x = Math.min(0, velocity.x);
          parent.setLastTouchedRightWallTime(performance.now() / 1000);
        }
      }

      // Now handle vertical movement with the adjusted X position
      const verticalCollision = this.collisionSystem.checkTileCollision(
        newX,
        newY,
        parent.width,
        parent.height,
        0,
        velocity.y
      );

      if (verticalCollision.grounded) {
        // Snap to top of tile
        const tileY = Math.floor((newY + parent.height) / this.tileHeight);
        newY = tileY * this.tileHeight - parent.height;
        velocity.y = 0;
        parent.setLastTouchedFloorTime(performance.now() / 1000);
      }

      if (verticalCollision.ceiling) {
        // Snap to bottom of tile
        const tileY = Math.floor(newY / this.tileHeight);
        newY = (tileY + 1) * this.tileHeight;
        velocity.y = Math.max(0, velocity.y);
        parent.setLastTouchedCeilingTime(performance.now() / 1000);
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

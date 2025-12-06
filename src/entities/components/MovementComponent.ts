/**
 * Movement Component - Handles position updates based on velocity
 * Ported from: Original/src/com/replica/replicaisland/MovementComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { CollisionSystem, TileCollisionResult } from '../../engine/CollisionSystem';

export class MovementComponent extends GameComponent {
  private collisionSystem: CollisionSystem | null = null;

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
   * Update position based on velocity
   */
  update(deltaTime: number, parent: GameObject): void {
    if (parent.positionLocked) return;

    const position = parent.getPosition();
    const velocity = parent.getVelocity();

    // Calculate new position
    const newX = position.x + velocity.x * deltaTime;
    const newY = position.y + velocity.y * deltaTime;

    // Check collision if collision system is available
    if (this.collisionSystem) {
      const collision = this.collisionSystem.checkTileCollision(
        newX,
        newY,
        parent.width,
        parent.height,
        velocity.x,
        velocity.y
      );

      // Resolve collision
      this.resolveCollision(parent, collision, deltaTime);
    } else {
      // No collision system, just update position
      position.x = newX;
      position.y = newY;
    }
  }

  /**
   * Resolve collision and update position/velocity
   */
  private resolveCollision(
    parent: GameObject,
    collision: TileCollisionResult,
    _deltaTime: number
  ): void {
    const position = parent.getPosition();
    const velocity = parent.getVelocity();

    // Apply velocity
    position.x += velocity.x * 1/60; // Using fixed timestep
    position.y += velocity.y * 1/60;

    // Handle ground collision
    if (collision.grounded) {
      // Snap to ground
      const tileHeight = 32; // TODO: Get from level system
      const tileY = Math.floor((position.y + parent.height) / tileHeight);
      position.y = tileY * tileHeight - parent.height;
      velocity.y = 0;
      parent.setLastTouchedFloorTime(performance.now() / 1000);
    }

    // Handle ceiling collision
    if (collision.ceiling) {
      velocity.y = Math.max(0, velocity.y);
      parent.setLastTouchedCeilingTime(performance.now() / 1000);
    }

    // Handle left wall collision
    if (collision.leftWall) {
      velocity.x = Math.max(0, velocity.x);
      parent.setLastTouchedLeftWallTime(performance.now() / 1000);
    }

    // Handle right wall collision
    if (collision.rightWall) {
      velocity.x = Math.min(0, velocity.x);
      parent.setLastTouchedRightWallTime(performance.now() / 1000);
    }

    // Update background collision normal
    parent.setBackgroundCollisionNormal(collision.normal);
  }

  /**
   * Reset component
   */
  reset(): void {
    // Nothing to reset
  }
}

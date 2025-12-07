/**
 * Simple Collision Component - Simplified collision detection for projectiles and effects
 * Ported from: Original/src/com/replica/replicaisland/SimpleCollisionComponent.java
 *
 * A simplified collision component for objects that don't require complex collision
 * detection. Uses ray casting from previous position to current position to detect
 * collisions with background geometry.
 *
 * Ideal for:
 * - Projectiles (bullets, fireballs, etc.)
 * - Fast-moving effects
 * - Objects that need basic background collision only
 *
 * Key differences from BackgroundCollisionComponent:
 * - Uses ray casting instead of box collision
 * - Simpler and faster for small, fast-moving objects
 * - No gravity or complex physics integration
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { SystemRegistry } from '../../engine/SystemRegistry';
import { Vector2 } from '../../utils/Vector2';

// Global system registry reference
let sSystemRegistry: SystemRegistry | null = null;

export function setSimpleCollisionSystemRegistry(registry: SystemRegistry): void {
  sSystemRegistry = registry;
}

// Tolerance for comparing floats
const EPSILON = 0.001;

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

export class SimpleCollisionComponent extends GameComponent {
  private previousPosition: Vector2 = new Vector2();
  private currentPosition: Vector2 = new Vector2();
  private movementDirection: Vector2 = new Vector2();
  private hitPoint: Vector2 = new Vector2();
  private hitNormal: Vector2 = new Vector2();

  constructor() {
    super(ComponentPhase.COLLISION_DETECTION);
  }

  /**
   * Update - perform ray cast collision detection
   */
  update(_deltaTime: number, parent: GameObject): void {
    // Only perform collision if we have a previous position
    if (this.previousPosition.lengthSquared() > 0) {
      // Get current centered position
      this.currentPosition.set(
        parent.getCenteredPositionX(),
        parent.getCenteredPositionY()
      );

      // Calculate movement direction
      this.movementDirection.set(this.currentPosition);
      this.movementDirection.subtract(this.previousPosition);

      // Only cast ray if we actually moved
      if (this.movementDirection.lengthSquared() > 0) {
        const collision = sSystemRegistry?.collisionSystem;

        if (collision) {
          // Calculate ray direction and distance
          const distance = this.movementDirection.length();
          const dirX = this.movementDirection.x / distance;
          const dirY = this.movementDirection.y / distance;

          // Cast ray from previous to current position
          const result = collision.raycast(
            this.previousPosition.x,
            this.previousPosition.y,
            dirX,
            dirY,
            distance
          );

          if (result.hit) {
            // Store hit info
            this.hitPoint.set(result.point);
            this.hitNormal.set(result.normal);

            // Snap position to hit point
            const halfWidth = parent.width / 2;
            const halfHeight = parent.height / 2;

            if (!close(this.hitNormal.x, 0)) {
              parent.getPosition().x = this.hitPoint.x - halfWidth;
            }

            if (!close(this.hitNormal.y, 0)) {
              parent.getPosition().y = this.hitPoint.y - halfHeight;
            }

            // Update collision timing
            const timeSystem = sSystemRegistry?.timeSystem;
            if (timeSystem) {
              const time = timeSystem.getGameTime();

              if (this.hitNormal.x > 0) {
                parent.setLastTouchedLeftWallTime(time);
              } else if (this.hitNormal.x < 0) {
                parent.setLastTouchedRightWallTime(time);
              }

              if (this.hitNormal.y > 0) {
                parent.setLastTouchedFloorTime(time);
              } else if (this.hitNormal.y < 0) {
                parent.setLastTouchedCeilingTime(time);
              }
            }

            // Set background collision normal on parent
            parent.setBackgroundCollisionNormal(this.hitNormal);
          }
        }
      }
    }

    // Store current position for next frame
    this.previousPosition.set(
      parent.getCenteredPositionX(),
      parent.getCenteredPositionY()
    );
  }

  /**
   * Get the last hit point (if any)
   */
  getHitPoint(): Vector2 {
    return this.hitPoint;
  }

  /**
   * Get the last hit normal (if any)
   */
  getHitNormal(): Vector2 {
    return this.hitNormal;
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.previousPosition.zero();
    this.currentPosition.zero();
    this.movementDirection.zero();
    this.hitPoint.zero();
    this.hitNormal.zero();
  }
}

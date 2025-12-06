/**
 * Sphere Collision Volume
 * Ported from: Original/src/com/replica/replicaisland/SphereCollisionVolume.java
 *
 * A circular collision volume for distance-based collision detection.
 */

import { HitType } from '../../types';
import { CollisionVolume, type FlipInfo } from './CollisionVolume';
import { AABoxCollisionVolume } from './AABoxCollisionVolume';
import { Vector2 } from '../../utils/Vector2';

/**
 * Sphere/circle collision volume
 */
export class SphereCollisionVolume extends CollisionVolume {
  private radius: number;
  private centerX: number;
  private centerY: number;

  // Workspace vectors for calculations
  private workspaceVector: Vector2 = new Vector2();
  private workspaceVector2: Vector2 = new Vector2();

  constructor(
    radius: number = 0,
    centerX: number = 0,
    centerY: number = 0,
    hitType: HitType = HitType.INVALID
  ) {
    super(hitType);
    this.radius = radius;
    this.centerX = centerX;
    this.centerY = centerY;
  }

  protected getMaxX(): number {
    return this.centerX + this.radius;
  }

  protected getMinX(): number {
    return this.centerX - this.radius;
  }

  protected getMaxY(): number {
    return this.centerY + this.radius;
  }

  protected getMinY(): number {
    return this.centerY - this.radius;
  }

  /**
   * Get the center point
   */
  getCenter(): { x: number; y: number } {
    return { x: this.centerX, y: this.centerY };
  }

  /**
   * Set the center point
   */
  setCenter(center: { x: number; y: number }): void {
    this.centerX = center.x;
    this.centerY = center.y;
  }

  /**
   * Get the radius
   */
  getRadius(): number {
    return this.radius;
  }

  /**
   * Set the radius
   */
  setRadius(radius: number): void {
    this.radius = radius;
  }

  /**
   * Reset the volume
   */
  reset(): void {
    this.centerX = 0;
    this.centerY = 0;
    this.radius = 0;
    this.hitType = HitType.INVALID;
  }

  /**
   * Offset a position by center accounting for flip
   */
  private offsetByCenter(
    position: Vector2,
    center: { x: number; y: number },
    flip: FlipInfo | null
  ): void {
    if (flip) {
      if (flip.flipX) {
        position.x += flip.parentWidth - center.x;
      } else {
        position.x += center.x;
      }
      if (flip.flipY) {
        position.y += flip.parentHeight - center.y;
      } else {
        position.y += center.y;
      }
    } else {
      position.x += center.x;
      position.y += center.y;
    }
  }

  /**
   * Test intersection with another volume
   */
  intersects(
    position: { x: number; y: number },
    flip: FlipInfo | null,
    other: CollisionVolume,
    otherPosition: { x: number; y: number },
    otherFlip: FlipInfo | null
  ): boolean {
    // For AABox, defer to the AABox's more accurate calculation
    if (other instanceof AABoxCollisionVolume) {
      return other.intersects(otherPosition, otherFlip, this, position, flip);
    }

    // For sphere-sphere or sphere-other, do distance check
    this.workspaceVector.set(position.x, position.y);
    this.offsetByCenter(this.workspaceVector, { x: this.centerX, y: this.centerY }, flip);

    let otherRadius = 0;

    if (other instanceof SphereCollisionVolume) {
      const sphereOther = other as SphereCollisionVolume;
      this.workspaceVector2.set(otherPosition.x, otherPosition.y);
      this.offsetByCenter(this.workspaceVector2, sphereOther.getCenter(), otherFlip);
      this.workspaceVector.subtract(this.workspaceVector2);
      otherRadius = sphereOther.getRadius();
    } else {
      // Treat unknown volume type as a sphere
      const deltaX = other.getMaxXPosition(otherFlip) - other.getMinXPosition(otherFlip);
      const deltaY = other.getMaxYPosition(otherFlip) - other.getMinYPosition(otherFlip);
      const otherCenterX = deltaX / 2;
      const otherCenterY = deltaY / 2;

      this.workspaceVector2.set(otherPosition.x + otherCenterX, otherPosition.y + otherCenterY);
      this.workspaceVector.subtract(this.workspaceVector2);
      otherRadius = Math.max(deltaX, deltaY);
    }

    const maxDistance = this.radius + otherRadius;
    const distance2 = this.workspaceVector.lengthSquared();
    const maxDistance2 = maxDistance * maxDistance;

    return distance2 < maxDistance2;
  }

  /**
   * Grow the volume to encompass another volume
   */
  growBy(other: CollisionVolume): void {
    let maxX: number;
    let minX: number;
    let maxY: number;
    let minY: number;

    if (this.radius > 0) {
      maxX = Math.max(this.getMaxX(), other.getMaxXPosition(null));
      minX = Math.min(this.getMinX(), other.getMinXPosition(null));
      maxY = Math.max(this.getMaxY(), other.getMaxYPosition(null));
      minY = Math.min(this.getMinY(), other.getMinYPosition(null));
    } else {
      maxX = other.getMaxXPosition(null);
      minX = other.getMinXPosition(null);
      maxY = other.getMaxYPosition(null);
      minY = other.getMinYPosition(null);
    }

    const horizontalDelta = maxX - minX;
    const verticalDelta = maxY - minY;
    const diameter = Math.max(horizontalDelta, verticalDelta);

    this.centerX = minX + horizontalDelta / 2;
    this.centerY = minY + verticalDelta / 2;
    this.radius = diameter / 2;
  }
}

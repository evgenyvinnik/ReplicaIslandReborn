/**
 * Axis-Aligned Box Collision Volume
 * Ported from: Original/src/com/replica/replicaisland/AABoxCollisionVolume.java
 *
 * An Axis-Aligned rectangular collision volume. This code treats other volumes as if they are
 * also rectangles when calculating intersections.
 */

import { HitType } from '../../types';
import { CollisionVolume, type FlipInfo } from './CollisionVolume';

/**
 * Axis-aligned bounding box collision volume
 */
export class AABoxCollisionVolume extends CollisionVolume {
  private offsetX: number;
  private offsetY: number;
  private width: number;
  private height: number;

  constructor(
    offsetX: number = 0,
    offsetY: number = 0,
    width: number = 0,
    height: number = 0,
    hitType: HitType = HitType.INVALID
  ) {
    super(hitType);
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.width = width;
    this.height = height;
  }

  /**
   * Set the volume dimensions
   */
  set(offsetX: number, offsetY: number, width: number, height: number): void {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.width = width;
    this.height = height;
  }

  /**
   * Get the width of the volume
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Get the height of the volume
   */
  getHeight(): number {
    return this.height;
  }

  protected getMaxX(): number {
    return this.offsetX + this.width;
  }

  protected getMinX(): number {
    return this.offsetX;
  }

  protected getMaxY(): number {
    return this.offsetY + this.height;
  }

  protected getMinY(): number {
    return this.offsetY;
  }

  /**
   * Calculates the intersection of this volume and another
   */
  intersects(
    position: { x: number; y: number },
    flip: FlipInfo | null,
    other: CollisionVolume,
    otherPosition: { x: number; y: number },
    otherFlip: FlipInfo | null
  ): boolean {
    const left = this.getMinXPosition(flip) + position.x;
    const right = this.getMaxXPosition(flip) + position.x;
    const bottom = this.getMinYPosition(flip) + position.y;
    const top = this.getMaxYPosition(flip) + position.y;

    const otherLeft = other.getMinXPosition(otherFlip) + otherPosition.x;
    const otherRight = other.getMaxXPosition(otherFlip) + otherPosition.x;
    const otherBottom = other.getMinYPosition(otherFlip) + otherPosition.y;
    const otherTop = other.getMaxYPosition(otherFlip) + otherPosition.y;

    return (
      this.boxIntersect(left, right, top, bottom, otherLeft, otherRight, otherTop, otherBottom) ||
      this.boxIntersect(otherLeft, otherRight, otherTop, otherBottom, left, right, top, bottom)
    );
  }

  /**
   * Tests two axis-aligned boxes for overlap
   */
  private boxIntersect(
    left1: number,
    right1: number,
    top1: number,
    bottom1: number,
    left2: number,
    right2: number,
    top2: number,
    bottom2: number
  ): boolean {
    const horizontalIntersection = left1 < right2 && left2 < right1;
    const verticalIntersection = top1 > bottom2 && top2 > bottom1;
    return horizontalIntersection && verticalIntersection;
  }

  /**
   * Increases the size of this volume as necessary to fit the passed volume
   */
  growBy(other: CollisionVolume): void {
    let maxX: number;
    let minX: number;
    let maxY: number;
    let minY: number;

    if (this.width * this.height > 0) {
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

    this.offsetX = minX;
    this.offsetY = minY;
    this.width = maxX - minX;
    this.height = maxY - minY;
  }

  /**
   * Reset the volume
   */
  reset(): void {
    this.offsetX = 0;
    this.offsetY = 0;
    this.width = 0;
    this.height = 0;
    this.hitType = HitType.INVALID;
  }
}

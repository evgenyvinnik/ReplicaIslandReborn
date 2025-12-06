/**
 * Collision Volume - Base class for collision detection volumes
 * Ported from: Original/src/com/replica/replicaisland/CollisionVolume.java
 *
 * CollisionVolume describes a volume (rectangle, sphere, etc) used for dynamic collision detection.
 * Volumes can be tested for intersection against other volumes. The volume itself is stored in
 * object-relative space (in terms of offsets from some origin); when used with game objects the
 * position of the parent object must be passed to a parameter of the intersection test.
 */

import { HitType } from '../../types';

/**
 * Flip information for handling mirrored sprites
 */
export interface FlipInfo {
  flipX: boolean;
  flipY: boolean;
  parentWidth: number;
  parentHeight: number;
}

/**
 * Create a default FlipInfo
 */
export function createFlipInfo(): FlipInfo {
  return {
    flipX: false,
    flipY: false,
    parentWidth: 0,
    parentHeight: 0,
  };
}

/**
 * Abstract base class for all collision volumes
 */
export abstract class CollisionVolume {
  /**
   * When used as an attack volume, hitType specifies the type of hit that the volume deals.
   * When used as a vulnerability volume, it specifies which type the volume is vulnerable to
   * (INVALID = all types).
   */
  protected hitType: HitType = HitType.INVALID;

  constructor(hitType: HitType = HitType.INVALID) {
    this.hitType = hitType;
  }

  /**
   * Set the hit type
   */
  setHitType(type: HitType): void {
    this.hitType = type;
  }

  /**
   * Get the hit type
   */
  getHitType(): HitType {
    return this.hitType;
  }

  /**
   * Test if this volume intersects another
   */
  abstract intersects(
    position: { x: number; y: number },
    flip: FlipInfo | null,
    other: CollisionVolume,
    otherPosition: { x: number; y: number },
    otherFlip: FlipInfo | null
  ): boolean;

  /**
   * Get minimum X position accounting for flip
   */
  getMinXPosition(flip: FlipInfo | null): number {
    if (flip && flip.flipX) {
      return flip.parentWidth - this.getMaxX();
    }
    return this.getMinX();
  }

  /**
   * Get maximum X position accounting for flip
   */
  getMaxXPosition(flip: FlipInfo | null): number {
    if (flip && flip.flipX) {
      return flip.parentWidth - this.getMinX();
    }
    return this.getMaxX();
  }

  /**
   * Get minimum Y position accounting for flip
   */
  getMinYPosition(flip: FlipInfo | null): number {
    if (flip && flip.flipY) {
      return flip.parentHeight - this.getMaxY();
    }
    return this.getMinY();
  }

  /**
   * Get maximum Y position accounting for flip
   */
  getMaxYPosition(flip: FlipInfo | null): number {
    if (flip && flip.flipY) {
      return flip.parentHeight - this.getMinY();
    }
    return this.getMaxY();
  }

  /**
   * Get the minimum X boundary of the volume
   */
  protected abstract getMinX(): number;

  /**
   * Get the maximum X boundary of the volume
   */
  protected abstract getMaxX(): number;

  /**
   * Get the minimum Y boundary of the volume
   */
  protected abstract getMinY(): number;

  /**
   * Get the maximum Y boundary of the volume
   */
  protected abstract getMaxY(): number;

  /**
   * Reset the volume to default state
   */
  abstract reset(): void;
}

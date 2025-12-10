/**
 * Game Object Collision System - Handles collisions between moving game objects
 * Ported from: Original/src/com/replica/replicaisland/GameObjectCollisionSystem.java
 *
 * A system for calculating collisions between moving game objects. This system accepts collision
 * volumes from game objects each frame and performs a series of tests to see which of them
 * overlap. Collisions are only considered between offending "attack" volumes and receiving
 * "vulnerability" volumes.
 *
 * This implementation works by using a sweep-and-prune algorithm: objects to be considered are
 * sorted in the x axis and then compared in one dimension for overlaps. A bounding volume that
 * encompasses all attack and vulnerability volumes is used for this test, and when an intersection
 * is found the actual offending and receiving volumes are compared.
 */

import type { GameObject } from '../entities/GameObject';
import type { HitReactionComponent } from '../entities/components/HitReactionComponent';
import { CollisionVolume, createFlipInfo, type FlipInfo } from './collision/CollisionVolume';
import { HitType } from '../types';

const MAX_COLLIDING_OBJECTS = 256;

/**
 * A record of a single game object and its associated collision info
 */
interface CollisionVolumeRecord {
  object: GameObject;
  reactionComponent: HitReactionComponent | null;
  boundingVolume: CollisionVolume;
  attackVolumes: CollisionVolume[] | null;
  vulnerabilityVolumes: CollisionVolume[] | null;
}

/**
 * Create an empty collision volume record
 */
function createCollisionVolumeRecord(): CollisionVolumeRecord {
  return {
    object: null!,
    reactionComponent: null,
    boundingVolume: null!,
    attackVolumes: null,
    vulnerabilityVolumes: null,
  };
}

/**
 * Reset a collision volume record
 */
function resetCollisionVolumeRecord(record: CollisionVolumeRecord): void {
  record.object = null!;
  record.reactionComponent = null;
  record.boundingVolume = null!;
  record.attackVolumes = null;
  record.vulnerabilityVolumes = null;
}

/**
 * Game Object Collision System
 */
export class GameObjectCollisionSystem {
  private objects: CollisionVolumeRecord[] = [];
  private recordPool: CollisionVolumeRecord[] = [];

  // Reusable flip info objects to avoid allocations
  private flip: FlipInfo = createFlipInfo();
  private otherFlip: FlipInfo = createFlipInfo();

  // Debug options
  private drawDebugBoundingVolume: boolean = false;
  private drawDebugCollisionVolumes: boolean = false;

  constructor() {
    // Pre-allocate record pool
    for (let i = 0; i < MAX_COLLIDING_OBJECTS; i++) {
      this.recordPool.push(createCollisionVolumeRecord());
    }
  }

  /**
   * Reset the system
   */
  reset(): void {
    // Return all active records to pool
    for (const record of this.objects) {
      resetCollisionVolumeRecord(record);
      this.recordPool.push(record);
    }
    this.objects = [];
    this.drawDebugBoundingVolume = false;
    this.drawDebugCollisionVolumes = false;
  }

  /**
   * Adds a game object, and its related volumes, to the dynamic collision world for one frame.
   * Once registered for collisions the object may damage other objects via attack volumes or
   * receive damage from other volumes via vulnerability volumes.
   *
   * @param object The object to consider for collision
   * @param reactionComponent A HitReactionComponent to notify when an intersection is calculated
   * @param boundingVolume A volume that describes the game object in space
   * @param attackVolumes A list of volumes that can hit other game objects
   * @param vulnerabilityVolumes A list of volumes that can receive hits from other game objects
   */
  registerForCollisions(
    object: GameObject,
    reactionComponent: HitReactionComponent | null,
    boundingVolume: CollisionVolume,
    attackVolumes: CollisionVolume[] | null,
    vulnerabilityVolumes: CollisionVolume[] | null
  ): void {
    if (this.objects.length >= MAX_COLLIDING_OBJECTS) {
      // console.log('GameObjectCollisionSystem: Max colliding objects reached');
      return;
    }

    if (!object || !boundingVolume || (!attackVolumes && !vulnerabilityVolumes)) {
      return;
    }

    const record = this.recordPool.pop() || createCollisionVolumeRecord();
    record.object = object;
    record.reactionComponent = reactionComponent;
    record.boundingVolume = boundingVolume;
    record.attackVolumes = attackVolumes;
    record.vulnerabilityVolumes = vulnerabilityVolumes;

    this.objects.push(record);
  }

  /**
   * Update the collision system - performs collision detection between all registered objects
   */
  update(_deltaTime: number): void {
    // Sort objects by their x position (sweep and prune)
    this.objects.sort((a, b) => {
      this.flip.flipX = a.object.facingDirection.x < 0;
      this.flip.flipY = a.object.facingDirection.y < 0;
      this.flip.parentWidth = a.object.width;
      this.flip.parentHeight = a.object.height;
      const minX1 = a.object.getPosition().x + a.boundingVolume.getMinXPosition(this.flip);

      this.flip.flipX = b.object.facingDirection.x < 0;
      this.flip.flipY = b.object.facingDirection.y < 0;
      this.flip.parentWidth = b.object.width;
      this.flip.parentHeight = b.object.height;
      const minX2 = b.object.getPosition().x + b.boundingVolume.getMinXPosition(this.flip);

      return minX1 - minX2;
    });

    const count = this.objects.length;

    for (let x = 0; x < count; x++) {
      const record = this.objects[x];
      const position = record.object.getPosition();

      // Setup flip info for this object
      this.flip.flipX = record.object.facingDirection.x < 0;
      this.flip.flipY = record.object.facingDirection.y < 0;
      this.flip.parentWidth = record.object.width;
      this.flip.parentHeight = record.object.height;

      const maxX = record.boundingVolume.getMaxXPosition(this.flip) + position.x;

      for (let y = x + 1; y < count; y++) {
        const other = this.objects[y];
        const otherPosition = other.object.getPosition();

        // Setup flip info for other object
        this.otherFlip.flipX = other.object.facingDirection.x < 0;
        this.otherFlip.flipY = other.object.facingDirection.y < 0;
        this.otherFlip.parentWidth = other.object.width;
        this.otherFlip.parentHeight = other.object.height;

        // Sweep and prune: if other object is beyond maxX, no more collisions possible
        if (otherPosition.x + other.boundingVolume.getMinXPosition(this.otherFlip) > maxX) {
          break;
        }

        // Check if we need to test these objects at all
        const testRequired =
          (record.attackVolumes !== null && other.vulnerabilityVolumes !== null) ||
          (record.vulnerabilityVolumes !== null && other.attackVolumes !== null);

        if (
          testRequired &&
          record.boundingVolume.intersects(
            position,
            this.flip,
            other.boundingVolume,
            otherPosition,
            this.otherFlip
          )
        ) {
          // Test record attacking other
          const hit = this.testAttackAgainstVulnerability(
            record.attackVolumes,
            other.vulnerabilityVolumes,
            position,
            otherPosition,
            this.flip,
            this.otherFlip
          );

          if (hit !== HitType.INVALID) {
            let hitAccepted = false;
            if (other.reactionComponent) {
              hitAccepted = other.reactionComponent.receivedHit(
                other.object,
                record.object,
                hit
              );
            }
            if (record.reactionComponent) {
              record.reactionComponent.hitVictim(
                record.object,
                other.object,
                hit,
                hitAccepted
              );
            }
          }

          // Test other attacking record
          const hit2 = this.testAttackAgainstVulnerability(
            other.attackVolumes,
            record.vulnerabilityVolumes,
            otherPosition,
            position,
            this.otherFlip,
            this.flip
          );

          if (hit2 !== HitType.INVALID) {
            let hitAccepted = false;
            if (record.reactionComponent) {
              hitAccepted = record.reactionComponent.receivedHit(
                record.object,
                other.object,
                hit2
              );
            }
            if (other.reactionComponent) {
              other.reactionComponent.hitVictim(
                other.object,
                record.object,
                hit2,
                hitAccepted
              );
            }
          }
        }
      }

      // Return record to pool (safe since we're done with it)
      resetCollisionVolumeRecord(record);
    }

    // Clear the active objects and return them to pool
    for (const record of this.objects) {
      this.recordPool.push(record);
    }
    this.objects = [];
  }

  /**
   * Compares the passed list of attack volumes against the passed list of vulnerability volumes
   * and returns a hit type if an intersection is found.
   */
  private testAttackAgainstVulnerability(
    attackVolumes: CollisionVolume[] | null,
    vulnerabilityVolumes: CollisionVolume[] | null,
    attackPosition: { x: number; y: number },
    vulnerabilityPosition: { x: number; y: number },
    attackFlip: FlipInfo,
    vulnerabilityFlip: FlipInfo
  ): HitType {
    if (!attackVolumes || !vulnerabilityVolumes) {
      return HitType.INVALID;
    }

    for (const attackVolume of attackVolumes) {
      const hitType = attackVolume.getHitType();

      if (hitType !== HitType.INVALID) {
        for (const vulnerabilityVolume of vulnerabilityVolumes) {
          const vulnerableType = vulnerabilityVolume.getHitType();

          // If vulnerableType is INVALID, accept any hit type
          // Otherwise, must match
          if (
            vulnerableType === HitType.INVALID ||
            vulnerableType === hitType
          ) {
            if (
              attackVolume.intersects(
                attackPosition,
                attackFlip,
                vulnerabilityVolume,
                vulnerabilityPosition,
                vulnerabilityFlip
              )
            ) {
              return hitType;
            }
          }
        }
      }
    }

    return HitType.INVALID;
  }

  /**
   * Set debug preferences
   */
  setDebugPrefs(drawBoundingVolumes: boolean, drawCollisionVolumes: boolean): void {
    this.drawDebugBoundingVolume = drawBoundingVolumes;
    this.drawDebugCollisionVolumes = drawCollisionVolumes;
  }

  /**
   * Get debug preferences
   */
  getDebugPrefs(): { drawBoundingVolume: boolean; drawCollisionVolumes: boolean } {
    return {
      drawBoundingVolume: this.drawDebugBoundingVolume,
      drawCollisionVolumes: this.drawDebugCollisionVolumes,
    };
  }
}

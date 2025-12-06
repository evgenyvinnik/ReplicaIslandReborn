/**
 * Dynamic Collision Component - Registers objects for object-to-object collision
 * Ported from: Original/src/com/replica/replicaisland/DynamicCollisionComponent.java
 *
 * A component to include dynamic collision volumes (such as those produced every frame from
 * animating sprites) in the dynamic collision world. Given a set of "attack" volumes and
 * "vulnerability" volumes, this component creates a bounding volume that encompasses the set
 * and submits it to the dynamic collision system.
 *
 * Including this component in a game object will allow it to send and receive hits to other
 * game objects.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import { CollisionVolume, SphereCollisionVolume } from '../../engine/collision';
import type { HitReactionComponent } from './HitReactionComponent';
import type { GameObjectCollisionSystem } from '../../engine/GameObjectCollisionSystem';

/**
 * Dynamic collision component for object-to-object collision detection
 */
export class DynamicCollisionComponent extends GameComponent {
  private attackVolumes: CollisionVolume[] | null = null;
  private vulnerabilityVolumes: CollisionVolume[] | null = null;
  private boundingVolume: SphereCollisionVolume;
  private hitReactionComponent: HitReactionComponent | null = null;

  // System reference
  private collisionSystem: GameObjectCollisionSystem | null = null;

  constructor() {
    super(ComponentPhase.FRAME_END);
    this.boundingVolume = new SphereCollisionVolume(0, 0, 0);
  }

  /**
   * Set the game object collision system reference
   */
  setCollisionSystem(system: GameObjectCollisionSystem): void {
    this.collisionSystem = system;
  }

  /**
   * Reset the component
   */
  reset(): void {
    this.attackVolumes = null;
    this.vulnerabilityVolumes = null;
    this.boundingVolume.setCenter({ x: 0, y: 0 });
    this.boundingVolume.setRadius(0);
    this.hitReactionComponent = null;
  }

  /**
   * Update - register for collision detection this frame
   */
  update(_deltaTime: number, parent: GameObject): void {
    if (this.collisionSystem && this.boundingVolume.getRadius() > 0) {
      this.collisionSystem.registerForCollisions(
        parent,
        this.hitReactionComponent,
        this.boundingVolume,
        this.attackVolumes,
        this.vulnerabilityVolumes
      );
    }
  }

  /**
   * Set the hit reaction component
   */
  setHitReactionComponent(component: HitReactionComponent): void {
    this.hitReactionComponent = component;
  }

  /**
   * Set collision volumes for this object
   * @param attackVolumes Volumes that can deal damage to others
   * @param vulnerabilityVolumes Volumes that can receive damage from others
   */
  setCollisionVolumes(
    attackVolumes: CollisionVolume[] | null,
    vulnerabilityVolumes: CollisionVolume[] | null
  ): void {
    // Only update if volumes have changed
    if (this.vulnerabilityVolumes !== vulnerabilityVolumes || this.attackVolumes !== attackVolumes) {
      this.attackVolumes = attackVolumes;
      this.vulnerabilityVolumes = vulnerabilityVolumes;

      // Reset bounding volume and grow to encompass all collision volumes
      this.boundingVolume.reset();

      if (this.attackVolumes) {
        for (const volume of this.attackVolumes) {
          this.boundingVolume.growBy(volume);
        }
      }

      if (this.vulnerabilityVolumes) {
        for (const volume of this.vulnerabilityVolumes) {
          this.boundingVolume.growBy(volume);
        }
      }
    }
  }

  /**
   * Get current attack volumes
   */
  getAttackVolumes(): CollisionVolume[] | null {
    return this.attackVolumes;
  }

  /**
   * Get current vulnerability volumes
   */
  getVulnerabilityVolumes(): CollisionVolume[] | null {
    return this.vulnerabilityVolumes;
  }

  /**
   * Get the bounding volume
   */
  getBoundingVolume(): SphereCollisionVolume {
    return this.boundingVolume;
  }
}

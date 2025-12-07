/**
 * OrbitalMagnetComponent - Attracts objects to a target (usually player)
 * Inspired by: Original/src/com/replica/replicaisland/OrbitalMagnetComponent.java
 * 
 * This component creates a magnetic attraction effect, useful for:
 * - Coins being pulled toward the player
 * - Collectibles auto-collecting when near player
 * - Power-up attraction effects
 */

import { GameComponent } from '../GameComponent';
import { GameObject } from '../GameObject';
import { ComponentPhase } from '../../types';
import { Vector2 } from '../../utils/Vector2';

export interface OrbitalMagnetConfig {
  /** Magnetic strength - higher = faster attraction */
  strength?: number;
  /** Radius within which the magnet is active */
  areaRadius?: number;
  /** Whether to completely override velocity when attracting */
  overrideVelocity?: boolean;
  /** Minimum distance to target (to avoid oscillation) */
  minDistance?: number;
}

export class OrbitalMagnetComponent extends GameComponent {
  private static readonly DEFAULT_STRENGTH = 15.0;
  private static readonly DEFAULT_AREA_RADIUS = 100.0;
  private static readonly DEFAULT_MIN_DISTANCE = 5.0;

  /** Magnetic strength */
  private strength: number = OrbitalMagnetComponent.DEFAULT_STRENGTH;
  
  /** Radius within which attraction is active */
  private areaRadius: number = OrbitalMagnetComponent.DEFAULT_AREA_RADIUS;
  
  /** Override velocity completely when attracting */
  private overrideVelocity: boolean = false;
  
  /** Minimum distance to target */
  private minDistance: number = OrbitalMagnetComponent.DEFAULT_MIN_DISTANCE;
  
  /** Target object to attract toward */
  private target: GameObject | null = null;
  
  /** Reusable vectors for calculations */
  private delta: Vector2 = new Vector2();

  constructor() {
    super(ComponentPhase.COLLISION_DETECTION);
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.strength = OrbitalMagnetComponent.DEFAULT_STRENGTH;
    this.areaRadius = OrbitalMagnetComponent.DEFAULT_AREA_RADIUS;
    this.overrideVelocity = false;
    this.minDistance = OrbitalMagnetComponent.DEFAULT_MIN_DISTANCE;
    this.target = null;
    this.delta.set(0, 0);
  }

  /**
   * Configure the magnet
   */
  setConfig(config: OrbitalMagnetConfig): void {
    if (config.strength !== undefined) {
      this.strength = config.strength;
    }
    if (config.areaRadius !== undefined) {
      this.areaRadius = config.areaRadius;
    }
    if (config.overrideVelocity !== undefined) {
      this.overrideVelocity = config.overrideVelocity;
    }
    if (config.minDistance !== undefined) {
      this.minDistance = config.minDistance;
    }
  }

  /**
   * Set the target to attract toward
   */
  setTarget(target: GameObject | null): void {
    this.target = target;
  }

  /**
   * Set magnetic strength
   */
  setStrength(strength: number): void {
    this.strength = strength;
  }

  /**
   * Set area radius
   */
  setAreaRadius(radius: number): void {
    this.areaRadius = radius;
  }

  /**
   * Update - apply magnetic attraction
   */
  update(deltaTime: number, parent: GameObject): void {
    if (!this.target) {
      return;
    }

    const parentPos = parent.getPosition();
    const targetPos = this.target.getPosition();

    // Calculate center positions
    const parentCenterX = parentPos.x + parent.width / 2;
    const parentCenterY = parentPos.y + parent.height / 2;
    const targetCenterX = targetPos.x + this.target.width / 2;
    const targetCenterY = targetPos.y + this.target.height / 2;

    // Calculate delta to target
    this.delta.x = targetCenterX - parentCenterX;
    this.delta.y = targetCenterY - parentCenterY;

    const distanceSquared = this.delta.x * this.delta.x + this.delta.y * this.delta.y;
    const distance = Math.sqrt(distanceSquared);
    const areaRadiusSquared = this.areaRadius * this.areaRadius;

    // Only apply magnetism if within area
    if (distanceSquared < areaRadiusSquared && distance > this.minDistance) {
      // Normalize direction
      this.delta.x /= distance;
      this.delta.y /= distance;

      // Calculate force (stronger when closer)
      const forceFactor = 1 - (distance / this.areaRadius);
      const force = this.strength * forceFactor * 100;

      const parentVelocity = parent.getVelocity();

      if (this.overrideVelocity) {
        // Override velocity completely
        parentVelocity.x = this.delta.x * force;
        parentVelocity.y = this.delta.y * force;
      } else {
        // Add attraction force to existing velocity
        parentVelocity.x += this.delta.x * force * deltaTime;
        parentVelocity.y += this.delta.y * force * deltaTime;
      }
    }
  }

  /**
   * Check if the parent is within the attraction area
   */
  isWithinArea(parent: GameObject): boolean {
    if (!this.target) {
      return false;
    }

    const parentPos = parent.getPosition();
    const targetPos = this.target.getPosition();

    const dx = (targetPos.x + this.target.width / 2) - (parentPos.x + parent.width / 2);
    const dy = (targetPos.y + this.target.height / 2) - (parentPos.y + parent.height / 2);

    return (dx * dx + dy * dy) < (this.areaRadius * this.areaRadius);
  }

  /**
   * Get current distance to target
   */
  getDistanceToTarget(parent: GameObject): number {
    if (!this.target) {
      return Infinity;
    }

    const parentPos = parent.getPosition();
    const targetPos = this.target.getPosition();

    const dx = (targetPos.x + this.target.width / 2) - (parentPos.x + parent.width / 2);
    const dy = (targetPos.y + this.target.height / 2) - (parentPos.y + parent.height / 2);

    return Math.sqrt(dx * dx + dy * dy);
  }
}

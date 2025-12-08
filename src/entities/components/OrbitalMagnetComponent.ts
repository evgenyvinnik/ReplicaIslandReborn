/**
 * OrbitalMagnetComponent - Creates orbital attraction effect
 * Ported from: Original/src/com/replica/replicaisland/OrbitalMagnetComponent.java
 * 
 * This component creates an orbital magnetism effect where the target (player)
 * is pulled into an orbital path around the parent object (The Source boss).
 * 
 * The effect:
 * 1. Removes gravity influence from the target
 * 2. Calculates the closest point on the orbital ring
 * 3. Pushes the target tangentially along the orbit
 * 4. Strength is stronger when closer to the orbital radius
 */

import { GameComponent } from '../GameComponent';
import { GameObject } from '../GameObject';
import { ComponentPhase } from '../../types';
import { Vector2 } from '../../utils/Vector2';
import { GravityComponent } from './GravityComponent';
import { sSystemRegistry } from '../../engine/SystemRegistry';

export interface OrbitalMagnetConfig {
  /** Magnetic strength - higher = faster orbital speed */
  strength?: number;
  /** Radius within which the magnet is active */
  areaRadius?: number;
  /** Radius of the orbital ring (where the target will orbit) */
  magnetRadius?: number;
}

export class OrbitalMagnetComponent extends GameComponent {
  private static readonly DEFAULT_STRENGTH = 15.0;
  private static readonly DEFAULT_AREA_RADIUS = 320.0;
  private static readonly DEFAULT_MAGNET_RADIUS = 220.0;

  /** Magnetic strength */
  private strength: number = OrbitalMagnetComponent.DEFAULT_STRENGTH;
  
  /** Radius within which attraction is active */
  private areaRadius: number = OrbitalMagnetComponent.DEFAULT_AREA_RADIUS;
  
  /** Radius of the orbital ring */
  private magnetRadius: number = OrbitalMagnetComponent.DEFAULT_MAGNET_RADIUS;
  
  /** Target object to affect (usually player) */
  private target: GameObject | null = null;
  
  /** Reusable vectors for calculations */
  private center: Vector2 = new Vector2();
  private delta: Vector2 = new Vector2();
  private rim: Vector2 = new Vector2();
  private velocity: Vector2 = new Vector2();

  constructor() {
    super(ComponentPhase.COLLISION_DETECTION);
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.strength = OrbitalMagnetComponent.DEFAULT_STRENGTH;
    this.areaRadius = OrbitalMagnetComponent.DEFAULT_AREA_RADIUS;
    this.magnetRadius = OrbitalMagnetComponent.DEFAULT_MAGNET_RADIUS;
    this.target = null;
    this.center.set(0, 0);
    this.delta.set(0, 0);
    this.rim.set(0, 0);
    this.velocity.set(0, 0);
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
    if (config.magnetRadius !== undefined) {
      this.magnetRadius = config.magnetRadius;
    }
  }

  /**
   * Setup method matching original API: setup(areaRadius, orbitRadius)
   */
  setup(areaRadius: number, orbitRadius: number): void {
    this.areaRadius = areaRadius;
    this.magnetRadius = orbitRadius;
  }

  /**
   * Set the target to affect (usually player)
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
   * Set magnet (orbital) radius
   */
  setMagnetRadius(radius: number): void {
    this.magnetRadius = radius;
  }

  /**
   * Update - apply orbital magnetism to the target (player)
   * This pulls the target into an orbital path around the parent (boss)
   */
  update(deltaTime: number, parent: GameObject): void {
    // Auto-get player as target if not set
    if (!this.target) {
      const gameObjectManager = sSystemRegistry?.gameObjectManager;
      if (gameObjectManager) {
        this.target = gameObjectManager.getPlayer() || null;
      }
    }
    
    if (!this.target) {
      return;
    }

    // Calculate center of the boss
    const parentPos = parent.getPosition();
    const centerX = parentPos.x + parent.width / 2;
    const centerY = parentPos.y + parent.height / 2;
    this.center.set(centerX, centerY);

    // Calculate target (player) center position
    const targetPos = this.target.getPosition();
    const targetX = targetPos.x + this.target.width / 2;
    const targetY = targetPos.y + this.target.height / 2;
    
    // Calculate delta from boss center to target
    this.delta.set(targetX - centerX, targetY - centerY);
    
    const distanceFromCenter2 = this.delta.x * this.delta.x + this.delta.y * this.delta.y;
    const area2 = this.areaRadius * this.areaRadius;
    
    // Only apply magnetism if target is within area
    if (distanceFromCenter2 < area2) {
      const distanceFromCenter = Math.sqrt(distanceFromCenter2);
      
      // Calculate rim - the closest point on the magnet circle
      if (distanceFromCenter > 0.001) {
        this.rim.set(this.delta.x / distanceFromCenter, this.delta.y / distanceFromCenter);
      } else {
        this.rim.set(1, 0);
      }
      this.rim.x *= this.magnetRadius;
      this.rim.y *= this.magnetRadius;
      this.rim.x += centerX;
      this.rim.y += centerY;
      // rim is now the closest point on the magnet circle
      
      // Get target velocity
      const targetVelocity = this.target.getVelocity();
      
      // Try to remove gravity influence from target
      const gravity = this.target.getComponent(GravityComponent as unknown as new (...args: unknown[]) => GravityComponent);
      if (gravity) {
        const gravityVec = gravity.getGravity();
        this.velocity.set(gravityVec.x * deltaTime, gravityVec.y * deltaTime);
        targetVelocity.x -= this.velocity.x;
        targetVelocity.y -= this.velocity.y;
      }
      
      // Calculate the next point on the magnet circle in the direction of movement
      this.delta.set(
        targetX + targetVelocity.x - centerX,
        targetY + targetVelocity.y - centerY
      );
      const deltaLen = Math.sqrt(this.delta.x * this.delta.x + this.delta.y * this.delta.y);
      if (deltaLen > 0.001) {
        this.delta.x /= deltaLen;
        this.delta.y /= deltaLen;
      }
      this.delta.x *= this.magnetRadius;
      this.delta.y *= this.magnetRadius;
      this.delta.x += centerX;
      this.delta.y += centerY;
      
      // mDelta is now the next point on the magnet circle in the direction of movement
      this.delta.x -= this.rim.x;
      this.delta.y -= this.rim.y;
      
      // Normalize to get tangent direction
      const tangentLen = Math.sqrt(this.delta.x * this.delta.x + this.delta.y * this.delta.y);
      if (tangentLen > 0.001) {
        this.delta.x /= tangentLen;
        this.delta.y /= tangentLen;
      }
      // Now mDelta is the tangent to the magnet circle, pointing in the direction of movement
      
      // Calculate push velocity
      this.velocity.set(this.delta.x, this.delta.y);
      this.velocity.x *= this.strength;
      this.velocity.y *= this.strength;
      
      // Weight the effect based on distance from the orbital ring
      let weight = 1.0;
      if (distanceFromCenter2 > this.magnetRadius * this.magnetRadius) {
        const distance = distanceFromCenter;
        weight = (distance - this.magnetRadius) / (this.areaRadius - this.magnetRadius);
        weight = 1.0 - weight;
        this.velocity.x *= weight;
        this.velocity.y *= weight;
      }
      
      // Apply velocity while maintaining speed
      const speed = Math.sqrt(targetVelocity.x * targetVelocity.x + targetVelocity.y * targetVelocity.y);
      targetVelocity.x += this.velocity.x;
      targetVelocity.y += this.velocity.y;
      
      // Maintain original speed
      const newSpeed = Math.sqrt(targetVelocity.x * targetVelocity.x + targetVelocity.y * targetVelocity.y);
      if (newSpeed > speed && speed > 0.001) {
        targetVelocity.x = (targetVelocity.x / newSpeed) * speed;
        targetVelocity.y = (targetVelocity.y / newSpeed) * speed;
      }
    }
  }

  /**
   * Check if the target is within the attraction area
   */
  isWithinArea(parent: GameObject): boolean {
    if (!this.target) {
      return false;
    }

    const parentPos = parent.getPosition();
    const targetPos = this.target.getPosition();

    const dx = (parentPos.x + parent.width / 2) - (targetPos.x + this.target.width / 2);
    const dy = (parentPos.y + parent.height / 2) - (targetPos.y + this.target.height / 2);

    return (dx * dx + dy * dy) < (this.areaRadius * this.areaRadius);
  }

  /**
   * Get current distance from target to boss center
   */
  getDistanceToTarget(parent: GameObject): number {
    if (!this.target) {
      return Infinity;
    }

    const parentPos = parent.getPosition();
    const targetPos = this.target.getPosition();

    const dx = (parentPos.x + parent.width / 2) - (targetPos.x + this.target.width / 2);
    const dy = (parentPos.y + parent.height / 2) - (targetPos.y + this.target.height / 2);

    return Math.sqrt(dx * dx + dy * dy);
  }
}

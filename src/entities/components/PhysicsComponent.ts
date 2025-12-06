/**
 * Physics Component - Handles physics and movement
 * Ported from: Original/src/com/replica/replicaisland/PhysicsComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';

export class PhysicsComponent extends GameComponent {
  // Physics constants
  private gravity: number = 1000;
  private maxVelocityX: number = 300;
  private maxVelocityY: number = 600;
  private friction: number = 0.9;
  private airFriction: number = 0.98;
  private bounciness: number = 0;

  // Flags
  private useGravity: boolean = true;
  private isGrounded: boolean = false;

  constructor() {
    super(ComponentPhase.PHYSICS);
  }

  /**
   * Set gravity
   */
  setGravity(gravity: number): void {
    this.gravity = gravity;
  }

  /**
   * Set max velocities
   */
  setMaxVelocity(x: number, y: number): void {
    this.maxVelocityX = x;
    this.maxVelocityY = y;
  }

  /**
   * Set friction
   */
  setFriction(friction: number): void {
    this.friction = friction;
  }

  /**
   * Set air friction
   */
  setAirFriction(friction: number): void {
    this.airFriction = friction;
  }

  /**
   * Enable/disable gravity
   */
  setUseGravity(use: boolean): void {
    this.useGravity = use;
  }

  /**
   * Set bounciness (0-1)
   */
  setBounciness(bounce: number): void {
    this.bounciness = Math.max(0, Math.min(1, bounce));
  }

  /**
   * Check if grounded
   */
  getIsGrounded(): boolean {
    return this.isGrounded;
  }

  /**
   * Update physics
   */
  update(deltaTime: number, parent: GameObject): void {
    const velocity = parent.getVelocity();
    const acceleration = parent.getAcceleration();
    const impulse = parent.getImpulse();
    const targetVelocity = parent.getTargetVelocity();

    // Apply impulse
    velocity.x += impulse.x;
    velocity.y += impulse.y;
    impulse.zero();

    // Apply gravity
    if (this.useGravity) {
      acceleration.y = this.gravity;
    }

    // Integrate acceleration
    velocity.x += acceleration.x * deltaTime;
    velocity.y += acceleration.y * deltaTime;

    // Apply target velocity interpolation (for smooth movement)
    if (targetVelocity.x !== 0 || targetVelocity.y !== 0) {
      const lerpFactor = 10 * deltaTime;
      velocity.x += (targetVelocity.x - velocity.x) * lerpFactor;
    }

    // Check grounded state
    this.isGrounded = parent.touchingGround();

    // Apply friction
    const currentFriction = this.isGrounded ? this.friction : this.airFriction;
    
    // Only apply friction when not actively trying to move
    if (Math.abs(targetVelocity.x) < 0.1) {
      velocity.x *= currentFriction;
      
      // Stop tiny velocities
      if (Math.abs(velocity.x) < 1) {
        velocity.x = 0;
      }
    }

    // Clamp velocity
    velocity.x = Math.max(-this.maxVelocityX, Math.min(this.maxVelocityX, velocity.x));
    velocity.y = Math.max(-this.maxVelocityY, Math.min(this.maxVelocityY, velocity.y));
  }

  /**
   * Handle collision response
   */
  onCollision(parent: GameObject, normalX: number, normalY: number): void {
    const velocity = parent.getVelocity();

    // Reflect velocity based on collision normal
    if (normalX !== 0) {
      velocity.x = -velocity.x * this.bounciness;
    }
    if (normalY !== 0) {
      velocity.y = -velocity.y * this.bounciness;
    }
  }

  /**
   * Reset component
   */
  reset(): void {
    this.isGrounded = false;
  }
}

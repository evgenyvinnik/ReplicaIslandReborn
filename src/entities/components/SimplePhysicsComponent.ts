/**
 * SimplePhysicsComponent - Simplified physics for projectiles and simple objects
 * Ported from: Original/src/com/replica/replicaisland/SimplePhysicsComponent.java
 * 
 * This component handles basic bounce physics for objects that don't need
 * full player-style physics. Useful for:
 * - Projectiles that bounce off walls
 * - Debris/particles
 * - Simple physics objects
 */

import { GameComponent } from '../GameComponent';
import { GameObject } from '../GameObject';
import { ComponentPhase } from '../../types';

export interface SimplePhysicsConfig {
  /** How bouncy the object is (0.0 = no bounce, 1.0 = perfect bounce) */
  bounciness?: number;
  /** Gravity to apply (pixels/second^2) */
  gravity?: number;
  /** Apply friction when touching ground */
  friction?: number;
  /** Maximum velocity */
  maxVelocity?: number;
  /** Velocity threshold below which to consider stopped */
  velocityThreshold?: number;
}

export class SimplePhysicsComponent extends GameComponent {
  private static readonly DEFAULT_BOUNCINESS = 0.1;
  private static readonly DEFAULT_GRAVITY = 0;
  private static readonly DEFAULT_FRICTION = 1.0;
  private static readonly DEFAULT_MAX_VELOCITY = 1000;
  private static readonly VELOCITY_THRESHOLD = 0.1;

  /** Bounciness coefficient */
  private bounciness: number = SimplePhysicsComponent.DEFAULT_BOUNCINESS;
  
  /** Gravity in pixels/second^2 */
  private gravity: number = SimplePhysicsComponent.DEFAULT_GRAVITY;
  
  /** Friction coefficient (1.0 = no friction) */
  private friction: number = SimplePhysicsComponent.DEFAULT_FRICTION;
  
  /** Maximum velocity */
  private maxVelocity: number = SimplePhysicsComponent.DEFAULT_MAX_VELOCITY;
  
  /** Velocity threshold for "stopped" state */
  private velocityThreshold: number = SimplePhysicsComponent.VELOCITY_THRESHOLD;
  
  /** Collision state flags */
  private touchingGround: boolean = false;
  private touchingCeiling: boolean = false;
  private touchingLeftWall: boolean = false;
  private touchingRightWall: boolean = false;

  constructor() {
    super(ComponentPhase.POST_PHYSICS);
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.bounciness = SimplePhysicsComponent.DEFAULT_BOUNCINESS;
    this.gravity = SimplePhysicsComponent.DEFAULT_GRAVITY;
    this.friction = SimplePhysicsComponent.DEFAULT_FRICTION;
    this.maxVelocity = SimplePhysicsComponent.DEFAULT_MAX_VELOCITY;
    this.velocityThreshold = SimplePhysicsComponent.VELOCITY_THRESHOLD;
    this.touchingGround = false;
    this.touchingCeiling = false;
    this.touchingLeftWall = false;
    this.touchingRightWall = false;
  }

  /**
   * Configure the physics
   */
  setConfig(config: SimplePhysicsConfig): void {
    if (config.bounciness !== undefined) {
      this.bounciness = config.bounciness;
    }
    if (config.gravity !== undefined) {
      this.gravity = config.gravity;
    }
    if (config.friction !== undefined) {
      this.friction = config.friction;
    }
    if (config.maxVelocity !== undefined) {
      this.maxVelocity = config.maxVelocity;
    }
    if (config.velocityThreshold !== undefined) {
      this.velocityThreshold = config.velocityThreshold;
    }
  }

  /**
   * Set bounciness
   */
  setBounciness(bounciness: number): void {
    this.bounciness = Math.max(0, Math.min(1, bounciness));
  }

  /**
   * Set gravity
   */
  setGravity(gravity: number): void {
    this.gravity = gravity;
  }

  /**
   * Set collision state - should be called by collision system
   */
  setCollisionState(
    ground: boolean,
    ceiling: boolean,
    leftWall: boolean,
    rightWall: boolean
  ): void {
    this.touchingGround = ground;
    this.touchingCeiling = ceiling;
    this.touchingLeftWall = leftWall;
    this.touchingRightWall = rightWall;
  }

  /**
   * Update physics
   */
  update(deltaTime: number, parent: GameObject): void {
    const velocity = parent.getVelocity();
    
    // Apply gravity
    if (this.gravity !== 0) {
      velocity.y += this.gravity * deltaTime;
    }

    // Handle ceiling/ground bounce
    if ((this.touchingCeiling && velocity.y > 0) ||
        (this.touchingGround && velocity.y < 0)) {
      velocity.y = -velocity.y * this.bounciness;
      
      if (Math.abs(velocity.y) < this.velocityThreshold) {
        velocity.y = 0;
      }
    }

    // Handle wall bounce
    if ((this.touchingRightWall && velocity.x > 0) ||
        (this.touchingLeftWall && velocity.x < 0)) {
      velocity.x = -velocity.x * this.bounciness;
      
      if (Math.abs(velocity.x) < this.velocityThreshold) {
        velocity.x = 0;
      }
    }

    // Apply friction when on ground
    if (this.touchingGround && this.friction < 1.0) {
      velocity.x *= this.friction;
      
      if (Math.abs(velocity.x) < this.velocityThreshold) {
        velocity.x = 0;
      }
    }

    // Clamp velocity
    if (this.maxVelocity > 0) {
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > this.maxVelocity) {
        const scale = this.maxVelocity / speed;
        velocity.x *= scale;
        velocity.y *= scale;
      }
    }

    // Update position
    const position = parent.getPosition();
    position.x += velocity.x * deltaTime;
    position.y += velocity.y * deltaTime;
  }

  /**
   * Check if the object is essentially at rest
   */
  isAtRest(): boolean {
    return this.touchingGround &&
           Math.abs(this.parent?.getVelocity().x ?? 0) < this.velocityThreshold &&
           Math.abs(this.parent?.getVelocity().y ?? 0) < this.velocityThreshold;
  }

  /**
   * Get collision state
   */
  isTouchingGround(): boolean {
    return this.touchingGround;
  }

  isTouchingCeiling(): boolean {
    return this.touchingCeiling;
  }

  isTouchingLeftWall(): boolean {
    return this.touchingLeftWall;
  }

  isTouchingRightWall(): boolean {
    return this.touchingRightWall;
  }
}

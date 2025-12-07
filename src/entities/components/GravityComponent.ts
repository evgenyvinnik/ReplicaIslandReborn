/**
 * Gravity Component - Applies gravity force to game objects
 * Ported from: Original/src/com/replica/replicaisland/GravityComponent.java
 *
 * A game component that implements gravity. Adding this component to a game object
 * will cause it to be pulled down towards the ground (or in any custom direction).
 *
 * Features:
 * - Default downward gravity (-400 units/sec²)
 * - Configurable gravity vector (any direction)
 * - Gravity multiplier for different weight effects
 * - Custom gravity zones (e.g., underwater, space, reversed)
 *
 * Physics Phase: This component runs in the PHYSICS phase to apply
 * gravity before movement calculations.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import { Vector2 } from '../../utils/Vector2';

// Default gravity: 400 units/sec² downward (positive Y is down in screen coords)
const DEFAULT_GRAVITY_X = 0;
const DEFAULT_GRAVITY_Y = 400; // Positive = down in typical game coordinates

export interface GravityConfig {
  /** Gravity X component (default: 0) */
  gravityX: number;
  /** Gravity Y component (default: 400, positive = down) */
  gravityY: number;
  /** Gravity multiplier (default: 1.0) */
  multiplier: number;
}

const DEFAULT_CONFIG: GravityConfig = {
  gravityX: DEFAULT_GRAVITY_X,
  gravityY: DEFAULT_GRAVITY_Y,
  multiplier: 1.0,
};

export class GravityComponent extends GameComponent {
  private gravity: Vector2;
  private scaledGravity: Vector2;
  private multiplier: number;

  constructor(config?: Partial<GravityConfig>) {
    super(ComponentPhase.PHYSICS);

    const cfg = { ...DEFAULT_CONFIG, ...config };
    this.gravity = new Vector2(cfg.gravityX, cfg.gravityY);
    this.scaledGravity = new Vector2();
    this.multiplier = cfg.multiplier;

    // Apply initial multiplier
    if (this.multiplier !== 1.0) {
      this.gravity.multiply(this.multiplier);
    }
  }

  /**
   * Update - apply gravity to velocity
   */
  update(deltaTime: number, parent: GameObject): void {
    // Scale gravity by delta time
    this.scaledGravity.set(this.gravity);
    this.scaledGravity.multiply(deltaTime);

    // Add to velocity
    const velocity = parent.getVelocity();
    velocity.x += this.scaledGravity.x;
    velocity.y += this.scaledGravity.y;
  }

  /**
   * Get current gravity vector
   */
  getGravity(): Vector2 {
    return this.gravity;
  }

  /**
   * Set gravity directly
   */
  setGravity(x: number, y: number): void {
    this.gravity.set(x, y);
  }

  /**
   * Set gravity multiplier
   * Multiplies the default gravity by the given factor
   */
  setGravityMultiplier(multiplier: number): void {
    this.multiplier = multiplier;
    this.gravity.set(DEFAULT_GRAVITY_X, DEFAULT_GRAVITY_Y);
    this.gravity.multiply(multiplier);
  }

  /**
   * Get current multiplier
   */
  getMultiplier(): number {
    return this.multiplier;
  }

  /**
   * Reset to default gravity
   */
  reset(): void {
    this.gravity.set(DEFAULT_GRAVITY_X, DEFAULT_GRAVITY_Y);
    this.multiplier = 1.0;
  }
}

/**
 * Generic Animation Component - General-purpose animation state selector
 * Ported from: Original/src/com/replica/replicaisland/GenericAnimationComponent.java
 *
 * Maps game object action types to animation indices and plays the appropriate
 * animation on the attached SpriteComponent.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import type { SpriteComponent } from './SpriteComponent';
import { sign } from '../../utils/helpers';

/**
 * Animation indices for generic objects
 * These map to indices in the SpriteComponent's animation array
 */
export enum GenericAnimation {
  IDLE = 0,
  MOVE = 1,
  ATTACK = 2,
  HIT_REACT = 3,
  DEATH = 4,
  HIDE = 5,
  FROZEN = 6,
}

/**
 * Generic Animation Component
 * Selects animations based on the parent object's current action
 */
export class GenericAnimationComponent extends GameComponent {
  private sprite: SpriteComponent | null = null;

  constructor() {
    super(ComponentPhase.ANIMATION);
  }

  /**
   * Reset the component
   */
  reset(): void {
    this.sprite = null;
  }

  /**
   * Update - select and play the appropriate animation
   */
  update(_deltaTime: number, parent: GameObject): void {
    if (!this.sprite) {
      return;
    }

    // Update facing direction based on velocity
    const velocity = parent.getVelocity();
    if (parent.facingDirection.x !== 0 && velocity.x !== 0) {
      parent.facingDirection.x = sign(velocity.x);
    }

    // Select animation based on current action
    switch (parent.getCurrentAction()) {
      case ActionType.IDLE:
        this.sprite.playAnimation(GenericAnimation.IDLE);
        break;
      case ActionType.MOVE:
        this.sprite.playAnimation(GenericAnimation.MOVE);
        break;
      case ActionType.ATTACK:
        this.sprite.playAnimation(GenericAnimation.ATTACK);
        break;
      case ActionType.HIT_REACT:
        this.sprite.playAnimation(GenericAnimation.HIT_REACT);
        break;
      case ActionType.DEATH:
        this.sprite.playAnimation(GenericAnimation.DEATH);
        break;
      case ActionType.HIDE:
        this.sprite.playAnimation(GenericAnimation.HIDE);
        break;
      case ActionType.FROZEN:
        this.sprite.playAnimation(GenericAnimation.FROZEN);
        break;
      case ActionType.INVALID:
      default:
        this.sprite.playAnimation(-1);
        break;
    }
  }

  /**
   * Set the sprite component to control
   */
  setSprite(sprite: SpriteComponent): void {
    this.sprite = sprite;
  }

  /**
   * Get the current sprite component
   */
  getSprite(): SpriteComponent | null {
    return this.sprite;
  }
}

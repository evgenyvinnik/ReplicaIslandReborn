/**
 * Enemy Animation Component - Animation state machine for enemy characters
 * Ported from: Original/src/com/replica/replicaisland/EnemyAnimationComponent.java
 *
 * A general-purpose animation selection system for animating enemy characters.
 * Most enemy characters behave similarly, so this code tries to decide which
 * animation best fits their current state. Other code (such as enemy AI) may
 * move these characters around and change the current ActionType, which will
 * result in this code figuring out which sequence of animations is best to play.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import type { SpriteComponent } from './SpriteComponent';
import type { GameObjectManager } from '../GameObjectManager';
import { close } from '../../utils/helpers';

/**
 * Animation indices for enemies
 */
export enum EnemyAnimation {
  IDLE = 0,
  MOVE = 1,
  ATTACK = 2,
  HIDDEN = 3,
  APPEAR = 4,
}

/**
 * Internal animation state machine states
 */
enum AnimationState {
  IDLING,
  MOVING,
  HIDING,
  APPEARING,
  ATTACKING,
}

/**
 * Enemy Animation Component
 * Handles enemy-specific animation state transitions
 */
export class EnemyAnimationComponent extends GameComponent {
  private sprite: SpriteComponent | null = null;
  private state: AnimationState = AnimationState.IDLING;
  private facePlayer: boolean = false;
  private gameObjectManager: GameObjectManager | null = null;

  constructor() {
    super(ComponentPhase.ANIMATION);
  }

  /**
   * Reset the component
   */
  reset(): void {
    this.state = AnimationState.IDLING;
    this.facePlayer = false;
    this.sprite = null;
  }

  /**
   * Set game object manager reference
   */
  setGameObjectManager(manager: GameObjectManager): void {
    this.gameObjectManager = manager;
  }

  /**
   * Update - handle animation state machine
   */
  update(_deltaTime: number, parent: GameObject): void {
    if (!this.sprite) {
      return;
    }

    const velocityX = parent.getVelocity().x;
    const currentAction = parent.getCurrentAction();

    switch (this.state) {
      case AnimationState.IDLING:
        this.sprite.playAnimation(EnemyAnimation.IDLE);
        
        if (this.facePlayer) {
          this.facePlayerDirection(parent);
        }

        if (currentAction === ActionType.ATTACK) {
          this.state = AnimationState.ATTACKING;
        } else if (currentAction === ActionType.HIDE) {
          this.state = AnimationState.HIDING;
        } else if (Math.abs(velocityX) > 0) {
          this.state = AnimationState.MOVING;
        }
        break;

      case AnimationState.MOVING: {
        this.sprite.playAnimation(EnemyAnimation.MOVE);
        
        const targetVelocityX = parent.getTargetVelocity().x;
        
        if (!close(velocityX, 0, 0.01)) {
          if (velocityX < 0 && targetVelocityX < 0) {
            parent.facingDirection.x = -1;
          } else if (velocityX > 0 && targetVelocityX > 0) {
            parent.facingDirection.x = 1;
          }
        }

        if (currentAction === ActionType.ATTACK) {
          this.state = AnimationState.ATTACKING;
        } else if (currentAction === ActionType.HIDE) {
          this.state = AnimationState.HIDING;
        } else if (Math.abs(velocityX) === 0) {
          this.state = AnimationState.IDLING;
        }
        break;
      }

      case AnimationState.ATTACKING:
        this.sprite.playAnimation(EnemyAnimation.ATTACK);
        
        if (currentAction !== ActionType.ATTACK && this.sprite.animationFinished()) {
          this.state = AnimationState.IDLING;
        }
        break;

      case AnimationState.HIDING:
        this.sprite.playAnimation(EnemyAnimation.HIDDEN);
        
        if (currentAction !== ActionType.HIDE) {
          this.state = AnimationState.APPEARING;
        }
        break;

      case AnimationState.APPEARING:
        if (this.facePlayer) {
          this.facePlayerDirection(parent);
        }
        
        this.sprite.playAnimation(EnemyAnimation.APPEAR);
        
        if (this.sprite.animationFinished()) {
          this.state = AnimationState.IDLING;
        }
        break;
    }
  }

  /**
   * Turn to face the player
   */
  private facePlayerDirection(parent: GameObject): void {
    if (!this.gameObjectManager) {
      return;
    }

    const player = this.gameObjectManager.getPlayer();
    if (player) {
      if (player.getPosition().x < parent.getPosition().x) {
        parent.facingDirection.x = -1;
      } else {
        parent.facingDirection.x = 1;
      }
    }
  }

  /**
   * Set the sprite component to control
   */
  setSprite(sprite: SpriteComponent): void {
    this.sprite = sprite;
  }

  /**
   * Set whether to face the player
   */
  setFacePlayer(facePlayer: boolean): void {
    this.facePlayer = facePlayer;
  }

  /**
   * Get current animation state
   */
  getAnimationState(): AnimationState {
    return this.state;
  }

  /**
   * Force a specific animation state
   */
  setAnimationState(state: AnimationState): void {
    this.state = state;
  }
}

// Re-export AnimationState for external use
export { AnimationState as EnemyAnimationState };

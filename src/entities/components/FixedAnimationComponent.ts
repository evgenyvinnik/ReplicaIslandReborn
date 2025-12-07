/**
 * FixedAnimationComponent - Plays a fixed animation continuously
 * Ported from: Original/src/com/replica/replicaisland/FixedAnimationComponent.java
 * 
 * This component ensures that a specific animation index is always playing
 * on the parent's sprite component. Useful for:
 * - Decorative animated objects (flames, waterfalls)
 * - Objects with only one animation state
 * - Forcing a specific animation on spawn
 */

import { GameComponent } from '../GameComponent';
import { GameObject } from '../GameObject';
import { ComponentPhase } from '../../types';
import { SpriteComponent } from './SpriteComponent';

export class FixedAnimationComponent extends GameComponent {
  /** Animation name to play */
  private animationName: string = 'idle';
  
  /** Whether we've already started the animation */
  private started: boolean = false;

  constructor() {
    super(ComponentPhase.ANIMATION);
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.animationName = 'idle';
    this.started = false;
  }

  /**
   * Set the animation to play
   * @param name Animation name (e.g., 'idle', 'walk', etc.)
   */
  setAnimation(name: string): void {
    this.animationName = name;
    this.started = false; // Force restart on next update
  }

  /**
   * Update - ensure the animation is playing
   */
  update(_deltaTime: number, parent: GameObject): void {
    // Find sprite component each frame to support shared components
    const sprite = parent.getComponent(SpriteComponent);
    
    if (sprite) {
      // Only set animation if we haven't started yet
      // (SpriteComponent handles loop internally)
      if (!this.started) {
        sprite.playAnimation(this.animationName);
        this.started = true;
      }
    }
  }

  /**
   * Get the current animation name
   */
  getAnimationName(): string {
    return this.animationName;
  }
}

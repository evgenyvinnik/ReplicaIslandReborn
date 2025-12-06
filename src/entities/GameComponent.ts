/**
 * Game Component - Base class for all game object behaviors
 * Ported from: Original/src/com/replica/replicaisland/GameComponent.java
 */

import { ComponentPhase } from '../types';
import type { GameObject } from './GameObject';

/**
 * Base class for all components that can be attached to game objects
 */
export abstract class GameComponent {
  protected phase: ComponentPhase;
  protected parent: GameObject | null = null;
  public shared: boolean = false;

  constructor(phase: ComponentPhase = ComponentPhase.THINK) {
    this.phase = phase;
  }

  /**
   * Get the component's update phase
   */
  getPhase(): ComponentPhase {
    return this.phase;
  }

  /**
   * Set the component's update phase
   */
  protected setPhase(phase: ComponentPhase): void {
    this.phase = phase;
  }

  /**
   * Set the parent game object
   */
  setParent(parent: GameObject | null): void {
    this.parent = parent;
  }

  /**
   * Get the parent game object
   */
  getParent(): GameObject | null {
    return this.parent;
  }

  /**
   * Update the component
   */
  abstract update(deltaTime: number, parent: GameObject): void;

  /**
   * Reset the component to initial state
   */
  abstract reset(): void;
}

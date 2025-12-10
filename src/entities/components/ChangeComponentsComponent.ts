/**
 * ChangeComponentsComponent - Swaps components in and out for different behavior modes
 * Ported from: Original/src/com/replica/replicaisland/ChangeComponentsComponent.java
 *
 * A game component that can swap other components in and out of its parent game object.
 * The purpose is to allow game objects to have different "modes" defined by different
 * combinations of GameComponents. This component manages the switching in and out of
 * those modes by activating and deactivating specific game components.
 *
 * Usage examples:
 * - Player invincibility mode (swap in different animation/render components)
 * - Boss phase transitions
 * - CrusherAndou attack mode switching
 */

import { GameComponent } from '../GameComponent';
import type { GameObject } from '../GameObject';
import { ComponentPhase, ActionType } from '../../types';

const MAX_COMPONENT_SWAPS = 16;

export interface ChangeComponentsConfig {
  pingPong?: boolean;
  swapOnAction?: ActionType;
}

export class ChangeComponentsComponent extends GameComponent {
  private componentsToInsert: GameComponent[] = [];
  private componentsToRemove: GameComponent[] = [];
  private pingPong: boolean = false;
  private activated: boolean = false;
  private currentlySwapped: boolean = false;
  private swapOnAction: ActionType = ActionType.INVALID;
  private lastAction: ActionType = ActionType.INVALID;

  constructor(config?: ChangeComponentsConfig) {
    super(ComponentPhase.THINK);

    if (config) {
      this.pingPong = config.pingPong ?? false;
      this.swapOnAction = config.swapOnAction ?? ActionType.INVALID;
    }
  }

  /**
   * Add a component that will be inserted when activated
   */
  addSwapInComponent(component: GameComponent): void {
    if (this.componentsToInsert.length < MAX_COMPONENT_SWAPS) {
      this.componentsToInsert.push(component);
    } else {
      // console.log('ChangeComponentsComponent: Max swap-in components reached');
    }
  }

  /**
   * Add a component that will be removed when activated
   */
  addSwapOutComponent(component: GameComponent): void {
    if (this.componentsToRemove.length < MAX_COMPONENT_SWAPS) {
      this.componentsToRemove.push(component);
    } else {
      // console.log('ChangeComponentsComponent: Max swap-out components reached');
    }
  }

  /**
   * Set ping-pong behavior (swap back and forth on each activation)
   */
  setPingPongBehavior(pingPong: boolean): void {
    this.pingPong = pingPong;
  }

  /**
   * Set the action type that triggers a swap
   */
  setSwapAction(action: ActionType): void {
    this.swapOnAction = action;
  }

  /**
   * Check if currently in swapped state
   */
  getCurrentlySwapped(): boolean {
    return this.currentlySwapped;
  }

  /**
   * Check if has been activated at least once
   */
  hasBeenActivated(): boolean {
    return this.activated;
  }

  /**
   * Activate the swap - inserts and removes components from the parent
   * Unless pingPong is set, this may only be called once.
   */
  activate(parent: GameObject): void {
    if (!this.activated || this.pingPong) {
      // Remove components first
      for (const component of this.componentsToRemove) {
        parent.removeComponent(component);
      }

      // Then add new components
      for (const component of this.componentsToInsert) {
        parent.addComponent(component);
      }

      this.activated = true;
      this.currentlySwapped = !this.currentlySwapped;

      // If ping-pong is enabled, swap the arrays for next activation
      if (this.pingPong) {
        const temp = this.componentsToInsert;
        this.componentsToInsert = this.componentsToRemove;
        this.componentsToRemove = temp;
      }
    }
  }

  /**
   * Update - check for action-triggered swap
   */
  update(_deltaTime: number, parent: GameObject): void {
    if (this.swapOnAction !== ActionType.INVALID) {
      const currentAction = parent.getCurrentAction();

      if (currentAction !== this.lastAction) {
        this.lastAction = currentAction;

        if (currentAction === this.swapOnAction) {
          this.activate(parent);
        }
      }
    }
  }

  /**
   * Reset component state
   * Note: In the original, this handles releasing non-shared components back to the factory.
   * Since we use JS garbage collection, we simply clear the arrays.
   */
  reset(): void {
    // Clear component lists
    this.componentsToInsert = [];
    this.componentsToRemove = [];
    this.pingPong = false;
    this.activated = false;
    this.currentlySwapped = false;
    this.swapOnAction = ActionType.INVALID;
    this.lastAction = ActionType.INVALID;
  }
}

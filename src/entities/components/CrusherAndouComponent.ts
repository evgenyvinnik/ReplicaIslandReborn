/**
 * CrusherAndouComponent - Boss stomp attack controller
 * Ported from: Original/src/com/replica/replicaisland/CrusherAndouComponent.java
 *
 * This component controls the "Crusher Andou" boss character.
 * When the player taps/clicks, the boss performs a stomp attack.
 * It uses ChangeComponentsComponent to swap between idle and attack modes.
 */

import { GameComponent } from '../GameComponent';
import type { GameObject } from '../GameObject';
import { ComponentPhase, ActionType } from '../../types';
import type { ChangeComponentsComponent } from './ChangeComponentsComponent';

// System registry references
let inputSystem: { isTouchTriggered(): boolean } | null = null;

/**
 * Set system registry for CrusherAndouComponent
 */
export function setCrusherAndouSystemRegistry(
  input: { isTouchTriggered(): boolean } | null
): void {
  inputSystem = input;
}

export class CrusherAndouComponent extends GameComponent {
  private swapComponent: ChangeComponentsComponent | null = null;

  constructor() {
    super(ComponentPhase.THINK);
  }

  /**
   * Set the ChangeComponentsComponent for mode switching
   */
  setSwap(swap: ChangeComponentsComponent): void {
    this.swapComponent = swap;
  }

  /**
   * Update - check for touch input and handle state transitions
   */
  update(_deltaTime: number, parent: GameObject): void {
    if (!this.swapComponent) {
      return;
    }

    if (this.swapComponent.getCurrentlySwapped()) {
      // Currently in attack/falling mode
      // When we hit the ground, return to idle
      if (parent.touchingGround()) {
        parent.setCurrentAction(ActionType.IDLE);
      }
    } else {
      // Currently in idle mode
      // Check for touch/click input to trigger attack
      if (inputSystem?.isTouchTriggered()) {
        parent.setCurrentAction(ActionType.ATTACK);
        this.swapComponent.activate(parent);
      }
    }
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.swapComponent = null;
  }
}

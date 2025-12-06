/**
 * PopOutComponent - Implements "pop-out" enemy AI behavior
 * Ported from: Original/src/com/replica/replicaisland/PopOutComponent.java
 *
 * Pop-out enemies alternate between hiding and appearing based on their
 * distance from the player. They do not move but may attack at close range.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { Vector2 } from '../../utils/Vector2';

/**
 * Pop-out states
 */
const enum PopOutState {
  HIDDEN = 0,
  VISIBLE = 1,
  ATTACKING = 2,
}

const DEFAULT_APPEAR_DISTANCE = 120;
const DEFAULT_HIDE_DISTANCE = 190;
const DEFAULT_ATTACK_DISTANCE = 0; // No attacking by default

export interface PopOutConfig {
  appearDistance?: number;
  hideDistance?: number;
  attackDistance?: number;
  attackDelay?: number;
  attackLength?: number;
}

export class PopOutComponent extends GameComponent {
  private appearDistance: number = DEFAULT_APPEAR_DISTANCE;
  private hideDistance: number = DEFAULT_HIDE_DISTANCE;
  private attackDistance: number = DEFAULT_ATTACK_DISTANCE;
  private attackDelay: number = 0;
  private attackLength: number = 0;
  private attackStartTime: number = 0;
  private distance: Vector2 = new Vector2();
  private state: PopOutState = PopOutState.HIDDEN;
  private lastAttackCompletedTime: number = 0;

  constructor(config?: PopOutConfig) {
    super(ComponentPhase.THINK);

    if (config) {
      if (config.appearDistance !== undefined) this.appearDistance = config.appearDistance;
      if (config.hideDistance !== undefined) this.hideDistance = config.hideDistance;
      if (config.attackDistance !== undefined) this.attackDistance = config.attackDistance;
      if (config.attackDelay !== undefined) this.attackDelay = config.attackDelay;
      if (config.attackLength !== undefined) this.attackLength = config.attackLength;
    }
  }

  override reset(): void {
    this.attackDelay = 0;
    this.attackLength = 0;
    this.attackDistance = DEFAULT_ATTACK_DISTANCE;
    this.appearDistance = DEFAULT_APPEAR_DISTANCE;
    this.hideDistance = DEFAULT_HIDE_DISTANCE;
    this.state = PopOutState.HIDDEN;
    this.lastAttackCompletedTime = 0;
    this.attackStartTime = 0;
  }

  override update(_timeDelta: number, parent: object): void {
    const parentObject = parent as GameObject;

    const manager = sSystemRegistry.gameObjectManager;
    if (!manager) return;

    const player = manager.getPlayer();
    if (!player) return;

    // Calculate distance to player
    this.distance.set(player.getPosition());
    this.distance.subtract(parentObject.getPosition());

    const time = sSystemRegistry.timeSystem;
    if (!time) return;

    const currentTime = time.getGameTime();
    const distanceSquared = this.distance.lengthSquared();

    switch (this.state) {
      case PopOutState.HIDDEN: {
        parentObject.setCurrentAction(ActionType.HIDE);
        if (distanceSquared < this.appearDistance * this.appearDistance) {
          this.state = PopOutState.VISIBLE;
          this.lastAttackCompletedTime = currentTime;
        }
        break;
      }

      case PopOutState.VISIBLE: {
        parentObject.setCurrentAction(ActionType.IDLE);
        if (distanceSquared > this.hideDistance * this.hideDistance) {
          this.state = PopOutState.HIDDEN;
        } else if (
          this.attackDistance > 0 &&
          distanceSquared < this.attackDistance * this.attackDistance &&
          currentTime > this.lastAttackCompletedTime + this.attackDelay
        ) {
          this.attackStartTime = currentTime;
          this.state = PopOutState.ATTACKING;
        }
        break;
      }

      case PopOutState.ATTACKING: {
        parentObject.setCurrentAction(ActionType.ATTACK);
        if (currentTime > this.attackStartTime + this.attackLength) {
          this.state = PopOutState.VISIBLE;
          this.lastAttackCompletedTime = currentTime;
        }
        break;
      }
    }
  }

  /**
   * Setup attack parameters
   */
  setupAttack(distance: number, delay: number, duration: number): void {
    this.attackDistance = distance;
    this.attackDelay = delay;
    this.attackLength = duration;
  }

  setAppearDistance(distance: number): void {
    this.appearDistance = distance;
  }

  setHideDistance(distance: number): void {
    this.hideDistance = distance;
  }
}

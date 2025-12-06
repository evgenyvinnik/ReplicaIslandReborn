/**
 * SleeperComponent - Implements sleeping/waking enemy AI behavior
 * Ported from: Original/src/com/replica/replicaisland/SleeperComponent.java
 *
 * Sleeper enemies wake up when the camera shakes (from stomps or explosions),
 * then attack after a delay.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import { sSystemRegistry } from '../../engine/SystemRegistry';

/**
 * Sleeper states
 */
const enum SleeperState {
  SLEEPING = 0,
  WAKING = 1,
  ATTACKING = 2,
  SLAM = 3,
}

const DEFAULT_WAKE_UP_DURATION = 3.0;

export interface SleeperConfig {
  wakeUpDuration?: number;
  slamDuration?: number;
  slamMagnitude?: number;
  attackImpulseX?: number;
  attackImpulseY?: number;
}

export class SleeperComponent extends GameComponent {
  private wakeUpDuration: number = DEFAULT_WAKE_UP_DURATION;
  private stateTime: number = 0;
  private state: SleeperState = SleeperState.SLEEPING;
  private slamDuration: number = 0;
  private slamMagnitude: number = 0;
  private attackImpulseX: number = 0;
  private attackImpulseY: number = 0;

  constructor(config?: SleeperConfig) {
    super(ComponentPhase.THINK);

    if (config) {
      if (config.wakeUpDuration !== undefined) this.wakeUpDuration = config.wakeUpDuration;
      if (config.slamDuration !== undefined) this.slamDuration = config.slamDuration;
      if (config.slamMagnitude !== undefined) this.slamMagnitude = config.slamMagnitude;
      if (config.attackImpulseX !== undefined) this.attackImpulseX = config.attackImpulseX;
      if (config.attackImpulseY !== undefined) this.attackImpulseY = config.attackImpulseY;
    }
  }

  override reset(): void {
    this.wakeUpDuration = DEFAULT_WAKE_UP_DURATION;
    this.state = SleeperState.SLEEPING;
    this.stateTime = 0;
    this.slamDuration = 0;
    this.slamMagnitude = 0;
    this.attackImpulseX = 0;
    this.attackImpulseY = 0;
  }

  override update(timeDelta: number, parent: object): void {
    const parentObject = parent as GameObject;

    if (parentObject.getCurrentAction() === ActionType.INVALID) {
      parentObject.setCurrentAction(ActionType.IDLE);
      this.state = SleeperState.SLEEPING;
    }

    const camera = sSystemRegistry.cameraSystem;
    if (!camera) return;

    switch (this.state) {
      case SleeperState.SLEEPING: {
        // Wake up if camera is shaking and we're visible
        if (camera.isShaking() && camera.isPointVisible(parentObject.getPosition(), parentObject.width / 2)) {
          this.state = SleeperState.WAKING;
          this.stateTime = this.wakeUpDuration;
          parentObject.setCurrentAction(ActionType.MOVE);
        }
        break;
      }

      case SleeperState.WAKING: {
        this.stateTime -= timeDelta;
        if (this.stateTime <= 0) {
          this.state = SleeperState.ATTACKING;
          parentObject.setCurrentAction(ActionType.ATTACK);

          // Apply attack impulse
          const impulse = parentObject.getImpulse();
          impulse.x += this.attackImpulseX * parentObject.facingDirection.x;
          impulse.y += this.attackImpulseY;
        }
        break;
      }

      case SleeperState.ATTACKING: {
        // Wait until we hit the ground
        if (parentObject.touchingGround() && parentObject.getVelocity().y < 0) {
          this.state = SleeperState.SLAM;
          camera.shake(this.slamDuration, this.slamMagnitude);
          parentObject.getVelocity().zero();
        }
        break;
      }

      case SleeperState.SLAM: {
        // Wait until shake finishes
        if (!camera.isShaking()) {
          this.state = SleeperState.SLEEPING;
          parentObject.setCurrentAction(ActionType.IDLE);
        }
        break;
      }
    }
  }

  // Setters
  setWakeUpDuration(duration: number): void {
    this.wakeUpDuration = duration;
  }

  setSlam(duration: number, magnitude: number): void {
    this.slamDuration = duration;
    this.slamMagnitude = magnitude;
  }

  setAttackImpulse(x: number, y: number): void {
    this.attackImpulseX = x;
    this.attackImpulseY = y;
  }
}

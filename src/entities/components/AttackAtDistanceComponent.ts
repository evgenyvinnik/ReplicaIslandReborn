/**
 * AttackAtDistanceComponent - Enemy AI that attacks when player is within range
 * Ported from: Original/src/com/replica/replicaisland/AttackAtDistanceComponent.java
 *
 * Triggers attack action when the player is within the specified distance
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { Vector2 } from '../../utils/Vector2';

const DEFAULT_ATTACK_DISTANCE = 100;

export interface AttackAtDistanceConfig {
  attackDistance?: number;
  attackDelay?: number;
  attackLength?: number;
  requireFacing?: boolean;
}

export class AttackAtDistanceComponent extends GameComponent {
  private attackDistance: number = DEFAULT_ATTACK_DISTANCE;
  private attackDelay: number = 0;
  private attackLength: number = 0;
  private attackStartTime: number = 0;
  private requireFacing: boolean = false;
  private distance: Vector2 = new Vector2();

  constructor(config?: AttackAtDistanceConfig) {
    super(ComponentPhase.THINK);

    if (config) {
      if (config.attackDistance !== undefined) this.attackDistance = config.attackDistance;
      if (config.attackDelay !== undefined) this.attackDelay = config.attackDelay;
      if (config.attackLength !== undefined) this.attackLength = config.attackLength;
      if (config.requireFacing !== undefined) this.requireFacing = config.requireFacing;
    }
  }

  override reset(): void {
    this.attackDelay = 0;
    this.attackLength = 0;
    this.attackDistance = DEFAULT_ATTACK_DISTANCE;
    this.requireFacing = false;
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

    // Check if enemy is facing the player
    const playerDir = Math.sign(player.getPosition().x - parentObject.getPosition().x);
    const facingPlayer = playerDir === Math.sign(parentObject.facingDirection.x);
    const facingDirectionCorrect = (this.requireFacing && facingPlayer) || !this.requireFacing;

    if (parentObject.getCurrentAction() === ActionType.ATTACK) {
      // Currently attacking - check if attack duration is over
      if (currentTime > this.attackStartTime + this.attackLength) {
        parentObject.setCurrentAction(ActionType.IDLE);
      }
    } else if (
      this.distance.lengthSquared() < this.attackDistance * this.attackDistance &&
      currentTime > this.attackStartTime + this.attackLength + this.attackDelay &&
      facingDirectionCorrect
    ) {
      // Start attack
      this.attackStartTime = currentTime;
      parentObject.setCurrentAction(ActionType.ATTACK);
    } else {
      parentObject.setCurrentAction(ActionType.IDLE);
    }
  }

  /**
   * Setup attack parameters
   */
  setupAttack(distance: number, delay: number, duration: number, requireFacing: boolean): void {
    this.attackDistance = distance;
    this.attackDelay = delay;
    this.attackLength = duration;
    this.requireFacing = requireFacing;
  }
}

/**
 * NPCAnimationComponent - Handles NPC character animation state machine
 * Ported from: Original/src/com/replica/replicaisland/NPCAnimationComponent.java
 *
 * Manages animation states for NPCs including idle, walk, run, jump, shoot, etc.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import { SpriteComponent } from './SpriteComponent';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import type { Channel, ChannelBooleanValue } from '../../engine/ChannelSystem';

/**
 * NPC Animation indices
 */
export const enum NPCAnimation {
  IDLE = 0,
  WALK = 1,
  RUN_START = 2,
  RUN = 3,
  SHOOT = 4,
  JUMP_START = 5,
  JUMP_AIR = 6,
  TAKE_HIT = 7,
  SURPRISED = 8,
  DEATH = 9,
}

/**
 * Speed and time thresholds
 */
const RUN_SPEED_THRESHOLD = 100.0;
const JUMP_SPEED_THRESHOLD = 25.0;
const FALL_SPEED_THRESHOLD = -25.0;
const FALL_TIME_THRESHOLD = 0.2;

export interface NPCAnimationConfig {
  flying?: boolean;
  stopAtWalls?: boolean;
  channel?: Channel;
  channelTrigger?: NPCAnimation;
}

export class NPCAnimationComponent extends GameComponent {
  private currentAnimation: NPCAnimation = NPCAnimation.IDLE;
  private sprite: SpriteComponent | null = null;
  private channel: Channel | null = null;
  private channelTrigger: NPCAnimation = NPCAnimation.IDLE;
  private flying: boolean = false;
  private stopAtWalls: boolean = true;

  constructor(config?: NPCAnimationConfig) {
    super();
    this.setPhase(ComponentPhase.ANIMATION);
    this.reset();

    if (config) {
      if (config.flying !== undefined) this.flying = config.flying;
      if (config.stopAtWalls !== undefined) this.stopAtWalls = config.stopAtWalls;
      if (config.channel) this.channel = config.channel;
      if (config.channelTrigger !== undefined) this.channelTrigger = config.channelTrigger;
    }
  }

  override reset(): void {
    this.currentAnimation = NPCAnimation.IDLE;
    this.sprite = null;
    this.channel = null;
    this.channelTrigger = NPCAnimation.IDLE;
    this.flying = false;
    this.stopAtWalls = true;
  }

  override update(_timeDelta: number, parent: object): void {
    if (!this.sprite) {
      // Try to find sprite component
      const gameObject = parent as GameObject;
      this.sprite = gameObject.getComponent(SpriteComponent);
      if (!this.sprite) return;
    }

    const parentObject = parent as GameObject;
    const oldAnimation = this.currentAnimation;

    switch (this.currentAnimation) {
      case NPCAnimation.IDLE:
        this.idle(parentObject);
        break;
      case NPCAnimation.WALK:
        this.walk(parentObject);
        break;
      case NPCAnimation.RUN_START:
        this.runStart(parentObject);
        break;
      case NPCAnimation.RUN:
        this.run(parentObject);
        break;
      case NPCAnimation.SHOOT:
        this.shoot(parentObject);
        break;
      case NPCAnimation.JUMP_START:
        this.jumpStart(parentObject);
        break;
      case NPCAnimation.JUMP_AIR:
        this.jumpAir(parentObject);
        break;
      case NPCAnimation.TAKE_HIT:
        this.takeHit(parentObject);
        break;
      case NPCAnimation.SURPRISED:
        this.surprised(parentObject);
        break;
      case NPCAnimation.DEATH:
        this.death(parentObject);
        break;
    }

    // Check channel trigger
    if (this.channel?.value) {
      const channelValue = this.channel.value as ChannelBooleanValue;
      if (channelValue.value) {
        this.currentAnimation = this.channelTrigger;
      }
    }

    if (oldAnimation !== this.currentAnimation) {
      this.sprite.playAnimation(this.currentAnimation);
    }
  }

  protected shouldFall(parentObject: GameObject): boolean {
    const time = sSystemRegistry.timeSystem;
    if (!time) return false;

    const airTime = time.getGameTime() - parentObject.getLastTouchedFloorTime();
    if (!this.flying && !parentObject.touchingGround() && airTime > FALL_TIME_THRESHOLD) {
      const velocity = parentObject.getVelocity();
      if (velocity.y < FALL_SPEED_THRESHOLD) {
        return true;
      }
    }
    return false;
  }

  protected shouldJump(parentObject: GameObject): boolean {
    if (!this.flying) {
      const velocity = parentObject.getVelocity();
      if (velocity.y > JUMP_SPEED_THRESHOLD) {
        return true;
      }
    }
    return false;
  }

  protected shouldRun(parentObject: GameObject): boolean {
    if (!this.flying && parentObject.touchingGround()) {
      const velocity = parentObject.getVelocity();
      if (Math.abs(velocity.x) >= RUN_SPEED_THRESHOLD) {
        return true;
      }
    }
    return false;
  }

  protected shouldMove(parentObject: GameObject): boolean {
    const velocity = parentObject.getVelocity();

    if (this.stopAtWalls) {
      if (
        (velocity.x < 0.0 && parentObject.touchingLeftWall()) ||
        (velocity.x > 0.0 && parentObject.touchingRightWall())
      ) {
        return false;
      }
    }
    return true;
  }

  protected shouldTakeHit(parentObject: GameObject): boolean {
    if (
      parentObject.getCurrentAction() === ActionType.HIT_REACT &&
      this.sprite?.findAnimation(NPCAnimation.TAKE_HIT) != null
    ) {
      return true;
    }
    return false;
  }

  protected gotoRunStart(): void {
    if (this.sprite?.findAnimation(NPCAnimation.RUN_START) != null) {
      this.currentAnimation = NPCAnimation.RUN_START;
    } else {
      this.currentAnimation = NPCAnimation.RUN;
    }
  }

  protected gotoRun(): void {
    this.currentAnimation = NPCAnimation.RUN;
  }

  protected idle(parentObject: GameObject): void {
    const currentAction = parentObject.getCurrentAction();

    if (currentAction === ActionType.MOVE) {
      const velocity = parentObject.getVelocity();

      if (this.shouldFall(parentObject)) {
        this.currentAnimation = NPCAnimation.JUMP_AIR;
      } else if (this.shouldJump(parentObject)) {
        this.currentAnimation = NPCAnimation.JUMP_START;
        parentObject.positionLocked = true;
      } else if (Math.abs(velocity.x) > 0.0 && this.shouldMove(parentObject)) {
        if (this.shouldRun(parentObject)) {
          this.gotoRunStart();
          parentObject.positionLocked = true;
        } else {
          this.currentAnimation = NPCAnimation.WALK;
        }
      }
    } else if (currentAction === ActionType.ATTACK) {
      this.currentAnimation = NPCAnimation.SHOOT;
    } else if (this.shouldTakeHit(parentObject)) {
      this.currentAnimation = NPCAnimation.TAKE_HIT;
    } else if (parentObject.getCurrentAction() === ActionType.DEATH) {
      this.currentAnimation = NPCAnimation.DEATH;
    }
  }

  protected walk(parentObject: GameObject): void {
    const currentAction = parentObject.getCurrentAction();

    if (currentAction === ActionType.MOVE) {
      const velocity = parentObject.getVelocity();

      if (this.shouldFall(parentObject)) {
        this.currentAnimation = NPCAnimation.JUMP_AIR;
      } else if (this.shouldJump(parentObject)) {
        this.currentAnimation = NPCAnimation.JUMP_START;
        parentObject.positionLocked = true;
      } else if (Math.abs(velocity.x) > 0.0) {
        if (this.shouldRun(parentObject)) {
          this.gotoRun();
        }
        if (velocity.x > 0.0) {
          parentObject.facingDirection.x = 1;
        } else {
          parentObject.facingDirection.x = -1;
        }
      } else {
        this.currentAnimation = NPCAnimation.IDLE;
      }
    } else if (currentAction === ActionType.ATTACK) {
      this.currentAnimation = NPCAnimation.SHOOT;
    } else if (this.shouldTakeHit(parentObject)) {
      this.currentAnimation = NPCAnimation.TAKE_HIT;
    } else if (parentObject.getCurrentAction() === ActionType.DEATH) {
      this.currentAnimation = NPCAnimation.DEATH;
    }
  }

  protected runStart(parentObject: GameObject): void {
    parentObject.positionLocked = true;

    if (this.sprite?.animationFinished()) {
      this.currentAnimation = NPCAnimation.RUN;
      parentObject.positionLocked = false;
    }
  }

  protected run(parentObject: GameObject): void {
    const currentAction = parentObject.getCurrentAction();

    if (currentAction === ActionType.MOVE) {
      const velocity = parentObject.getVelocity();

      if (this.shouldFall(parentObject)) {
        this.currentAnimation = NPCAnimation.JUMP_AIR;
      } else if (this.shouldJump(parentObject)) {
        parentObject.positionLocked = true;
        this.currentAnimation = NPCAnimation.JUMP_START;
      } else if (Math.abs(velocity.x) > 0.0) {
        if (!this.shouldRun(parentObject)) {
          this.currentAnimation = NPCAnimation.WALK;
        }
        if (velocity.x > 0.0) {
          parentObject.facingDirection.x = 1;
        } else {
          parentObject.facingDirection.x = -1;
        }
      } else {
        this.currentAnimation = NPCAnimation.IDLE;
      }
    } else if (currentAction === ActionType.ATTACK) {
      this.currentAnimation = NPCAnimation.SHOOT;
    } else if (this.shouldTakeHit(parentObject)) {
      this.currentAnimation = NPCAnimation.TAKE_HIT;
    } else if (parentObject.getCurrentAction() === ActionType.DEATH) {
      this.currentAnimation = NPCAnimation.DEATH;
    }
  }

  protected shoot(parentObject: GameObject): void {
    if (this.sprite?.animationFinished() || parentObject.getCurrentAction() !== ActionType.ATTACK) {
      this.currentAnimation = NPCAnimation.IDLE;
    } else if (this.shouldTakeHit(parentObject)) {
      this.currentAnimation = NPCAnimation.TAKE_HIT;
    } else if (parentObject.getCurrentAction() === ActionType.DEATH) {
      this.currentAnimation = NPCAnimation.DEATH;
    } else {
      const velocity = parentObject.getVelocity();
      if (velocity.x > 0.0) {
        parentObject.facingDirection.x = 1;
      } else if (velocity.x < 0.0) {
        parentObject.facingDirection.x = -1;
      }
    }
  }

  protected jumpStart(parentObject: GameObject): void {
    const velocity = parentObject.getVelocity();

    if (velocity.x > 0.0) {
      parentObject.facingDirection.x = 1;
    } else if (velocity.x < 0.0) {
      parentObject.facingDirection.x = -1;
    }

    parentObject.positionLocked = true;

    if (this.sprite?.animationFinished()) {
      this.currentAnimation = NPCAnimation.JUMP_AIR;
      parentObject.positionLocked = false;
    }
  }

  protected jumpAir(parentObject: GameObject): void {
    const currentAction = parentObject.getCurrentAction();

    if (currentAction === ActionType.MOVE) {
      const velocity = parentObject.getVelocity();

      if (parentObject.touchingGround()) {
        if (Math.abs(velocity.x) > 0.0) {
          if (this.shouldRun(parentObject)) {
            this.currentAnimation = NPCAnimation.RUN;
          } else {
            this.currentAnimation = NPCAnimation.WALK;
          }
        } else {
          this.currentAnimation = NPCAnimation.IDLE;
        }
      } else {
        if (velocity.x > 0.0) {
          parentObject.facingDirection.x = 1;
        } else if (velocity.x < 0.0) {
          parentObject.facingDirection.x = -1;
        }
      }
    } else {
      this.currentAnimation = NPCAnimation.IDLE;
    }
  }

  protected takeHit(parentObject: GameObject): void {
    if (this.sprite?.animationFinished()) {
      if (parentObject.life > 0 && parentObject.getCurrentAction() !== ActionType.DEATH) {
        if (parentObject.getCurrentAction() !== ActionType.HIT_REACT) {
          this.currentAnimation = NPCAnimation.IDLE;
        }
      } else {
        this.currentAnimation = NPCAnimation.DEATH;
      }
    }
  }

  protected surprised(_parentObject: GameObject): void {
    if (this.sprite?.animationFinished()) {
      this.currentAnimation = NPCAnimation.IDLE;
    }
  }

  protected death(_parentObject: GameObject): void {
    // Death state - no transitions
  }

  // Setters
  setSprite(sprite: SpriteComponent): void {
    this.sprite = sprite;
  }

  setChannel(channel: Channel): void {
    this.channel = channel;
  }

  setChannelTrigger(animation: NPCAnimation): void {
    this.channelTrigger = animation;
  }

  setFlying(flying: boolean): void {
    this.flying = flying;
  }

  setStopAtWalls(stop: boolean): void {
    this.stopAtWalls = stop;
  }
}

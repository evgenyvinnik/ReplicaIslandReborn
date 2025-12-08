/**
 * Patrol Component - AI patrolling behavior for enemies
 * Ported from: Original/src/com/replica/replicaisland/PatrolComponent.java
 * 
 * Patrolling characters walk forward until they hit a direction hot spot or wall,
 * then change direction. Can be configured to attack the player when in range.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import { Vector2 } from '../../utils/Vector2';
import { HotSpotType } from '../../engine/HotSpotSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';

export interface PatrolConfig {
  maxSpeed: number;
  acceleration: number;
  flying?: boolean;
  turnToFacePlayer?: boolean;
  attack?: {
    enabled: boolean;
    atDistance: number;
    duration: number;
    delay: number;
    stopsMovement: boolean;
  };
}

export class PatrolComponent extends GameComponent {
  private maxSpeed: number = 0;
  private acceleration: number = 0;
  private attack: boolean = false;
  private attackAtDistance: number = 0;
  private attackStopsMovement: boolean = false;
  private attackDuration: number = 0;
  private attackDelay: number = 0;
  private turnToFacePlayer: boolean = false;
  private flying: boolean = false;
  
  private lastAttackTime: number = 0;
  private workingVector: Vector2 = new Vector2(0, 0);
  private workingVector2: Vector2 = new Vector2(0, 0);

  constructor(config?: PatrolConfig) {
    super(ComponentPhase.THINK);
    
    if (config) {
      this.configure(config);
    }
  }

  /**
   * Configure the patrol behavior
   */
  configure(config: PatrolConfig): void {
    this.maxSpeed = config.maxSpeed;
    this.acceleration = config.acceleration;
    this.flying = config.flying ?? false;
    this.turnToFacePlayer = config.turnToFacePlayer ?? false;
    
    if (config.attack?.enabled) {
      this.attack = true;
      this.attackAtDistance = config.attack.atDistance;
      this.attackDuration = config.attack.duration;
      this.attackDelay = config.attack.delay;
      this.attackStopsMovement = config.attack.stopsMovement;
    }
  }

  /**
   * Set movement speed
   */
  setMovementSpeed(speed: number, acceleration: number): void {
    this.maxSpeed = speed;
    this.acceleration = acceleration;
  }

  /**
   * Setup attack behavior
   */
  setupAttack(distance: number, duration: number, delay: number, stopMovement: boolean): void {
    this.attack = true;
    this.attackAtDistance = distance;
    this.attackDuration = duration;
    this.attackDelay = delay;
    this.attackStopsMovement = stopMovement;
  }

  /**
   * Set whether enemy turns to face player
   */
  setTurnToFacePlayer(turn: boolean): void {
    this.turnToFacePlayer = turn;
  }

  /**
   * Set whether enemy is flying (can move vertically)
   */
  setFlying(flying: boolean): void {
    this.flying = flying;
  }

  /**
   * Helper to get sign of a number
   */
  private sign(x: number): number {
    return x < 0 ? -1 : (x > 0 ? 1 : 0);
  }

  /**
   * Get centered X position
   */
  private getCenteredX(obj: GameObject): number {
    return obj.getCenteredPositionX();
  }

  /**
   * Get centered Y position
   */
  private getCenteredY(obj: GameObject): number {
    return obj.getCenteredPositionY();
  }

  /**
   * Update attack behavior
   */
  private updateAttack(player: GameObject | null, parent: GameObject, gameTime: number): void {
    // Check if enemy is visible on screen
    let visible = true;
    const camera = sSystemRegistry.cameraSystem;
    if (camera) {
      const cameraPos = camera.getPosition();
      const dx = Math.abs(this.getCenteredX(parent) - (cameraPos.x + sSystemRegistry.gameWidth / 2));
      const dy = Math.abs(this.getCenteredY(parent) - (cameraPos.y + sSystemRegistry.gameHeight / 2));
      if (dx > sSystemRegistry.gameWidth / 2 || dy > sSystemRegistry.gameHeight / 2) {
        visible = false;
      }
    }

    if (visible && parent.getCurrentAction() === ActionType.MOVE) {
      let closeEnough = false;
      const timeToAttack = (gameTime - this.lastAttackTime) > this.attackDelay;

      if (this.attackAtDistance > 0 && player && player.life > 0 && timeToAttack) {
        // Only attack if facing the player
        const playerPos = player.getPosition();
        const parentPos = parent.getPosition();
        if (this.sign(playerPos.x - parentPos.x) === this.sign(parent.facingDirection.x)) {
          this.workingVector.x = this.getCenteredX(parent);
          this.workingVector.y = parentPos.y;
          this.workingVector2.x = this.getCenteredX(player);
          this.workingVector2.y = playerPos.y;
          
          const dx = this.workingVector2.x - this.workingVector.x;
          const dy = this.workingVector2.y - this.workingVector.y;
          const distSquared = dx * dx + dy * dy;
          
          if (distSquared < this.attackAtDistance * this.attackAtDistance) {
            closeEnough = true;
          }
        }
      } else {
        // No distance set, always close enough
        closeEnough = true;
      }

      if (timeToAttack && closeEnough) {
        // Time to attack
        parent.setCurrentAction(ActionType.ATTACK);
        this.lastAttackTime = gameTime;
        if (this.attackStopsMovement) {
          parent.setVelocity(0, 0);
          parent.setTargetVelocity(0, 0);
        }
      }
    } else if (parent.getCurrentAction() === ActionType.ATTACK) {
      if (gameTime - this.lastAttackTime > this.attackDuration) {
        parent.setCurrentAction(ActionType.MOVE);
        if (this.attackStopsMovement) {
          parent.getTargetVelocity().x = this.maxSpeed * this.sign(parent.facingDirection.x);
          parent.getAcceleration().x = this.acceleration;
        }
      }
    }
  }

  /**
   * Main update loop
   */
  update(_deltaTime: number, parent: GameObject): void {
    // Get player and game time from system registry
    const manager = sSystemRegistry.gameObjectManager;
    const player = manager?.getPlayer() ?? null;
    const timeSystem = sSystemRegistry.timeSystem;
    const gameTime = timeSystem?.getGameTime() ?? 0;

    // Initialize action if needed
    const currentAction = parent.getCurrentAction();
    if (currentAction === ActionType.INVALID || currentAction === ActionType.HIT_REACT) {
      parent.setCurrentAction(ActionType.MOVE);
    }

    // Only process if alive and (flying or on ground)
    if ((this.flying || parent.touchingGround()) && parent.life > 0) {
      // Handle attack logic
      if (this.attack) {
        this.updateAttack(player, parent, gameTime);
      }

      // Handle movement
      if (parent.getCurrentAction() === ActionType.MOVE && this.maxSpeed > 0) {
        // Get hot spot at current position
        let hotSpot: number = HotSpotType.NONE;
        const hotSpotSystem = sSystemRegistry.hotSpotSystem;
        if (hotSpotSystem) {
          hotSpot = hotSpotSystem.getHotSpot(this.getCenteredX(parent), parent.getPosition().y + 10);
        }

        const targetVelocityX = parent.getTargetVelocity().x;
        const targetVelocityY = parent.getTargetVelocity().y;

        // Determine direction changes
        let goLeft = (parent.touchingRightWall() || hotSpot === HotSpotType.GO_LEFT) && targetVelocityX >= 0;
        let goRight = (parent.touchingLeftWall() || hotSpot === HotSpotType.GO_RIGHT) && targetVelocityX <= 0;
        let pause = this.maxSpeed === 0 || hotSpot === HotSpotType.GO_DOWN;

        // Turn to face player if configured
        if (this.turnToFacePlayer && player && player.life > 0) {
          const horizontalDelta = this.getCenteredX(player) - this.getCenteredX(parent);
          const targetFacingDirection = this.sign(horizontalDelta);
          const closestDistance = player.width / 2;

          if (targetFacingDirection < 0) {
            // Want to turn left
            if (goRight) {
              goRight = false;
              pause = true;
            } else if (targetFacingDirection !== this.sign(parent.facingDirection.x)) {
              goLeft = true;
            }
          } else if (targetFacingDirection > 0) {
            // Want to turn right
            if (goLeft) {
              goLeft = false;
              pause = true;
            } else if (targetFacingDirection !== this.sign(parent.facingDirection.x)) {
              goRight = true;
            }
          }

          // Stop if too close
          if (Math.abs(horizontalDelta) < closestDistance) {
            goRight = false;
            goLeft = false;
            pause = true;
          }
        }

        // Apply movement
        if (!this.flying) {
          // Ground movement
          if (!pause && !goLeft && !goRight && targetVelocityX === 0) {
            // Start moving in facing direction
            if (parent.facingDirection.x < 0) {
              goLeft = true;
            } else {
              goRight = true;
            }
          }

          if (goRight) {
            parent.getTargetVelocity().x = this.maxSpeed;
            parent.getAcceleration().x = this.acceleration;
          } else if (goLeft) {
            parent.getTargetVelocity().x = -this.maxSpeed;
            parent.getAcceleration().x = this.acceleration;
          } else if (pause) {
            parent.getTargetVelocity().x = 0;
            parent.getAcceleration().x = this.acceleration;
          }
        } else {
          // Flying movement
          const goUp = (parent.touchingGround() && targetVelocityY < 0) || hotSpot === HotSpotType.GO_UP;
          const goDown = (parent.touchingCeiling() || hotSpot === HotSpotType.GO_DOWN);

          if (goUp) {
            parent.getTargetVelocity().x = 0;
            parent.getTargetVelocity().y = this.maxSpeed;
            parent.getAcceleration().y = this.acceleration;
            parent.getAcceleration().x = this.acceleration;
          } else if (goDown) {
            parent.getTargetVelocity().x = 0;
            parent.getTargetVelocity().y = -this.maxSpeed;
            parent.getAcceleration().y = this.acceleration;
            parent.getAcceleration().x = this.acceleration;
          } else if (goRight) {
            parent.getTargetVelocity().x = this.maxSpeed;
            parent.getTargetVelocity().y = 0;
            parent.getAcceleration().x = this.acceleration;
            parent.getAcceleration().y = this.acceleration;
          } else if (goLeft) {
            parent.getTargetVelocity().x = -this.maxSpeed;
            parent.getTargetVelocity().y = 0;
            parent.getAcceleration().x = this.acceleration;
            parent.getAcceleration().y = this.acceleration;
          }
        }
      }
    } else if (!this.flying && !parent.touchingGround() && parent.life > 0) {
      // Non-flying unit in air - watch for wall bounces
      if (this.sign(parent.getTargetVelocity().x) !== this.sign(parent.getVelocity().x)) {
        parent.getTargetVelocity().x *= -1;
      }
    }
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.turnToFacePlayer = false;
    this.maxSpeed = 0;
    this.acceleration = 0;
    this.attack = false;
    this.attackAtDistance = 0;
    this.attackStopsMovement = false;
    this.attackDuration = 0;
    this.attackDelay = 0;
    this.flying = false;
    this.lastAttackTime = 0;
    this.workingVector.x = 0;
    this.workingVector.y = 0;
    this.workingVector2.x = 0;
    this.workingVector2.y = 0;
  }
}

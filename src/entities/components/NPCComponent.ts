/**
 * NPCComponent - Handles NPC movement via hot spots and cutscene behavior
 * Ported from: Original/src/com/replica/replicaisland/NPCComponent.java
 *
 * NPCs use hot spots to determine movement direction, camera focus,
 * dialog triggers, and other behaviors during cutscenes and gameplay.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import { HotSpotType } from '../../engine/HotSpotSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { GameFlowEventType } from '../../engine/GameFlowEvent';
import type { HitReactionComponent } from './HitReactionComponent';

// Speed and timing constants (from original)
// NOTE: In screen coordinates, positive Y is DOWN, so:
// - UP_IMPULSE should be NEGATIVE to move upward (decrease Y)
// - DOWN_IMPULSE should be POSITIVE to move downward (increase Y)
const UP_IMPULSE = -400.0;
const DOWN_IMPULSE = 10.0;
const HORIZONTAL_IMPULSE = 200.0;
const SLOW_HORIZONTAL_IMPULSE = 50.0;
const ACCELERATION = 300.0;
const HIT_IMPULSE = 300.0;
const HIT_ACCELERATION = 700.0;

const DEATH_FADE_DELAY = 4.0;

const PAUSE_TIME_SHORT = 1.0;
const PAUSE_TIME_MEDIUM = 4.0;
const PAUSE_TIME_LONG = 8.0;
const PAUSE_TIME_ATTACK = 1.0;
const PAUSE_TIME_HIT_REACT = 1.0;

const COMMAND_QUEUE_SIZE = 16;

/**
 * Configuration for NPCComponent
 */
export interface NPCComponentConfig {
  horizontalImpulse?: number;
  slowHorizontalImpulse?: number;
  upImpulse?: number;
  downImpulse?: number;
  acceleration?: number;
  reactToHits?: boolean;
  flying?: boolean;
  pauseOnAttack?: boolean;
  gameEvent?: number;
  gameEventIndex?: number;
  spawnGameEventOnDeath?: boolean;
}

/**
 * NPCComponent - Controls NPC movement and behavior via hot spots
 */
export class NPCComponent extends GameComponent {
  // Timing
  private pauseTime: number = 0;
  private targetXVelocity: number = 0;
  
  // Last hit tile tracking (to avoid repeated triggers)
  private lastHitTileX: number = 0;
  private lastHitTileY: number = 0;
  
  // Dialog settings
  private dialogEvent: number = GameFlowEventType.SHOW_DIALOG_CHARACTER1;
  private dialogIndex: number = 0;
  
  // Component references
  private hitReactComponent: HitReactionComponent | null = null;
  
  // Command queue for executing sequences
  private queuedCommands: number[] = new Array(COMMAND_QUEUE_SIZE).fill(HotSpotType.NONE);
  private queueTop: number = 0;
  private queueBottom: number = 0;
  private executingQueue: boolean = false;
  
  // Previous position for tracking movement
  private previousPosition = { x: 0, y: 0 };
  
  // Speed configuration
  private upImpulse: number = UP_IMPULSE;
  private downImpulse: number = DOWN_IMPULSE;
  private horizontalImpulse: number = HORIZONTAL_IMPULSE;
  private slowHorizontalImpulse: number = SLOW_HORIZONTAL_IMPULSE;
  private acceleration: number = ACCELERATION;
  
  // Game event settings
  private gameEvent: number = -1;
  private gameEventIndex: number = -1;
  private spawnGameEventOnDeath: boolean = false;
  
  // Behavior flags
  private reactToHits: boolean = false;
  private flying: boolean = false;
  private pauseOnAttack: boolean = true;
  
  // Death tracking
  private deathTime: number = 0;
  private deathFadeDelay: number = DEATH_FADE_DELAY;

  constructor(config?: NPCComponentConfig) {
    super();
    this.setPhase(ComponentPhase.THINK);
    
    if (config) {
      if (config.horizontalImpulse !== undefined) this.horizontalImpulse = config.horizontalImpulse;
      if (config.slowHorizontalImpulse !== undefined) this.slowHorizontalImpulse = config.slowHorizontalImpulse;
      if (config.upImpulse !== undefined) this.upImpulse = config.upImpulse;
      if (config.downImpulse !== undefined) this.downImpulse = config.downImpulse;
      if (config.acceleration !== undefined) this.acceleration = config.acceleration;
      if (config.reactToHits !== undefined) this.reactToHits = config.reactToHits;
      if (config.flying !== undefined) this.flying = config.flying;
      if (config.pauseOnAttack !== undefined) this.pauseOnAttack = config.pauseOnAttack;
      if (config.gameEvent !== undefined) this.gameEvent = config.gameEvent;
      if (config.gameEventIndex !== undefined) this.gameEventIndex = config.gameEventIndex;
      if (config.spawnGameEventOnDeath !== undefined) this.spawnGameEventOnDeath = config.spawnGameEventOnDeath;
    }
  }

  override reset(): void {
    this.pauseTime = 0;
    this.targetXVelocity = 0;
    this.lastHitTileX = 0;
    this.lastHitTileY = 0;
    this.dialogEvent = GameFlowEventType.SHOW_DIALOG_CHARACTER1;
    this.dialogIndex = 0;
    this.hitReactComponent = null;
    this.queueTop = 0;
    this.queueBottom = 0;
    this.queuedCommands.fill(HotSpotType.NONE);
    this.previousPosition.x = 0;
    this.previousPosition.y = 0;
    this.executingQueue = false;
    this.upImpulse = UP_IMPULSE;
    this.downImpulse = DOWN_IMPULSE;
    this.horizontalImpulse = HORIZONTAL_IMPULSE;
    this.slowHorizontalImpulse = SLOW_HORIZONTAL_IMPULSE;
    this.acceleration = ACCELERATION;
    this.gameEvent = -1;
    this.gameEventIndex = -1;
    this.spawnGameEventOnDeath = false;
    this.reactToHits = false;
    this.flying = false;
    this.deathTime = 0;
    this.deathFadeDelay = DEATH_FADE_DELAY;
    this.pauseOnAttack = true;
  }
  
  override update(timeDelta: number, parent: object): void {
    const parentObject = parent as GameObject;
    
    // Debug: Log NPC position and hotspot detection for ALL NPCs
    const pos = parentObject.getPosition();
    const hotSpotSystem = sSystemRegistry.hotSpotSystem;
    if (hotSpotSystem) {
      const centerX = parentObject.getCenteredPositionX();
      const checkY = pos.y + parentObject.height - 10;
      const tileX = hotSpotSystem.getHitTileX(centerX);
      const tileY = hotSpotSystem.getHitTileY(checkY);
      const hotSpot = hotSpotSystem.getHotSpotByTile(tileX, tileY);
      // Log every frame for NPCs
      // console.log(`[NPCComponent] ${parentObject.subType || 'NPC'} at pos(${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}) tile(${tileX}, ${tileY}) hotspot=${hotSpot} targetVel=(${parentObject.getTargetVelocity().x.toFixed(0)}, ${parentObject.getTargetVelocity().y.toFixed(0)}) vel=(${parentObject.getVelocity().x.toFixed(0)}, ${parentObject.getVelocity().y.toFixed(0)})`);
    }
    
    // Handle hit reaction
    if (this.reactToHits && 
        this.pauseTime <= 0 && 
        parentObject.getCurrentAction() === ActionType.HIT_REACT) {
      this.pauseTime = PAUSE_TIME_HIT_REACT;
      this.pauseMovement(parentObject);
      parentObject.getVelocity().x = -parentObject.facingDirection.x * HIT_IMPULSE;
      parentObject.getAcceleration().x = HIT_ACCELERATION;
      
    } else if (parentObject.getCurrentAction() === ActionType.DEATH) {
      // Handle death state
      if (this.spawnGameEventOnDeath && this.gameEvent !== -1) {
        const velocity = parentObject.getVelocity();
        if (Math.abs(velocity.x) < 1 && parentObject.touchingGround()) {
          if (this.deathTime < this.deathFadeDelay && 
              this.deathTime + timeDelta >= this.deathFadeDelay) {
            // Trigger game event after death fade delay
            // This would trigger HUD fade in the original
            this.gameEvent = -1;
          }
          this.deathTime += timeDelta;
        }
      }
      // Nothing else to do when dead
      return;
      
    } else if (parentObject.life <= 0) {
      parentObject.setCurrentAction(ActionType.DEATH);
      parentObject.getTargetVelocity().x = 0;
      return;
      
    } else if (parentObject.getCurrentAction() === ActionType.INVALID ||
               (!this.reactToHits && parentObject.getCurrentAction() === ActionType.HIT_REACT)) {
      parentObject.setCurrentAction(ActionType.MOVE);
    }
    
    // Process hot spots when not paused
    if (this.pauseTime <= 0) {
      const hotSpotSystem = sSystemRegistry.hotSpotSystem;
      
      if (hotSpotSystem) {
        const centerX = parentObject.getCenteredPositionX();
        const hitTileX = hotSpotSystem.getHitTileX(centerX);
        // Check hot spot near bottom of sprite (matches original: position.y + 10 in Y-up coords)
        // In Y-down coords: position.y + height - 10 (10 pixels above feet)
        const checkY = parentObject.getPosition().y + parentObject.height - 10;
        const hitTileY = hotSpotSystem.getHitTileY(checkY);
        let accepted = true;
        
        // Only process if we've moved to a new tile
        if (hitTileX !== this.lastHitTileX || hitTileY !== this.lastHitTileY) {
          const hotSpot = hotSpotSystem.getHotSpotByTile(hitTileX, hitTileY);
          
          // Debug: Log when Wanda enters a new tile
          if (parentObject.subType === 'wanda') {
            // console.log(`[NPCComponent] Wanda NEW TILE: (${hitTileX}, ${hitTileY}) hotSpot=${hotSpot} last=(${this.lastHitTileX}, ${this.lastHitTileY})`);
            // console.log(`[NPCComponent] Checking: hotSpot(${hotSpot}) >= NPC_GO_RIGHT(${HotSpotType.NPC_GO_RIGHT}) && hotSpot(${hotSpot}) <= NPC_SLOW(${HotSpotType.NPC_SLOW}) = ${hotSpot >= HotSpotType.NPC_GO_RIGHT && hotSpot <= HotSpotType.NPC_SLOW}`);
          }
          
          // Movement-related commands are immediate
          if (hotSpot >= HotSpotType.NPC_GO_RIGHT && hotSpot <= HotSpotType.NPC_SLOW) {
            if (parentObject.subType === 'wanda') {
              // console.log(`[NPCComponent] Wanda: Executing movement command ${hotSpot}`);
            }
            parentObject.setCurrentAction(ActionType.MOVE);
            accepted = this.executeCommand(hotSpot, parentObject, timeDelta);
            if (parentObject.subType === 'wanda') {
              // console.log(`[NPCComponent] Wanda AFTER EXECUTE: targetVel=(${parentObject.getTargetVelocity().x}, ${parentObject.getTargetVelocity().y}) accel=(${parentObject.getAcceleration().x}, ${parentObject.getAcceleration().y})`);
            }
          } else if (hotSpot === HotSpotType.ATTACK) {
            // Handle attack hotspot - either pause+attack or immediate attack
            if (parentObject.subType === 'wanda') {
              // console.log(`[NPCComponent] Wanda: ATTACK hotspot detected, pauseOnAttack=${this.pauseOnAttack}`);
            }
            accepted = this.executeCommand(hotSpot, parentObject, timeDelta);
          } else if (hotSpot === HotSpotType.NPC_RUN_QUEUED_COMMANDS) {
            if (!this.executingQueue && this.queueTop !== this.queueBottom) {
              this.executingQueue = true;
            }
          } else if (hotSpot > HotSpotType.NONE) {
            this.queueCommand(hotSpot);
          }
        }
        
        // Execute queued commands
        if (this.executingQueue) {
          if (this.queueTop !== this.queueBottom) {
            accepted = this.executeCommand(this.nextCommand(), parentObject, timeDelta);
            if (accepted) {
              this.advanceQueue();
            }
          } else {
            this.executingQueue = false;
          }
        }
        
        if (accepted) {
          this.lastHitTileX = hitTileX;
          this.lastHitTileY = hitTileY;
        }
      }
    } else {
      // Decrease pause timer
      this.pauseTime -= timeDelta;
      if (this.pauseTime < 0) {
        this.resumeMovement(parentObject);
        this.pauseTime = 0;
        parentObject.setCurrentAction(ActionType.MOVE);
      }
    }
    
    // Store previous position
    this.previousPosition.x = parentObject.getPosition().x;
    this.previousPosition.y = parentObject.getPosition().y;
  }

  /**
   * Check hotspots after physics update.
   * Called from Game.tsx NPC physics loop to ensure NPCs don't skip hotspot tiles during fast falls.
   * This is a PUBLIC method that can be called externally.
   */
  checkHotSpotsPostPhysics(parentObject: GameObject, timeDelta: number): void {
    if (this.pauseTime > 0) return; // Don't check hotspots while paused
    
    const hotSpotSystem = sSystemRegistry.hotSpotSystem;
    if (!hotSpotSystem) return;
    
    const centerX = parentObject.getCenteredPositionX();
    const checkY = parentObject.getPosition().y + parentObject.height - 10;
    const hitTileX = hotSpotSystem.getHitTileX(centerX);
    const hitTileY = hotSpotSystem.getHitTileY(checkY);
    
    // Only process if we've moved to a new tile since the last check
    if (hitTileX === this.lastHitTileX && hitTileY === this.lastHitTileY) {
      return;
    }
    
    const hotSpot = hotSpotSystem.getHotSpotByTile(hitTileX, hitTileY);
    
    // Debug: Log when NPC enters a new tile (post-physics)
    if (parentObject.subType === 'wanda') {
      // console.log(`[NPCComponent POST-PHYSICS] Wanda NEW TILE: (${hitTileX}, ${hitTileY}) hotSpot=${hotSpot} last=(${this.lastHitTileX}, ${this.lastHitTileY})`);
    }
    
    if (hotSpot > HotSpotType.NONE) {
      let accepted = true;
      
      // Movement-related commands are immediate
      if (hotSpot >= HotSpotType.NPC_GO_RIGHT && hotSpot <= HotSpotType.NPC_SLOW) {
        parentObject.setCurrentAction(ActionType.MOVE);
        accepted = this.executeCommand(hotSpot, parentObject, timeDelta);
      } else if (hotSpot === HotSpotType.ATTACK) {
        // Handle attack hotspot - either pause+attack or immediate attack
        if (parentObject.subType === 'wanda') {
          // console.log(`[NPCComponent POST-PHYSICS] Wanda: ATTACK hotspot detected, pauseOnAttack=${this.pauseOnAttack}`);
        }
        accepted = this.executeCommand(hotSpot, parentObject, timeDelta);
      } else if (hotSpot === HotSpotType.NPC_RUN_QUEUED_COMMANDS) {
        if (!this.executingQueue && this.queueTop !== this.queueBottom) {
          this.executingQueue = true;
        }
      } else {
        // Queue other commands for later execution
        this.queueCommand(hotSpot);
      }
      
      if (accepted) {
        this.lastHitTileX = hitTileX;
        this.lastHitTileY = hitTileY;
      }
    } else {
      // Update last tile even if no hotspot (to track position)
      this.lastHitTileX = hitTileX;
      this.lastHitTileY = hitTileY;
    }
  }

  /**
   * Execute a hot spot command
   */
  private executeCommand(hotSpot: number, parentObject: GameObject, _timeDelta: number): boolean {
    let hitAccepted = true;
    const cameraSystem = sSystemRegistry.cameraSystem;
    
    switch (hotSpot) {
      case HotSpotType.WAIT_SHORT:
        if (this.pauseTime === 0) {
          this.pauseTime = PAUSE_TIME_SHORT;
          this.pauseMovement(parentObject);
        }
        break;
        
      case HotSpotType.WAIT_MEDIUM:
        if (this.pauseTime === 0) {
          this.pauseTime = PAUSE_TIME_MEDIUM;
          this.pauseMovement(parentObject);
        }
        break;
        
      case HotSpotType.WAIT_LONG:
        if (this.pauseTime === 0) {
          this.pauseTime = PAUSE_TIME_LONG;
          this.pauseMovement(parentObject);
        }
        break;
        
      case HotSpotType.ATTACK:
        if (this.pauseOnAttack) {
          if (this.pauseTime === 0) {
            this.pauseTime = PAUSE_TIME_ATTACK;
            this.pauseMovement(parentObject);
          }
        }
        parentObject.setCurrentAction(ActionType.ATTACK);
        break;
        
      case HotSpotType.TALK:
        // Handle NPC talk hot spot
        if (this.hitReactComponent !== null) {
          // Setup dialog trigger on hit (player touching NPC)
          const velocity = parentObject.getVelocity();
          if (velocity.x !== 0) {
            this.pauseMovement(parentObject);
          }
          hitAccepted = false;
        }
        break;
        
      case HotSpotType.WALK_AND_TALK: {
        // Trigger dialog while walking
        // console.log(`[NPCComponent] WALK_AND_TALK: dialogEvent=${this.dialogEvent}, dialogIndex=${this.dialogIndex}`);
        if (this.dialogEvent !== GameFlowEventType.INVALID) {
          const gameFlowEvent = sSystemRegistry.gameFlowEvent;
          // console.log(`[NPCComponent] gameFlowEvent from registry:`, gameFlowEvent);
          if (gameFlowEvent) {
            // console.log(`[NPCComponent] Posting dialog event:`, this.dialogEvent, this.dialogIndex);
            gameFlowEvent.postImmediate(this.dialogEvent, this.dialogIndex);
            this.dialogEvent = GameFlowEventType.INVALID;
          } else {
            // console.error(`[NPCComponent] ERROR: gameFlowEvent is null!`);
          }
        }
        break;
      }
        
      case HotSpotType.TAKE_CAMERA_FOCUS:
        // Make camera follow this NPC
        if (cameraSystem) {
          cameraSystem.setNPCTarget(parentObject);
        }
        break;
        
      case HotSpotType.RELEASE_CAMERA_FOCUS:
        // Return camera to player
        if (cameraSystem) {
          const gameObjectManager = sSystemRegistry.gameObjectManager;
          if (gameObjectManager) {
            const player = gameObjectManager.getPlayer();
            cameraSystem.releaseNPCFocus(player);
          }
        }
        break;
        
      case HotSpotType.END_LEVEL: {
        // Trigger level completion
        // In original, this triggers HUD fade then game event
        const gameFlowEvent = sSystemRegistry.gameFlowEvent;
        if (gameFlowEvent) {
          gameFlowEvent.postImmediate(GameFlowEventType.GO_TO_NEXT_LEVEL, 0);
        }
        break;
      }
        
      case HotSpotType.GAME_EVENT: {
        if (this.gameEvent !== -1) {
          const gameFlowEvent = sSystemRegistry.gameFlowEvent;
          if (gameFlowEvent) {
            gameFlowEvent.postImmediate(this.gameEvent, this.gameEventIndex);
            this.gameEvent = -1;
          }
        }
        break;
      }
        
      case HotSpotType.NPC_GO_UP_FROM_GROUND:
        if (!parentObject.touchingGround()) {
          hitAccepted = false;
          break;
        }
        // Intentional fallthrough - same behavior as NPC_GO_UP
        parentObject.getVelocity().y = this.upImpulse;
        parentObject.getTargetVelocity().y = 0;
        this.targetXVelocity = 0;
        break;
        
      case HotSpotType.NPC_GO_UP:
        parentObject.getVelocity().y = this.upImpulse;
        parentObject.getTargetVelocity().y = 0;
        this.targetXVelocity = 0;
        break;
        
      case HotSpotType.NPC_GO_DOWN_FROM_CEILING:
        if (!parentObject.touchingCeiling()) {
          hitAccepted = false;
          break;
        }
        // Intentional fallthrough - same behavior as NPC_GO_DOWN
        parentObject.getVelocity().y = this.downImpulse;
        parentObject.getTargetVelocity().y = 0;
        if (this.flying) {
          this.targetXVelocity = 0;
        }
        break;
        
      case HotSpotType.NPC_GO_DOWN:
        parentObject.getVelocity().y = this.downImpulse;
        parentObject.getTargetVelocity().y = 0;
        if (this.flying) {
          this.targetXVelocity = 0;
        }
        break;
        
      case HotSpotType.NPC_GO_LEFT:
        parentObject.getTargetVelocity().x = -this.horizontalImpulse;
        parentObject.getAcceleration().x = this.acceleration;
        if (this.flying) {
          parentObject.getVelocity().y = 0;
          parentObject.getTargetVelocity().y = 0;
        }
        break;
        
      case HotSpotType.NPC_GO_RIGHT:
        // console.log(`[NPCComponent] NPC_GO_RIGHT ENTERED: horizontalImpulse=${this.horizontalImpulse}, acceleration=${this.acceleration}`);
        // console.log(`[NPCComponent] BEFORE: targetVel.x=${parentObject.getTargetVelocity().x}, accel.x=${parentObject.getAcceleration().x}`);
        parentObject.getTargetVelocity().x = this.horizontalImpulse;
        parentObject.getAcceleration().x = this.acceleration;
        // console.log(`[NPCComponent] AFTER: targetVel.x=${parentObject.getTargetVelocity().x}, accel.x=${parentObject.getAcceleration().x}`);
        if (this.flying) {
          parentObject.getVelocity().y = 0;
          parentObject.getTargetVelocity().y = 0;
        }
        break;
        
      case HotSpotType.NPC_GO_UP_RIGHT:
        parentObject.getVelocity().y = this.upImpulse;
        parentObject.getTargetVelocity().x = this.horizontalImpulse;
        parentObject.getAcceleration().x = this.acceleration;
        break;
        
      case HotSpotType.NPC_GO_UP_LEFT:
        parentObject.getVelocity().y = this.upImpulse;
        parentObject.getTargetVelocity().x = -this.horizontalImpulse;
        parentObject.getAcceleration().x = this.acceleration;
        break;
        
      case HotSpotType.NPC_GO_DOWN_RIGHT:
        parentObject.getVelocity().y = this.downImpulse;
        parentObject.getTargetVelocity().x = this.horizontalImpulse;
        parentObject.getAcceleration().x = this.acceleration;
        break;
        
      case HotSpotType.NPC_GO_DOWN_LEFT:
        parentObject.getVelocity().y = this.downImpulse;
        parentObject.getTargetVelocity().x = -this.horizontalImpulse;
        parentObject.getAcceleration().x = this.acceleration;
        break;
        
      case HotSpotType.NPC_GO_TOWARDS_PLAYER: {
        let direction = 1;
        const gameObjectManager = sSystemRegistry.gameObjectManager;
        if (gameObjectManager) {
          const player = gameObjectManager.getPlayer();
          if (player) {
            direction = Math.sign(
              player.getCenteredPositionX() - parentObject.getCenteredPositionX()
            ) || 1;
          }
        }
        parentObject.getTargetVelocity().x = this.horizontalImpulse * direction;
        if (this.flying) {
          parentObject.getVelocity().y = 0;
          parentObject.getTargetVelocity().y = 0;
        }
        break;
      }
        
      case HotSpotType.NPC_GO_RANDOM:
        parentObject.getTargetVelocity().x = this.horizontalImpulse * (Math.random() > 0.5 ? -1 : 1);
        if (this.flying) {
          parentObject.getVelocity().y = 0;
          parentObject.getTargetVelocity().y = 0;
        }
        break;
        
      case HotSpotType.NPC_STOP:
        parentObject.getTargetVelocity().x = 0;
        parentObject.getVelocity().x = 0;
        break;
        
      case HotSpotType.NPC_SLOW:
        parentObject.getTargetVelocity().x = 
          this.slowHorizontalImpulse * Math.sign(parentObject.getTargetVelocity().x);
        break;
        
      case HotSpotType.NPC_SELECT_DIALOG_1_1:
      case HotSpotType.NPC_SELECT_DIALOG_1_2:
      case HotSpotType.NPC_SELECT_DIALOG_1_3:
      case HotSpotType.NPC_SELECT_DIALOG_1_4:
      case HotSpotType.NPC_SELECT_DIALOG_1_5:
      case HotSpotType.NPC_SELECT_DIALOG_2_1:
      case HotSpotType.NPC_SELECT_DIALOG_2_2:
      case HotSpotType.NPC_SELECT_DIALOG_2_3:
      case HotSpotType.NPC_SELECT_DIALOG_2_4:
      case HotSpotType.NPC_SELECT_DIALOG_2_5:
        this.selectDialog(hotSpot);
        break;
        
      case HotSpotType.NONE:
        // No action
        break;
    }
    
    return hitAccepted;
  }

  /**
   * Pause NPC movement, storing current target velocity
   */
  private pauseMovement(parentObject: GameObject): void {
    this.targetXVelocity = parentObject.getTargetVelocity().x;
    parentObject.getTargetVelocity().x = 0;
    parentObject.getVelocity().x = 0;
  }

  /**
   * Resume NPC movement with stored target velocity
   */
  private resumeMovement(parentObject: GameObject): void {
    parentObject.getTargetVelocity().x = this.targetXVelocity;
    parentObject.getAcceleration().x = this.acceleration;
  }

  /**
   * Select dialog based on hot spot
   */
  private selectDialog(hotSpot: number): void {
    this.dialogEvent = GameFlowEventType.SHOW_DIALOG_CHARACTER1;
    this.dialogIndex = hotSpot - HotSpotType.NPC_SELECT_DIALOG_1_1;
    
    if (hotSpot >= HotSpotType.NPC_SELECT_DIALOG_2_1) {
      this.dialogEvent = GameFlowEventType.SHOW_DIALOG_CHARACTER2;
      this.dialogIndex = hotSpot - HotSpotType.NPC_SELECT_DIALOG_2_1;
    }
  }

  /**
   * Get next command from queue without removing it
   */
  private nextCommand(): number {
    if (this.queueTop !== this.queueBottom) {
      return this.queuedCommands[this.queueTop];
    }
    return HotSpotType.NONE;
  }

  /**
   * Advance the queue (remove front item)
   */
  private advanceQueue(): number {
    let result: number = HotSpotType.NONE;
    if (this.queueTop !== this.queueBottom) {
      result = this.queuedCommands[this.queueTop];
      this.queueTop = (this.queueTop + 1) % COMMAND_QUEUE_SIZE;
    }
    return result;
  }

  /**
   * Add command to queue
   */
  private queueCommand(hotspot: number): void {
    const nextSlot = (this.queueBottom + 1) % COMMAND_QUEUE_SIZE;
    if (nextSlot !== this.queueTop) { // Only add if there's space
      this.queuedCommands[this.queueBottom] = hotspot;
      this.queueBottom = nextSlot;
    }
  }

  // Setters

  setHitReactionComponent(hitReact: HitReactionComponent): void {
    this.hitReactComponent = hitReact;
  }

  setSpeeds(
    horizontalImpulse: number,
    slowHorizontalImpulse: number,
    upImpulse: number,
    downImpulse: number,
    acceleration: number
  ): void {
    this.horizontalImpulse = horizontalImpulse;
    this.slowHorizontalImpulse = slowHorizontalImpulse;
    this.upImpulse = upImpulse;
    this.downImpulse = downImpulse;
    this.acceleration = acceleration;
  }

  setGameEvent(event: number, index: number, spawnOnDeath: boolean): void {
    this.gameEvent = event;
    this.gameEventIndex = index;
    this.spawnGameEventOnDeath = spawnOnDeath;
  }

  setReactToHits(react: boolean): void {
    this.reactToHits = react;
  }

  setFlying(flying: boolean): void {
    this.flying = flying;
  }

  setPauseOnAttack(pauseOnAttack: boolean): void {
    this.pauseOnAttack = pauseOnAttack;
  }
}

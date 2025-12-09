/**
 * Player Component - Handles player-specific behavior
 * Ported from: Original/src/com/replica/replicaisland/PlayerComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { InputSystem } from '../../engine/InputSystem';
import type { CollisionSystem } from '../../engine/CollisionSystemNew';
import type { SoundSystem } from '../../engine/SoundSystem';
import type { LevelSystem } from '../../levels/LevelSystemNew';
import { SoundEffects } from '../../engine/SoundSystem';

export enum PlayerState {
  MOVE = 0,          // Normal movement
  STOMP = 1,         // Stomp attack in progress
  HIT_REACT = 2,     // Hit by enemy/hazard
  DEAD = 3,          // Dying animation
  WIN = 4,           // Level complete animation
  FROZEN = 5,        // Input disabled (cutscenes, ghost)
  POST_GHOST_DELAY = 6, // Delay after ghost possession ends
}



export class PlayerComponent extends GameComponent {
  // Constants from Game.tsx
  public static readonly WIDTH = 32;
  public static readonly HEIGHT = 48;
  public static readonly GROUND_IMPULSE_SPEED = 5000;
  public static readonly AIR_HORIZONTAL_IMPULSE_SPEED = 4000;
  public static readonly AIR_VERTICAL_IMPULSE_SPEED = 1200;
  public static readonly AIR_VERTICAL_IMPULSE_FROM_GROUND = 250;
  public static readonly MAX_GROUND_HORIZONTAL_SPEED = 500;
  public static readonly MAX_AIR_HORIZONTAL_SPEED = 150;
  public static readonly MAX_UPWARD_SPEED = 250;
  public static readonly JUMP_TO_JETS_DELAY = 0.5;
  public static readonly AIR_DRAG_SPEED = 4000;
  public static readonly GRAVITY = 500;
  public static readonly FUEL_AMOUNT = 1.0;
  
  public static readonly STOMP_VELOCITY = 1000;
  public static readonly STOMP_DELAY_TIME = 0.15;
  public static readonly STOMP_AIR_HANG_TIME = 0.0;
  public static readonly STOMP_SHAKE_MAGNITUDE = 15;
  public static readonly STOMP_VIBRATE_TIME = 0.05;
  public static readonly ATTACK_PAUSE_DELAY = (1.0 / 60.0) * 4;
  
  public static readonly HIT_REACT_TIME = 0.5;
  public static readonly INVINCIBILITY_TIME = 2.0;
  
  public static readonly GHOST_REACTIVATION_DELAY = 0.3;
  public static readonly GHOST_CHARGE_TIME = 0.75;
  
  public static readonly MAX_GEMS_PER_LEVEL = 3;
  public static readonly NO_GEMS_GHOST_TIME = 3.0;
  public static readonly ONE_GEM_GHOST_TIME = 8.0;
  public static readonly TWO_GEMS_GHOST_TIME = 0.0;

  private inputSystem: InputSystem | null = null;
  private collisionSystem: CollisionSystem | null = null;
  private soundSystem: SoundSystem | null = null;
  private levelSystem: LevelSystem | null = null;
  // private config: PlayerConfig; // Unused for now as we use static constants

  // State
  public currentState: PlayerState = PlayerState.MOVE;
  public stateTimer: number = 0;
  
  public fuel: number = PlayerComponent.FUEL_AMOUNT;
  public jumpTime: number = 0;
  public touchingGround: boolean = false;
  public wasTouchingGround: boolean = false;
  public rocketsOn: boolean = false;
  
  public stomping: boolean = false;
  public stompTime: number = 0;
  public stompHangTime: number = 0;
  public stompLanded: boolean = false;
  
  public invincible: boolean = false;
  public invincibleTime: number = 0;
  public lastHitTime: number = 0;
  public hitReactTimer: number = 0;
  
  public ghostChargeTime: number = 0;
  public ghostActive: boolean = false;
  public postGhostDelay: number = 0;
  
  public animFrame: number = 0;
  public animTimer: number = 0;
  public lastAnimState: string = '';
  
  public jetFrame: number = 0;
  public jetTimer: number = 0;
  
  public sparkFrame: number = 0;
  public sparkTimer: number = 0;
  
  public isDying: boolean = false;
  public deathTime: number = 0;
  public fadeToRestart: boolean = false;
  public fadeTime: number = 0;
  
  public levelWon: boolean = false;
  
  public glowMode: boolean = false;
  public glowTime: number = 0;
  public coinsForPowerup: number = 0;

  constructor() {
    super(ComponentPhase.THINK);
  }

  setSystems(
    input: InputSystem, 
    collision: CollisionSystem, 
    sound: SoundSystem,
    level: LevelSystem
  ): void {
    this.inputSystem = input;
    this.collisionSystem = collision;
    this.soundSystem = sound;
    this.levelSystem = level;
  }

  hasSystemsInjected(): boolean {
    return !!(this.inputSystem && this.collisionSystem && this.soundSystem);
  }

  update(deltaTime: number, parent: GameObject): void {
    if (!this.inputSystem || !this.collisionSystem || !this.soundSystem) return;

    const input = this.inputSystem.getInputState();
    const velocity = parent.getVelocity();
    const position = parent.getPosition();
    const gameTime = this.stateTimer; // Using local timer as gameTime approximation
    this.stateTimer += deltaTime;

    // Save previous ground state for landing detection
    this.wasTouchingGround = this.touchingGround;
    
    // Check if grounded
    this.touchingGround = parent.touchingGround();
    
    // Detect landing
    const justLanded = this.touchingGround && !this.wasTouchingGround;
    if (justLanded) {
      // TODO: Spawn dust effect via EffectsSystem (need to pass it in or use singleton)
      // For now, we'll skip effects in this component update and handle them via events or callbacks
    }

    // Refuel when on ground
    if (this.fuel < PlayerComponent.FUEL_AMOUNT) {
      if (this.touchingGround) {
        this.fuel += 2.0 * deltaTime;
      } else {
        this.fuel += 0.5 * deltaTime;
      }
      this.fuel = Math.min(PlayerComponent.FUEL_AMOUNT, this.fuel);
    }

    // Horizontal movement
    let moveX = 0;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    const inTheAir = !this.touchingGround;
    const horizontalSpeed = inTheAir ? PlayerComponent.AIR_HORIZONTAL_IMPULSE_SPEED : PlayerComponent.GROUND_IMPULSE_SPEED;
    const maxHorizontalSpeed = inTheAir ? PlayerComponent.MAX_AIR_HORIZONTAL_SPEED : PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED;

    // Apply horizontal impulse
    if (moveX !== 0) {
      const impulseX = moveX * horizontalSpeed * deltaTime;
      const newSpeed = Math.abs(velocity.x + impulseX);
      
      if (newSpeed <= maxHorizontalSpeed) {
        velocity.x += impulseX;
      } else if (Math.abs(velocity.x) < maxHorizontalSpeed) {
        velocity.x = maxHorizontalSpeed * moveX;
      }

      // Update facing direction
      parent.facingDirection.x = moveX;
    }

    // Air drag
    if (inTheAir && Math.abs(velocity.x) > maxHorizontalSpeed) {
      const drag = PlayerComponent.AIR_DRAG_SPEED * deltaTime * Math.sign(velocity.x);
      velocity.x -= drag;
      if (Math.abs(velocity.x) < maxHorizontalSpeed) {
        velocity.x = maxHorizontalSpeed * Math.sign(velocity.x);
      }
    }

    // Jump/Fly
    if (input.jump) {
      if (this.touchingGround && !this.rocketsOn) {
        // Initial jump from ground
        velocity.y = -PlayerComponent.AIR_VERTICAL_IMPULSE_FROM_GROUND;
        this.jumpTime = gameTime;
        this.soundSystem.playSfx(SoundEffects.POING, 0.5);
      } else if (gameTime > this.jumpTime + PlayerComponent.JUMP_TO_JETS_DELAY) {
        // Jet pack
        if (this.fuel > 0) {
          this.fuel -= deltaTime;
          velocity.y += -PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED * deltaTime;
          this.rocketsOn = true;
          
          // Cap upward speed
          if (velocity.y < -PlayerComponent.MAX_UPWARD_SPEED) {
            velocity.y = -PlayerComponent.MAX_UPWARD_SPEED;
          }
        }
      }
    } else {
      this.rocketsOn = false;
    }

    // Stomp attack
    if (input.attack && inTheAir && !this.stomping && this.currentState === PlayerState.MOVE) {
      this.currentState = PlayerState.STOMP;
      this.stomping = true;
      this.stompTime = gameTime;
      this.stompHangTime = PlayerComponent.STOMP_AIR_HANG_TIME;
      this.stompLanded = false;
      
      if (PlayerComponent.STOMP_AIR_HANG_TIME > 0) {
        velocity.x = 0;
        velocity.y = 0;
      } else {
        velocity.y = PlayerComponent.STOMP_VELOCITY;
      }
      this.soundSystem.playSfx(SoundEffects.STOMP);
    }

    // Handle stomp hang time
    if (this.stomping && this.stompHangTime > 0) {
      this.stompHangTime -= deltaTime;
      velocity.x = 0;
      velocity.y = 0;
      
      if (this.stompHangTime <= 0) {
        velocity.y = PlayerComponent.STOMP_VELOCITY;
      }
    }

    // Reset stomp when landing
    if (this.stomping && this.touchingGround && !this.stompLanded) {
      this.stompLanded = true;
      // Effects handled in Game.tsx for now (camera shake, dust)
      this.stomping = false;
      this.currentState = PlayerState.MOVE;
    }

    // Ghost mechanic
    if (input.attack && this.touchingGround && !this.stomping && !this.ghostActive) {
      this.ghostChargeTime += deltaTime;
      
      if (this.ghostChargeTime >= PlayerComponent.GHOST_CHARGE_TIME) {
        this.ghostActive = true;
        this.ghostChargeTime = 0;
        this.soundSystem.playSfx(SoundEffects.POSSESSION, 0.7);
        
        // Ghost spawning handled in Game.tsx via state check
        this.currentState = PlayerState.FROZEN;
      }
    } else if (!input.attack) {
      this.ghostChargeTime = 0;
    }
    
    // Post-ghost delay
    if (this.currentState === PlayerState.POST_GHOST_DELAY) {
      this.postGhostDelay -= deltaTime;
      if (this.postGhostDelay <= 0) {
        this.currentState = PlayerState.MOVE;
        this.ghostActive = false;
      }
    }

    // Apply gravity
    if (!this.stomping || this.stompHangTime <= 0) {
      velocity.y += PlayerComponent.GRAVITY * deltaTime;
    }

    // Clamp velocity
    velocity.x = Math.max(-PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED, Math.min(PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED, velocity.x));
    velocity.y = Math.max(-PlayerComponent.MAX_UPWARD_SPEED * 2, Math.min(1000, velocity.y));

    // Friction on ground
    if (this.touchingGround && moveX === 0) {
      velocity.x *= 0.85;
      if (Math.abs(velocity.x) < 1) velocity.x = 0;
    }

    // Move player (Collision logic)
    const tileSize = 32;
    
    // Horizontal movement
    const newX = position.x + velocity.x * deltaTime;
    const hCollision = this.collisionSystem.checkTileCollision(
      newX, position.y, parent.width, parent.height, velocity.x, 0
    );
    
    let horizontalBlocked = false;
    
    if (hCollision.leftWall || hCollision.rightWall) {
      if (this.touchingGround || velocity.y >= 0) {
        const slopeCheck = this.collisionSystem.checkSlopeClimb(
          newX, position.y, parent.width, parent.height, velocity.x
        );
        
        if (slopeCheck.canClimb) {
          position.x = newX;
          position.y = slopeCheck.newY;
          velocity.y = 0;
          parent.setLastTouchedFloorTime(gameTime);
        } else {
          horizontalBlocked = true;
        }
      } else {
        horizontalBlocked = true;
      }
    }
    
    if (horizontalBlocked) {
      if (hCollision.leftWall) {
        const tileX = Math.floor(newX / tileSize);
        position.x = (tileX + 1) * tileSize + 0.1;
        velocity.x = 0;
        parent.setLastTouchedLeftWallTime(gameTime);
      } else if (hCollision.rightWall) {
        const tileX = Math.floor((newX + parent.width) / tileSize);
        position.x = tileX * tileSize - parent.width - 0.1;
        velocity.x = 0;
        parent.setLastTouchedRightWallTime(gameTime);
      }
    } else if (!hCollision.leftWall && !hCollision.rightWall) {
      position.x = newX;
    }
    
    // Vertical movement
    const newY = position.y + velocity.y * deltaTime;
    const vCollision = this.collisionSystem.checkTileCollision(
      position.x, newY, parent.width, parent.height, 0, velocity.y
    );

    if (vCollision.grounded) {
      const bottomTileY = Math.floor((newY + parent.height) / tileSize);
      position.y = bottomTileY * tileSize - parent.height;
      velocity.y = 0;
      parent.setLastTouchedFloorTime(gameTime);
    } else if (vCollision.ceiling) {
      const topTileY = Math.floor(newY / tileSize);
      position.y = (topTileY + 1) * tileSize;
      velocity.y = 0;
      parent.setLastTouchedCeilingTime(gameTime);
    } else {
      position.y = newY;
    }
    
    // Clamp to world bounds
    if (this.levelSystem) {
      const { width: levelWidth, height: levelHeight } = this.levelSystem.getLevelSize();
      
      if (position.x < 0) {
        position.x = 0;
        velocity.x = 0;
      } else if (position.x + parent.width > levelWidth) {
        position.x = levelWidth - parent.width;
        velocity.x = 0;
      }
      
      if (position.y < 0) {
        position.y = 0;
        velocity.y = 0;
      } else if (position.y + parent.height > levelHeight) {
         // Optional: kill player if they fall out of bounds (bottomless pit)
         // For now just clamp
         // position.y = levelHeight - parent.height;
         // velocity.y = 0;
      }
    }

    parent.setBackgroundCollisionNormal(vCollision.normal.y !== 0 ? vCollision.normal : hCollision.normal);
  }

  reset(): void {
    this.currentState = PlayerState.MOVE;
    this.stateTimer = 0;
    this.fuel = PlayerComponent.FUEL_AMOUNT;
    this.jumpTime = 0;
    this.touchingGround = false;
    this.wasTouchingGround = false;
    this.rocketsOn = false;
    this.stomping = false;
    this.stompTime = 0;
    this.stompHangTime = 0;
    this.stompLanded = false;
    this.invincible = false;
    this.invincibleTime = 0;
    this.lastHitTime = 0;
    this.hitReactTimer = 0;
    this.ghostChargeTime = 0;
    this.ghostActive = false;
    this.postGhostDelay = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.lastAnimState = '';
    this.jetFrame = 0;
    this.jetTimer = 0;
    this.sparkFrame = 0;
    this.sparkTimer = 0;
    this.isDying = false;
    this.deathTime = 0;
    this.fadeToRestart = false;
    this.fadeTime = 0;
    this.levelWon = false;
    this.glowMode = false;
    this.glowTime = 0;
    this.coinsForPowerup = 0;
  }
}

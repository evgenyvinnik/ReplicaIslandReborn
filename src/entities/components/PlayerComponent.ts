/**
 * Player Component - Handles player-specific behavior
 * Ported from: Original/src/com/replica/replicaisland/PlayerComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import type { InputSystem } from '../../engine/InputSystem';
import type { CollisionSystem } from '../../engine/CollisionSystemNew';
import type { SoundSystem } from '../../engine/SoundSystem';
import type { LevelSystem } from '../../levels/LevelSystemNew';
import { SoundEffects, SoundPriority } from '../../engine/SoundSystem';
import { getDifficultyAdjustment } from '../dynamicDifficulty';
import type { DifficultyConstants } from '../../stores/useGameStore';
import { SpriteComponent } from './SpriteComponent';
import {
  createPlayerAnimations,
  selectPlayerAnimation,
  type PlayerAnimationName,
} from '../../data/playerAnimations';
import {
  FadeDrawableComponent, FadeLoopType, FadeFunction,
} from './FadeDrawableComponent';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { SortConstants } from '../../engine/SortConstants';
import type { AnimationDefinition } from '../../types';

/**
 * GameObject action for each player state, matching where the original calls
 * setCurrentAction(): gotoMove -> MOVE, gotoStomp -> ATTACK, stateDead ->
 * DEATH, gotoFrozen -> FROZEN.
 */
const PLAYER_STATE_ACTIONS: Record<number, ActionType | undefined> = {};

/** The glow halo sits just in front of Andou. Original: PLAYER + 1. */
const PLAYER_GLOW_PRIORITY = SortConstants.PLAYER + 1;
/** Centre the 64x64 halo on the 32x48 collision box. */
const GLOW_OFFSET_X = -16;
/** The same centring, plus the original's 5px draw offset (Y-up -5 = down). */
const GLOW_OFFSET_Y = -16 + 5;
/** Original: setupFade(1, 0, 0.15, PING_PONG, EASE, glowDuration - 4). */
const GLOW_FLASH_DURATION = 0.15;
const GLOW_FLASH_LEAD_TIME = 4.0;
/** Kids difficulty, used until applyDifficulty() supplies the real value. */
const DEFAULT_GLOW_DURATION = 15.0;
/** Original: AnimationComponent.LAND_THUMP_DELAY - the stomp thump's cooldown. */
const LAND_THUMP_DELAY = 0.5;
/** Original: AnimationComponent.FLICKER_INTERVAL / FLICKER_DURATION. */
const FLICKER_INTERVAL = 0.15;
const FLICKER_DURATION = 3.0;

export enum PlayerState {
  MOVE = 0,          // Normal movement
  STOMP = 1,         // Stomp attack in progress
  HIT_REACT = 2,     // Hit by enemy/hazard
  DEAD = 3,          // Dying animation
  WIN = 4,           // Level complete animation
  FROZEN = 5,        // Input disabled (cutscenes, ghost)
  POST_GHOST_DELAY = 6, // Delay after ghost possession ends
}

PLAYER_STATE_ACTIONS[PlayerState.MOVE] = ActionType.MOVE;
PLAYER_STATE_ACTIONS[PlayerState.STOMP] = ActionType.ATTACK;
PLAYER_STATE_ACTIONS[PlayerState.HIT_REACT] = ActionType.HIT_REACT;
PLAYER_STATE_ACTIONS[PlayerState.DEAD] = ActionType.DEATH;
PLAYER_STATE_ACTIONS[PlayerState.FROZEN] = ActionType.FROZEN;
PLAYER_STATE_ACTIONS[PlayerState.POST_GHOST_DELAY] = ActionType.FROZEN;
// WIN has no counterpart in the original's ActionType; leave it alone.



export class PlayerComponent extends GameComponent {
  // Constants from Game.tsx
  public static readonly WIDTH = 32;
  public static readonly HEIGHT = 48;
  public static readonly GROUND_IMPULSE_SPEED = 5000;
  public static readonly AIR_HORIZONTAL_IMPULSE_SPEED = 4000;
  public static readonly AIR_VERTICAL_IMPULSE_SPEED = 1200;
  public static readonly AIR_VERTICAL_IMPULSE_FROM_GROUND = 250;
  /**
   * A vertical impulse above this counts as leaving the ground on the same
   * frame it is applied. Original: PlayerComponent.VERTICAL_IMPULSE_TOLERANCE.
   */
  public static readonly VERTICAL_IMPULSE_TOLERANCE = 50;
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
  /**
   * How long Andou is untouchable after a hit.
   * Original: spawnPlayer's hitReact.setInvincibleTime(3.0f).
   */
  public static readonly INVINCIBILITY_TIME = 3.0;
  
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
  /** Held-state latches used to reproduce InputButton.getTriggered(). */
  private jumpWasPressed: boolean = false;
  private attackWasPressed: boolean = false;
  
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
  /** The halo layered over Andou while the glow powerup is active. */
  private glowSprite: SpriteComponent | null = null;
  private glowFader: FadeDrawableComponent | null = null;
  /** Glow duration this difficulty grants, used to time the ending flash. */
  private glowDuration: number = DEFAULT_GLOW_DURATION;
  /** Game time before which the stomp thump will not replay. */
  private landThumpDelay: number = 0;
  /** The looping jetpack sound's stream id, or -1 when it is not running. */
  private rocketSoundStream: number = -1;
  /** Post-hit flicker, from the original's AnimationComponent. */
  private flickerTimeRemaining: number = 0;
  private lastFlickerTime: number = 0;
  private flickerOn: boolean = true;
  private previousStateWasHitReact: boolean = false;
  public coinsForPowerup: number = 0;

  /**
   * Jetpack refill rates, from DifficultyConstants. Defaults match Kids, and
   * applyDifficulty() overrides them (including the DDA boost) at spawn.
   */
  private fuelAirRefillSpeed: number = 0.15;
  private fuelGroundRefillSpeed: number = 2.0;

  /** Animation set, rebuilt when the glow powerup turns on or off. */
  private animations: Map<PlayerAnimationName, AnimationDefinition> | null = null;
  private animationsGlowing: boolean = false;
  private playingAnimation: PlayerAnimationName | null = null;

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

  /**
   * Apply the difficulty's fuel rates plus any DDA boost for this level.
   *
   * The original does this in adjustDifficulty(), called once as the player
   * spawns. `attempts` is how many times this level has been started.
   */
  applyDifficulty(constants: DifficultyConstants, attempts: number, parent: GameObject): void {
    const adjustment = getDifficultyAdjustment(constants, attempts);
    this.fuelGroundRefillSpeed = constants.fuelGroundRefillSpeed;
    this.glowDuration = constants.glowDuration;
    this.glowFader = null;  // rebuilt with the new duration on next draw
    this.fuelAirRefillSpeed = adjustment.fuelAirRefillSpeed;
    if (adjustment.lifeBoost > 0) {
      parent.life += adjustment.lifeBoost;
      parent.maxLife = Math.max(parent.maxLife, parent.life);
    }
  }

  hasSystemsInjected(): boolean {
    return !!(this.inputSystem && this.collisionSystem && this.soundSystem);
  }

  update(deltaTime: number, parent: GameObject): void {
    if (!this.inputSystem || !this.collisionSystem || !this.soundSystem) return;

    const input = this.inputSystem.getInputState();
    const jumpTriggered = input.jump && !this.jumpWasPressed;
    const attackTriggered = input.attack && !this.attackWasPressed;
    this.jumpWasPressed = input.jump;
    this.attackWasPressed = input.attack;
    const velocity = parent.getVelocity();
    const position = parent.getPosition();
    // Collision contact timestamps are compared against GameObject.gameTime,
    // which is the global TimeSystem clock. A per-player timer restarts on each
    // level and makes every floor/wall contact immediately look stale after a
    // transition later in the same session.
    const gameTime = parent.getGameTime();
    this.stateTimer += deltaTime;
    const acceptsPlayerInput = this.currentState === PlayerState.MOVE ||
      this.currentState === PlayerState.STOMP;

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

    // Refuel. Rates come from the difficulty's DifficultyConstants, and the
    // air rate is what DDA speeds up after repeated attempts at a level.
    if (this.fuel < PlayerComponent.FUEL_AMOUNT) {
      if (this.touchingGround) {
        this.fuel += this.fuelGroundRefillSpeed * deltaTime;
      } else {
        this.fuel += this.fuelAirRefillSpeed * deltaTime;
      }
      this.fuel = Math.min(PlayerComponent.FUEL_AMOUNT, this.fuel);
    }

    // Horizontal movement
    let moveX = 0;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    // Jump/Fly. This runs before the horizontal speed is chosen because the
    // original decides "in the air" partly from the vertical impulse it just
    // applied - see VERTICAL_IMPULSE_TOLERANCE below.
    let verticalImpulse = 0;
    if (acceptsPlayerInput && input.jump) {
      if (jumpTriggered && this.touchingGround && !this.rocketsOn) {
        // Initial jump from ground
        velocity.y = -PlayerComponent.AIR_VERTICAL_IMPULSE_FROM_GROUND;
        verticalImpulse = PlayerComponent.AIR_VERTICAL_IMPULSE_FROM_GROUND;
        this.jumpTime = gameTime;
        this.soundSystem.playSfx(SoundEffects.POING, 0.5);
      } else if (gameTime > this.jumpTime + PlayerComponent.JUMP_TO_JETS_DELAY) {
        // Jet pack
        if (this.fuel > 0) {
          this.fuel -= deltaTime;
          velocity.y += -PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED * deltaTime;
          verticalImpulse = PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED * deltaTime;
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

    // The frame you leave the ground already counts as airborne, so the jump
    // starts under air control (max 150) rather than getting one more frame of
    // ground control (max 500). A jump impulse is 250, well over the tolerance;
    // a single frame of jet thrust is ~20, well under it - which is why the
    // original compares against a threshold rather than just "impulse != 0".
    // Original: PlayerComponent.VERTICAL_IMPULSE_TOLERANCE.
    const inTheAir = !this.touchingGround
      || verticalImpulse > PlayerComponent.VERTICAL_IMPULSE_TOLERANCE;
    const horizontalSpeed = inTheAir ? PlayerComponent.AIR_HORIZONTAL_IMPULSE_SPEED : PlayerComponent.GROUND_IMPULSE_SPEED;
    const maxHorizontalSpeed = inTheAir ? PlayerComponent.MAX_AIR_HORIZONTAL_SPEED : PlayerComponent.MAX_GROUND_HORIZONTAL_SPEED;

    // Apply horizontal impulse
    if (acceptsPlayerInput && moveX !== 0) {
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

    // Stomp attack
    if (
      acceptsPlayerInput && attackTriggered && inTheAir &&
      !this.stomping && this.currentState === PlayerState.MOVE
    ) {
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
      // The stomp's impact with the ground. The original plays `thump` here -
      // gated on the stomp action, not on landing generally - and rate-limits
      // it so a flurry of stomps does not machine-gun the clip.
      // Original: AnimationComponent, mLandThump / LAND_THUMP_DELAY.
      if (this.soundSystem && gameTime > this.landThumpDelay) {
        // Original plays this at PRIORITY_HIGH so a busy frame cannot swallow it.
        this.soundSystem.playSfx(SoundEffects.THUMP, 1.0, false, SoundPriority.HIGH);
        this.landThumpDelay = gameTime + LAND_THUMP_DELAY;
      }
      // Remaining effects handled in Game.tsx (camera shake, dust)
      this.stomping = false;
      this.currentState = PlayerState.MOVE;
    }

    // Ghost mechanic
    if (this.currentState === PlayerState.MOVE && input.attack && this.touchingGround && !this.stomping && !this.ghostActive) {
      this.ghostChargeTime += deltaTime;
      
      if (this.ghostChargeTime >= PlayerComponent.GHOST_CHARGE_TIME) {
        this.ghostActive = true;
        this.ghostChargeTime = 0;
        // Ghost spawning handled in Game.tsx via state check
        this.currentState = PlayerState.FROZEN;
      }
    } else if (!input.attack) {
      this.ghostChargeTime = 0;
    }

    if (this.ghostActive) {
      velocity.zero();
      parent.getTargetVelocity().zero();
      return;
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
      // Prefer the exact surface from the collision segments so slopes are
      // walked smoothly instead of in 32px steps; fall back to the tile grid
      // when there is no segment data for this tile.
      const feetY = newY + parent.height;
      const surfaceY = this.collisionSystem.getGroundSurfaceY(
        position.x + parent.width / 2,
        feetY
      );
      if (surfaceY !== null) {
        position.y = surfaceY - parent.height;
      } else {
        const bottomTileY = Math.floor(feetY / tileSize);
        position.y = bottomTileY * tileSize - parent.height;
      }
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

    this.updateAnimation(parent, deltaTime);
    this.updateCurrentAction(parent);
  }

  /**
   * Choose Andou's animation from his state and let SpriteComponent play it.
   *
   * The frames carry his collision volumes (see data/playerAnimations.ts), so
   * selecting the animation is also what selects his hitboxes - which is how
   * the original does it. The glow powerup swaps the whole animation set for
   * one whose frames carry the larger HIT sphere.
   */
  private updateAnimation(parent: GameObject, deltaTime: number): void {
    const sprite = parent.getComponent(SpriteComponent);
    if (!sprite) return;

    if (this.animations === null || this.animationsGlowing !== this.glowMode) {
      this.animations = createPlayerAnimations(this.glowMode);
      this.animationsGlowing = this.glowMode;
      for (const [name, animation] of this.animations) {
        sprite.addAnimation(name, animation);
      }
      // Force the animation to be re-selected against the new set.
      this.playingAnimation = null;
    }

    this.updateGlowSprite(parent);
    this.updateFlicker(parent, sprite, deltaTime);
    this.updateRocketSound();

    const next = selectPlayerAnimation({
      hitReacting: this.currentState === PlayerState.HIT_REACT,
      dying: this.currentState === PlayerState.DEAD || this.isDying,
      stomping: this.stomping,
      charging: this.ghostChargeTime > 0,
      touchingGround: this.touchingGround,
      rocketsOn: this.rocketsOn,
      velocityX: parent.getVelocity().x,
      velocityY: parent.getVelocity().y,
    });

    if (next !== this.playingAnimation) {
      this.playingAnimation = next;
      sprite.playAnimation(next);
    }
  }

  /**
   * Flicker Andou for a few seconds after he stops reeling from a hit.
   *
   * The original triggers this on the *exit* from HIT_REACT and runs it for a
   * fixed 3 seconds, independent of how long invincibility lasts. Driving it
   * from the invincible flag instead makes the glow powerup strobe the player
   * for its entire duration, which the original never does.
   *
   * Original: AnimationComponent.update(), mFlickerTimeRemaining.
   */
  private updateFlicker(
    parent: GameObject,
    sprite: SpriteComponent,
    deltaTime: number
  ): void {
    const hitReacting = this.currentState === PlayerState.HIT_REACT;
    if (!hitReacting && this.previousStateWasHitReact) {
      this.flickerTimeRemaining = FLICKER_DURATION;
    }
    this.previousStateWasHitReact = hitReacting;

    const gameTime = parent.getGameTime();
    if (this.flickerTimeRemaining > 0) {
      this.flickerTimeRemaining -= deltaTime;
      if (gameTime > this.lastFlickerTime + FLICKER_INTERVAL) {
        this.lastFlickerTime = gameTime;
        this.flickerOn = !this.flickerOn;
      }
    } else {
      this.flickerOn = true;
    }
    sprite.setVisible(this.flickerOn);
  }

  /**
   * The jetpack's looping hum, started and stopped with the rockets.
   *
   * The original keeps one looping stream and pauses/resumes it
   * (AnimationComponent, mRocketSoundStream). This port's SoundSystem has no
   * per-stream pause, so the stream is stopped and restarted instead - the
   * audible result is the same for a continuous hum.
   */
  private updateRocketSound(): void {
    if (!this.soundSystem) return;
    if (this.rocketsOn) {
      if (this.rocketSoundStream === -1) {
        this.rocketSoundStream = this.soundSystem.playSfx(
          SoundEffects.ROCKETS, 0.6, true, SoundPriority.HIGH
        );
      }
    } else if (this.rocketSoundStream !== -1) {
      this.soundSystem.stopSound(this.rocketSoundStream);
      this.rocketSoundStream = -1;
    }
  }

  /** Stop the jetpack hum, for a death or level change that skips MOVE. */
  stopRocketSound(): void {
    if (this.soundSystem && this.rocketSoundStream !== -1) {
      this.soundSystem.stopSound(this.rocketSoundStream);
    }
    this.rocketSoundStream = -1;
  }

  /** Whether the post-hit flicker is currently hiding Andou. */
  isFlickerHidden(): boolean {
    return !this.flickerOn;
  }

  /**
   * The glow powerup's halo: a second 64x64 sprite layered over Andou, fading
   * to a flash in the last few seconds so the powerup announces its own end.
   *
   * The original spawns this as a set of components swapped onto the player by
   * ChangeComponentsComponent (`spawnPlayer`, PLAYER_GLOW). The port keeps them
   * attached and toggles visibility, which is the same thing from the outside.
   * Andou's own frames already carry the larger HIT volume while glowing, so
   * this is purely the visual.
   */
  private updateGlowSprite(parent: GameObject): void {
    if (!this.glowFader) {
      if (!this.glowSprite) {
        const sprite = new SpriteComponent();
        // PLAYER + 1: the halo sits just in front of Andou.
        sprite.setPriority(PLAYER_GLOW_PRIORITY);
        const renderSystem = sSystemRegistry.renderSystem;
        if (renderSystem) sprite.setRenderSystem(renderSystem);
        sprite.addAnimation('glow', {
          name: 'glow',
          frames: ['effect_glow01', 'effect_glow02', 'effect_glow03'].map((name) => ({
            x: 0, y: 0, width: 64, height: 64,
            duration: 1 / 24,
            sprite: name,
            // Centre the 64x64 halo on the 32x48 box, then the original's
            // 5px draw offset (Y-up -5 is down, which is +5 here).
            offsetX: GLOW_OFFSET_X,
            offsetY: GLOW_OFFSET_Y,
          })),
          loop: true,
        });
        sprite.playAnimation('glow');
        sprite.setVisible(false);
        parent.addComponent(sprite);
        this.glowSprite = sprite;
      }

      const fader = new FadeDrawableComponent();
      fader.setSpriteComponent(this.glowSprite);
      fader.setupFade({
        startOpacity: 1,
        endOpacity: 0,
        duration: GLOW_FLASH_DURATION,
        loopType: FadeLoopType.PING_PONG,
        fadeFunction: FadeFunction.EASE,
        // Hold steady, then flash for the last few seconds of the powerup.
        initialDelay: Math.max(0, this.glowDuration - GLOW_FLASH_LEAD_TIME),
        phaseDuration: this.glowDuration,
      });
      parent.addComponent(fader);
      this.glowFader = fader;
    }

    if (this.glowSprite) this.glowSprite.setVisible(this.glowMode);
  }

  /**
   * Turn the glow powerup on, or extend it if it is already running.
   *
   * Extending has to restart the fader's phase or the halo keeps flashing as
   * though the powerup were still about to expire. The original calls this out
   * as a hack in PlayerComponent; the shape is the same here.
   */
  activateGlow(duration: number): void {
    this.glowMode = true;
    this.glowTime = duration;
    this.glowDuration = duration;
    this.glowFader?.resetPhase();
  }

  /**
   * Mirror the player's state onto GameObject.currentAction.
   *
   * The original sets this in gotoMove/gotoStomp/stateDead/gotoFrozen. Without
   * it the player's action never leaves INVALID, so anything that gates on
   * `requiredAction` - LaunchProjectileComponent, animation selectors - can
   * never fire for Andou.
   */
  private updateCurrentAction(parent: GameObject): void {
    const action = PLAYER_STATE_ACTIONS[this.currentState];
    if (action && parent.getCurrentAction() !== action) {
      parent.setCurrentAction(action);
    }
  }

  reset(): void {
    this.currentState = PlayerState.MOVE;
    // Force the animation to be re-selected on the next update.
    this.playingAnimation = null;
    this.stateTimer = 0;
    this.fuel = PlayerComponent.FUEL_AMOUNT;
    this.jumpTime = 0;
    this.touchingGround = false;
    this.wasTouchingGround = false;
    this.rocketsOn = false;
    this.jumpWasPressed = false;
    this.attackWasPressed = false;
    this.landThumpDelay = 0;
    this.stopRocketSound();
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

  /** Return control to Andou after a ghost expires or is released. */
  deactivateGhost(delay: number = 0): void {
    this.ghostActive = false;
    this.ghostChargeTime = 0;
    this.postGhostDelay = Math.max(0, delay);
    this.currentState = this.postGhostDelay > 0
      ? PlayerState.POST_GHOST_DELAY
      : PlayerState.MOVE;
  }
}

/**
 * RokudouBossComponent - Rokudou boss fight AI controller
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java (spawnEnemyRokudou)
 *
 * Rokudou is a flying boss that:
 * - Hovers in the air (no gravity)
 * - Shoots energy balls and turret bullets
 * - Reacts to being hit with surprise animation
 * - Has 3 life points
 * - Triggers KABOCHA_ENDING cutscene when defeated
 */

import { GameComponent } from '../GameComponent';
import type { GameObject } from '../GameObject';
import { ComponentPhase, ActionType } from '../../types';
import { Vector2 } from '../../utils/Vector2';

// Animation states matching NPCAnimationComponent
export enum RokudouAnimation {
  IDLE = 0,
  FLY = 1,    // WALK equivalent
  SHOOT = 2,
  SURPRISED = 3,
  TAKE_HIT = 4,
  DEATH = 5,
}

// Boss states
enum RokudouState {
  IDLE,
  FLYING,
  ATTACKING,
  SURPRISED,
  HIT_REACT,
  DYING,
  DEAD,
}

// Timing constants (from original)
const SHOOT_DELAY = 1.5; // Delay between energy ball shots
const BULLET_DELAY = 2.5; // Delay between bullet barrages
const BULLET_COUNT = 5;
const BULLET_INTERVAL = 0.1;
const HIT_REACT_TIME = 0.5;
const SURPRISE_TIME = 4.0;
const ATTACK_RANGE = 300;
const MOVEMENT_SPEED = 100;
const VERTICAL_SPEED = 50;

// Projectile configurations
const ENERGY_BALL_VELOCITY = { x: 300, y: -300 };
const BULLET_VELOCITY = { x: 300, y: -300 };
const PROJECTILE_OFFSET = { x: 75, y: 42 };

export interface RokudouBossConfig {
  life?: number;
  attackRange?: number;
  movementSpeed?: number;
}

// Callbacks for spawning projectiles
type ProjectileSpawner = (type: 'energy_ball' | 'bullet', x: number, y: number, vx: number, vy: number) => void;
type SoundPlayer = (sound: string) => void;
type GameEventTrigger = (event: string, index: number) => void;

export class RokudouBossComponent extends GameComponent {
  private state: RokudouState = RokudouState.IDLE;
  private stateTimer: number = 0;
  private attackRange: number = ATTACK_RANGE;
  private movementSpeed: number = MOVEMENT_SPEED;
  
  // Attack state
  private shootTimer: number = 0;
  private bulletTimer: number = 0;
  private bulletsFired: number = 0;
  private isFiringBullets: boolean = false;
  
  // Target tracking
  private targetPosition: Vector2 = new Vector2(0, 0);
  private hasTarget: boolean = false;
  
  // Callbacks
  private projectileSpawner: ProjectileSpawner | null = null;
  private soundPlayer: SoundPlayer | null = null;
  private gameEventTrigger: GameEventTrigger | null = null;
  
  // Hit tracking (reserved for future use)

  constructor(config?: RokudouBossConfig) {
    super(ComponentPhase.THINK);
    
    if (config) {
      this.attackRange = config.attackRange ?? ATTACK_RANGE;
      this.movementSpeed = config.movementSpeed ?? MOVEMENT_SPEED;
    }
  }

  /**
   * Set projectile spawner callback
   */
  setProjectileSpawner(spawner: ProjectileSpawner): void {
    this.projectileSpawner = spawner;
  }

  /**
   * Set sound player callback
   */
  setSoundPlayer(player: SoundPlayer): void {
    this.soundPlayer = player;
  }

  /**
   * Set game event trigger callback
   */
  setGameEventTrigger(trigger: GameEventTrigger): void {
    this.gameEventTrigger = trigger;
  }

  /**
   * Set target position (usually player position)
   */
  setTarget(x: number, y: number): void {
    this.targetPosition.set(x, y);
    this.hasTarget = true;
  }

  /**
   * Clear target
   */
  clearTarget(): void {
    this.hasTarget = false;
  }

  /**
   * Trigger surprise state (from channel)
   */
  triggerSurprise(): void {
    if (this.state !== RokudouState.DYING && this.state !== RokudouState.DEAD) {
      this.state = RokudouState.SURPRISED;
      this.stateTimer = SURPRISE_TIME;
    }
  }

  /**
   * Get current animation state
   */
  getCurrentAnimation(): RokudouAnimation {
    switch (this.state) {
      case RokudouState.IDLE:
        return RokudouAnimation.IDLE;
      case RokudouState.FLYING:
        return RokudouAnimation.FLY;
      case RokudouState.ATTACKING:
        return RokudouAnimation.SHOOT;
      case RokudouState.SURPRISED:
        return RokudouAnimation.SURPRISED;
      case RokudouState.HIT_REACT:
        return RokudouAnimation.TAKE_HIT;
      case RokudouState.DYING:
      case RokudouState.DEAD:
        return RokudouAnimation.DEATH;
      default:
        return RokudouAnimation.IDLE;
    }
  }

  /**
   * Handle receiving a hit
   */
  onHit(): void {
    if (this.state === RokudouState.DYING || this.state === RokudouState.DEAD) {
      return;
    }
    
    this.state = RokudouState.HIT_REACT;
    this.stateTimer = HIT_REACT_TIME;
    
    if (this.soundPlayer) {
      this.soundPlayer('sound_rokudou_hit');
    }
  }

  /**
   * Update component
   */
  update(deltaTime: number, parent: GameObject): void {
    this.stateTimer -= deltaTime;
    
    // Check for death
    if (parent.life <= 0 && this.state !== RokudouState.DEAD) {
      this.enterDeath(parent);
      return;
    }

    switch (this.state) {
      case RokudouState.IDLE:
        this.updateIdle(deltaTime, parent);
        break;
        
      case RokudouState.FLYING:
        this.updateFlying(deltaTime, parent);
        break;
        
      case RokudouState.ATTACKING:
        this.updateAttacking(deltaTime, parent);
        break;
        
      case RokudouState.SURPRISED:
        this.updateSurprised(deltaTime, parent);
        break;
        
      case RokudouState.HIT_REACT:
        this.updateHitReact(deltaTime, parent);
        break;
        
      case RokudouState.DYING:
        this.updateDying(deltaTime, parent);
        break;
        
      case RokudouState.DEAD:
        // Do nothing
        break;
    }
  }

  private updateIdle(_deltaTime: number, parent: GameObject): void {
    if (this.hasTarget) {
      const pos = parent.getPosition();
      const dx = this.targetPosition.x - pos.x;
      const distance = Math.abs(dx);
      
      if (distance < this.attackRange) {
        // Start attacking
        this.state = RokudouState.ATTACKING;
        parent.setCurrentAction(ActionType.ATTACK);
      } else {
        // Move towards target
        this.state = RokudouState.FLYING;
      }
    }
  }

  private updateFlying(_deltaTime: number, parent: GameObject): void {
    if (!this.hasTarget) {
      this.state = RokudouState.IDLE;
      return;
    }
    
    const pos = parent.getPosition();
    const dx = this.targetPosition.x - pos.x;
    const dy = this.targetPosition.y - pos.y;
    const distance = Math.abs(dx);
    
    if (distance < this.attackRange) {
      // In range, start attacking
      this.state = RokudouState.ATTACKING;
      parent.setCurrentAction(ActionType.ATTACK);
      parent.setVelocity(0, 0);
    } else {
      // Move towards target
      const dirX = dx > 0 ? 1 : -1;
      const dirY = dy > 0 ? 1 : -1;
      
      parent.facingDirection.x = dirX;
      parent.setVelocity(
        dirX * this.movementSpeed,
        Math.abs(dy) > 10 ? dirY * VERTICAL_SPEED : 0
      );
    }
  }

  private updateAttacking(deltaTime: number, parent: GameObject): void {
    // Update attack timers
    this.shootTimer += deltaTime;
    
    // Fire energy ball periodically
    if (this.shootTimer >= SHOOT_DELAY) {
      this.shootTimer = 0;
      this.fireEnergyBall(parent);
    }
    
    // Fire bullet barrage
    if (this.isFiringBullets) {
      this.bulletTimer += deltaTime;
      if (this.bulletTimer >= BULLET_INTERVAL) {
        this.bulletTimer = 0;
        this.fireBullet(parent);
        this.bulletsFired++;
        
        if (this.bulletsFired >= BULLET_COUNT) {
          this.isFiringBullets = false;
          this.bulletsFired = 0;
        }
      }
    } else {
      this.bulletTimer += deltaTime;
      if (this.bulletTimer >= BULLET_DELAY) {
        this.bulletTimer = 0;
        this.isFiringBullets = true;
        this.bulletsFired = 0;
      }
    }
    
    // Check if target moved out of range
    if (this.hasTarget) {
      const pos = parent.getPosition();
      const dx = this.targetPosition.x - pos.x;
      const distance = Math.abs(dx);
      
      // Face the target
      parent.facingDirection.x = dx > 0 ? 1 : -1;
      
      if (distance > this.attackRange * 1.5) {
        // Target moved away, chase
        this.state = RokudouState.FLYING;
        parent.setCurrentAction(ActionType.MOVE);
      }
    }
  }

  private updateSurprised(_deltaTime: number, _parent: GameObject): void {
    if (this.stateTimer <= 0) {
      this.state = RokudouState.IDLE;
    }
  }

  private updateHitReact(_deltaTime: number, _parent: GameObject): void {
    if (this.stateTimer <= 0) {
      this.state = RokudouState.IDLE;
    }
  }

  private updateDying(deltaTime: number, parent: GameObject): void {
    // Apply gravity during death fall
    const vel = parent.getVelocity();
    vel.y += 500 * deltaTime; // Gravity
    parent.setVelocity(vel.x, vel.y);
    
    // Check if touched ground (death animation complete)
    if (parent.touchingGround()) {
      this.state = RokudouState.DEAD;
      parent.setVelocity(0, 0);
      
      // Trigger game ending
      if (this.gameEventTrigger) {
        // EVENT_SHOW_ANIMATION with KABOCHA_ENDING
        this.gameEventTrigger('show_animation', 2); // KABOCHA_ENDING = 2
      }
    }
  }

  private enterDeath(parent: GameObject): void {
    this.state = RokudouState.DYING;
    parent.setCurrentAction(ActionType.DEATH);
    // Enable gravity for death fall
  }

  private fireEnergyBall(parent: GameObject): void {
    if (!this.projectileSpawner) return;
    
    const pos = parent.getPosition();
    const facingX = parent.facingDirection.x;
    
    const spawnX = pos.x + PROJECTILE_OFFSET.x * facingX;
    const spawnY = pos.y + PROJECTILE_OFFSET.y;
    
    this.projectileSpawner(
      'energy_ball',
      spawnX,
      spawnY,
      ENERGY_BALL_VELOCITY.x * facingX,
      ENERGY_BALL_VELOCITY.y
    );
    
    if (this.soundPlayer) {
      this.soundPlayer('sound_poing');
    }
  }

  private fireBullet(parent: GameObject): void {
    if (!this.projectileSpawner) return;
    
    const pos = parent.getPosition();
    const facingX = parent.facingDirection.x;
    
    const spawnX = pos.x + PROJECTILE_OFFSET.x * facingX;
    const spawnY = pos.y + PROJECTILE_OFFSET.y;
    
    this.projectileSpawner(
      'bullet',
      spawnX,
      spawnY,
      BULLET_VELOCITY.x * facingX,
      BULLET_VELOCITY.y
    );
    
    if (this.soundPlayer) {
      this.soundPlayer('sound_gun');
    }
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.state = RokudouState.IDLE;
    this.stateTimer = 0;
    this.shootTimer = 0;
    this.bulletTimer = 0;
    this.bulletsFired = 0;
    this.isFiringBullets = false;
    this.hasTarget = false;

  }
}

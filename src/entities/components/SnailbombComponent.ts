/**
 * SnailbombComponent - Snailbomb enemy AI controller
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java (spawnEnemySnailBomb)
 *
 * Snailbomb is a ground-based enemy that:
 * - Patrols back and forth on platforms
 * - Stops and shoots cannon balls when player is in range
 * - Fires 3 cannon balls in quick succession
 * - Returns to patrol after attack cooldown
 */

import { GameComponent } from '../GameComponent';
import type { GameObject } from '../GameObject';
import { ComponentPhase, ActionType } from '../../types';

// Animation states matching EnemyAnimationComponent
export enum SnailbombAnimation {
  IDLE = 0,
  MOVE = 1,
  ATTACK = 2,
}

// Snailbomb states
enum SnailbombState {
  IDLE,
  PATROL,
  ATTACK_WINDUP,
  ATTACKING,
  ATTACK_COOLDOWN,
  DEAD,
}

// Timing constants (from original)
const PATROL_SPEED = 20;        // Movement speed while patrolling
const ATTACK_RANGE = 300;       // Distance at which snailbomb will attack
const ATTACK_DELAY = 1.0;       // Delay before first shot
const ATTACK_COOLDOWN = 4.0;    // Cooldown between attack sequences
const SHOT_COUNT = 3;           // Number of cannon balls per attack
const SHOT_INTERVAL = 0.25;     // Time between shots
const PROJECTILE_VELOCITY = 100; // Speed of cannon balls

// Spawn offset for projectiles
const PROJECTILE_OFFSET = { x: 40, y: 8 };

export interface SnailbombConfig {
  patrolSpeed?: number;
  attackRange?: number;
  shotCount?: number;
}

// Callbacks
type ProjectileSpawner = (x: number, y: number, vx: number, vy: number) => void;
type SoundPlayer = (sound: string) => void;

export class SnailbombComponent extends GameComponent {
  private state: SnailbombState = SnailbombState.PATROL;
  private stateTimer: number = 0;
  private patrolSpeed: number = PATROL_SPEED;
  private attackRange: number = ATTACK_RANGE;
  
  // Attack state
  private shotCount: number = SHOT_COUNT;
  private shotsFired: number = 0;
  private shotTimer: number = 0;
  
  // Patrol state
  private movingRight: boolean = true;
  private patrolDistance: number = 0;
  private maxPatrolDistance: number = 200;
  
  // Target tracking
  private targetX: number = 0;
  private targetY: number = 0;
  private hasTarget: boolean = false;
  
  // Callbacks
  private projectileSpawner: ProjectileSpawner | null = null;
  private soundPlayer: SoundPlayer | null = null;
  
  // Edge detection
  private wasOnGround: boolean = false;
  private edgeDetected: boolean = false;

  constructor(config?: SnailbombConfig) {
    super(ComponentPhase.THINK);
    
    if (config) {
      this.patrolSpeed = config.patrolSpeed ?? PATROL_SPEED;
      this.attackRange = config.attackRange ?? ATTACK_RANGE;
      this.shotCount = config.shotCount ?? SHOT_COUNT;
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
   * Set target position (usually player position)
   */
  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    this.hasTarget = true;
  }

  /**
   * Clear target
   */
  clearTarget(): void {
    this.hasTarget = false;
  }

  /**
   * Set patrol bounds
   */
  setPatrolDistance(distance: number): void {
    this.maxPatrolDistance = distance;
  }

  /**
   * Get current animation state
   */
  getCurrentAnimation(): SnailbombAnimation {
    switch (this.state) {
      case SnailbombState.IDLE:
      case SnailbombState.ATTACK_COOLDOWN:
        return SnailbombAnimation.IDLE;
      case SnailbombState.PATROL:
        return SnailbombAnimation.MOVE;
      case SnailbombState.ATTACK_WINDUP:
      case SnailbombState.ATTACKING:
        return SnailbombAnimation.ATTACK;
      case SnailbombState.DEAD:
        return SnailbombAnimation.IDLE;
      default:
        return SnailbombAnimation.IDLE;
    }
  }

  /**
   * Notify of wall collision
   */
  onWallCollision(): void {
    // Reverse direction when hitting a wall
    this.reverseDirection();
  }

  /**
   * Notify of edge detection (about to fall off platform)
   */
  onEdgeDetected(): void {
    this.edgeDetected = true;
  }

  /**
   * Update component
   */
  update(deltaTime: number, parent: GameObject): void {
    this.stateTimer -= deltaTime;
    
    // Check for death
    if (parent.life <= 0 && this.state !== SnailbombState.DEAD) {
      this.state = SnailbombState.DEAD;
      parent.setCurrentAction(ActionType.DEATH);
      return;
    }

    // Track ground state for edge detection
    const onGround = parent.touchingGround();
    if (this.wasOnGround && !onGround) {
      // We walked off an edge, reverse
      this.reverseDirection();
    }
    this.wasOnGround = onGround;

    // Check for edge detection flag
    if (this.edgeDetected) {
      this.edgeDetected = false;
      this.reverseDirection();
    }

    switch (this.state) {
      case SnailbombState.IDLE:
        this.updateIdle(deltaTime, parent);
        break;
        
      case SnailbombState.PATROL:
        this.updatePatrol(deltaTime, parent);
        break;
        
      case SnailbombState.ATTACK_WINDUP:
        this.updateAttackWindup(deltaTime, parent);
        break;
        
      case SnailbombState.ATTACKING:
        this.updateAttacking(deltaTime, parent);
        break;
        
      case SnailbombState.ATTACK_COOLDOWN:
        this.updateCooldown(deltaTime, parent);
        break;
        
      case SnailbombState.DEAD:
        // Do nothing
        break;
    }
  }

  private updateIdle(_deltaTime: number, parent: GameObject): void {
    // Check if player is in range
    if (this.hasTarget && this.isTargetInRange(parent)) {
      this.startAttack(parent);
    } else {
      // Start patrolling
      this.state = SnailbombState.PATROL;
    }
  }

  private updatePatrol(_deltaTime: number, parent: GameObject): void {
    // Check if player is in range
    if (this.hasTarget && this.isTargetInRange(parent)) {
      this.startAttack(parent);
      return;
    }
    
    // Update patrol movement
    const direction = this.movingRight ? 1 : -1;
    parent.facingDirection.x = direction;
    parent.setVelocity(direction * this.patrolSpeed, parent.getVelocity().y);
    parent.setCurrentAction(ActionType.MOVE);
    
    // Track patrol distance
    this.patrolDistance += Math.abs(this.patrolSpeed * 0.016); // Approximate delta
    if (this.patrolDistance >= this.maxPatrolDistance) {
      this.reverseDirection();
    }
  }

  private updateAttackWindup(_deltaTime: number, parent: GameObject): void {
    parent.setVelocity(0, parent.getVelocity().y);
    
    if (this.stateTimer <= 0) {
      this.state = SnailbombState.ATTACKING;
      this.shotsFired = 0;
      this.shotTimer = 0;
    }
  }

  private updateAttacking(deltaTime: number, parent: GameObject): void {
    parent.setVelocity(0, parent.getVelocity().y);
    
    this.shotTimer += deltaTime;
    
    if (this.shotTimer >= SHOT_INTERVAL) {
      this.shotTimer = 0;
      this.fireCannonBall(parent);
      this.shotsFired++;
      
      if (this.shotsFired >= this.shotCount) {
        // Done attacking, enter cooldown
        this.state = SnailbombState.ATTACK_COOLDOWN;
        this.stateTimer = ATTACK_COOLDOWN;
        parent.setCurrentAction(ActionType.IDLE);
      }
    }
  }

  private updateCooldown(_deltaTime: number, parent: GameObject): void {
    parent.setVelocity(0, parent.getVelocity().y);
    
    if (this.stateTimer <= 0) {
      // Resume patrol
      this.state = SnailbombState.PATROL;
    }
  }

  private startAttack(parent: GameObject): void {
    // Face the target
    const pos = parent.getPosition();
    const dx = this.targetX - pos.x;
    parent.facingDirection.x = dx > 0 ? 1 : -1;
    
    // Enter attack windup
    this.state = SnailbombState.ATTACK_WINDUP;
    this.stateTimer = ATTACK_DELAY;
    parent.setCurrentAction(ActionType.ATTACK);
    parent.setVelocity(0, parent.getVelocity().y);
  }

  private isTargetInRange(parent: GameObject): boolean {
    const pos = parent.getPosition();
    const dx = this.targetX - pos.x;
    const dy = this.targetY - pos.y;
    
    // Check horizontal distance and vertical proximity
    return Math.abs(dx) < this.attackRange && Math.abs(dy) < 100;
  }

  private reverseDirection(): void {
    this.movingRight = !this.movingRight;
    this.patrolDistance = 0;
  }

  private fireCannonBall(parent: GameObject): void {
    if (!this.projectileSpawner) return;
    
    const pos = parent.getPosition();
    const facingX = parent.facingDirection.x;
    
    const spawnX = pos.x + PROJECTILE_OFFSET.x * facingX;
    const spawnY = pos.y + PROJECTILE_OFFSET.y;
    
    this.projectileSpawner(
      spawnX,
      spawnY,
      PROJECTILE_VELOCITY * facingX,
      0 // No vertical velocity for cannon balls
    );
    
    if (this.soundPlayer) {
      this.soundPlayer('sound_cannon');
    }
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.state = SnailbombState.PATROL;
    this.stateTimer = 0;
    this.shotsFired = 0;
    this.shotTimer = 0;
    this.movingRight = true;
    this.patrolDistance = 0;
    this.hasTarget = false;
    this.wasOnGround = false;
    this.edgeDetected = false;
  }
}

/**
 * Hit Reaction Component - Responds to collision/damage events
 * Ported from: Original/src/com/replica/replicaisland/HitReactionComponent.java
 * 
 * Handles damage, invincibility, death, bounce-back, etc.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, HitType, ActionType, Team } from '../../types';
import type { GameObject } from '../GameObject';
import { Vector2 } from '../../utils/Vector2';

// TODO: Implement pause-on-attack
// const ATTACK_PAUSE_DELAY = (1.0 / 60) * 4;
const DEFAULT_BOUNCE_MAGNITUDE = 200;
const DEFAULT_INVINCIBILITY_TIME = 2.0;  // 2 seconds after hit

export interface HitReactionConfig {
  pauseOnAttack?: boolean;
  pauseOnAttackTime?: number;
  bounceOnHit?: boolean;
  bounceMagnitude?: number;
  invincibleAfterHitTime?: number;
  dieOnCollect?: boolean;
  dieOnAttack?: boolean;
  forceInvincibility?: boolean;
  onHitSound?: string;
  onDealHitSound?: string;
}

export class HitReactionComponent extends GameComponent {
  // TODO: Implement pause-on-attack feature (time freeze on hit)
  // pauseOnAttack: boolean
  // pauseOnAttackTime: number
  private bounceOnHit: boolean = false;
  private bounceMagnitude: number = DEFAULT_BOUNCE_MAGNITUDE;
  private invincibleAfterHitTime: number = 0;
  private lastHitTime: number = 0;
  private invincible: boolean = false;
  private invincibleTime: number = 0;
  private dieOnCollect: boolean = false;
  private dieOnAttack: boolean = false;
  private forceInvincibility: boolean = false;
  
  private onHitSound: string | null = null;
  private onDealHitSound: string | null = null;
  
  // Sound system reference (set externally)
  private soundPlayer: ((sound: string) => void) | null = null;
  
  // Time getter (set externally)
  private gameTimeGetter: (() => number) | null = null;
  
  // Working vector for calculations
  private workingVector: Vector2 = new Vector2(0, 0);

  constructor(config?: HitReactionConfig) {
    super(ComponentPhase.PRE_DRAW);
    
    if (config) {
      this.configure(config);
    }
  }

  /**
   * Configure hit reaction behavior
   */
  configure(config: HitReactionConfig): void {
    // TODO: pause on attack feature
    // this._pauseOnAttack = config.pauseOnAttack ?? false;
    // this._pauseOnAttackTime = config.pauseOnAttackTime ?? ATTACK_PAUSE_DELAY;
    this.bounceOnHit = config.bounceOnHit ?? false;
    this.bounceMagnitude = config.bounceMagnitude ?? DEFAULT_BOUNCE_MAGNITUDE;
    this.invincibleAfterHitTime = config.invincibleAfterHitTime ?? 0;
    this.dieOnCollect = config.dieOnCollect ?? false;
    this.dieOnAttack = config.dieOnAttack ?? false;
    this.forceInvincibility = config.forceInvincibility ?? false;
    this.onHitSound = config.onHitSound ?? null;
    this.onDealHitSound = config.onDealHitSound ?? null;
  }

  /**
   * Set sound player function
   */
  setSoundPlayer(player: (sound: string) => void): void {
    this.soundPlayer = player;
  }

  /**
   * Set game time getter
   */
  setGameTimeGetter(getter: () => number): void {
    this.gameTimeGetter = getter;
  }

  /**
   * Set invincibility
   */
  setInvincible(invincible: boolean): void {
    this.invincible = invincible;
  }

  /**
   * Check if currently invincible
   */
  isInvincible(): boolean {
    return this.invincible || this.forceInvincibility;
  }

  /**
   * Get time since last hit
   */
  getTimeSinceLastHit(): number {
    if (!this.gameTimeGetter) return Infinity;
    return this.gameTimeGetter() - this.lastHitTime;
  }

  /**
   * Called when this object attacks another object
   */
  hitVictim(parent: GameObject, _victim: GameObject, _hitType: HitType, hitAccepted: boolean): void {
    if (hitAccepted) {
      // Could pause game briefly on hit
      // if (this.pauseOnAttack && hitType === HitType.HIT) { ... }

      if (this.dieOnAttack) {
        parent.life = 0;
      }

      if (this.onDealHitSound && this.soundPlayer) {
        this.soundPlayer(this.onDealHitSound);
      }
    }
  }

  /**
   * Called when this object receives a hit from an attacker
   * Returns true if the hit was processed, false if ignored
   */
  receivedHit(parent: GameObject, attacker: GameObject, hitType: HitType): boolean {
    const gameTime = this.gameTimeGetter?.() ?? 0;
    let processedHitType = hitType;

    switch (hitType) {
      case HitType.INVALID:
        break;

      case HitType.HIT: {
        // Don't hit our friends
        const sameTeam = parent.team === attacker.team && parent.team !== Team.NONE;
        if (!this.forceInvincibility && !this.invincible && parent.life > 0 && !sameTeam) {
          parent.life -= 1;

          if (this.bounceOnHit && parent.life > 0) {
            // Calculate bounce direction
            const parentPos = parent.getPosition();
            const attackerPos = attacker.getPosition();
            
            this.workingVector.x = parentPos.x - attackerPos.x;
            this.workingVector.y = parentPos.y - attackerPos.y;
            
            // Normalize to direction signs
            this.workingVector.x = 0.5 * Math.sign(this.workingVector.x);
            this.workingVector.y = 0.5 * Math.sign(this.workingVector.y);
            
            // Apply bounce
            this.workingVector.x *= this.bounceMagnitude;
            this.workingVector.y *= this.bounceMagnitude;
            
            parent.setVelocity(this.workingVector.x, this.workingVector.y);
            parent.setTargetVelocity(0, 0);
          }

          // Grant invincibility
          if (this.invincibleAfterHitTime > 0) {
            this.invincible = true;
            this.invincibleTime = this.invincibleAfterHitTime;
          }
        } else {
          // Ignore this hit
          processedHitType = HitType.INVALID;
        }
        break;
      }

      case HitType.DEATH:
        // Instant death
        parent.life = 0;
        break;

      case HitType.COLLECT:
        // This is handled by the collectible itself
        if (this.dieOnCollect && parent.life > 0) {
          parent.life = 0;
        }
        break;

      case HitType.POSSESS:
        // Special case for possession - not implemented yet
        processedHitType = HitType.INVALID;
        break;

      case HitType.LAUNCH:
        // Launch pads - handled elsewhere
        break;

      default:
        break;
    }

    // Process the hit
    if (processedHitType !== HitType.INVALID) {
      if (this.onHitSound && this.soundPlayer) {
        this.soundPlayer(this.onHitSound);
      }
      
      this.lastHitTime = gameTime;
      parent.setCurrentAction(ActionType.HIT_REACT);
      parent.lastReceivedHitType = processedHitType;
    }

    return processedHitType !== HitType.INVALID;
  }

  /**
   * Update component - handle invincibility timer
   */
  update(deltaTime: number, parent: GameObject): void {
    // Handle invincibility timer
    if (this.invincible && this.invincibleTime > 0) {
      this.invincibleTime -= deltaTime;
      if (this.invincibleTime <= 0) {
        this.invincible = false;
      }
    }

    // Check for death
    if (parent.life <= 0 && parent.getCurrentAction() !== ActionType.DEATH) {
      parent.setCurrentAction(ActionType.DEATH);
    }
  }

  /**
   * Reset component state
   */
  reset(): void {
    // TODO: pause on attack feature
    // this._pauseOnAttack = false;
    // this._pauseOnAttackTime = ATTACK_PAUSE_DELAY;
    this.bounceOnHit = false;
    this.bounceMagnitude = DEFAULT_BOUNCE_MAGNITUDE;
    this.invincibleAfterHitTime = 0;
    this.lastHitTime = 0;
    this.invincible = false;
    this.invincibleTime = 0;
    this.dieOnCollect = false;
    this.dieOnAttack = false;
    this.forceInvincibility = false;
    this.workingVector.x = 0;
    this.workingVector.y = 0;
  }

  // Configuration setters for builder pattern
  setPlayerConfig(): HitReactionComponent {
    this.bounceOnHit = true;
    this.bounceMagnitude = DEFAULT_BOUNCE_MAGNITUDE;
    this.invincibleAfterHitTime = DEFAULT_INVINCIBILITY_TIME;
    return this;
  }

  setEnemyConfig(): HitReactionComponent {
    this.dieOnAttack = false;
    this.bounceOnHit = false;
    return this;
  }

  setCollectibleConfig(): HitReactionComponent {
    this.dieOnCollect = true;
    return this;
  }
}

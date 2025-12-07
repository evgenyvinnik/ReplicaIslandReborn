/**
 * Evil Kabocha Component - Boss variant of Kabocha enemy
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java (spawnEvilKabocha)
 *
 * The Evil Kabocha is a boss-level enemy that:
 * - Is larger than regular Kabocha (128x128 vs 64x128)
 * - Takes 3 hits to defeat (vs 1 for regular)
 * - Reacts to hits with knockback and pause
 * - Triggers the Rokudou ending cutscene on death
 * - Has additional animation states (surprised, hit, death)
 * - Movement is HotSpot-driven (patrols based on level design)
 *
 * This component handles boss-specific behavior on top of the standard
 * NPCComponent/PatrolComponent behaviors.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType, HitType } from '../../types';
import type { GameObject } from '../GameObject';
import type { SystemRegistry } from '../../engine/SystemRegistry';

// Global system registry reference
let sSystemRegistry: SystemRegistry | null = null;

export function setEvilKabochaSystemRegistry(registry: SystemRegistry): void {
  sSystemRegistry = registry;
}

/** Boss-specific animation indices */
export enum EvilKabochaAnimation {
  IDLE = 0,
  WALK = 1,
  SURPRISED = 8,
  TAKE_HIT = 7,
  DEATH = 9,
}

export interface EvilKabochaConfig {
  /** Boss life points (default: 3) */
  life: number;
  /** Hit reaction pause duration */
  hitPauseDuration: number;
  /** Knockback impulse when hit */
  knockbackImpulse: number;
  /** Death delay before triggering ending */
  deathDelay: number;
  /** Whether to trigger ending cutscene on death */
  triggerEnding: boolean;
  /** Ending animation type (ROKUDOU_ENDING) */
  endingType: string;
}

const DEFAULT_CONFIG: EvilKabochaConfig = {
  life: 3,
  hitPauseDuration: 1.0,
  knockbackImpulse: 300,
  deathDelay: 4.0,
  triggerEnding: true,
  endingType: 'ROKUDOU_ENDING',
};

/** Boss state machine states */
enum BossState {
  PATROL = 'PATROL',
  HIT_REACT = 'HIT_REACT',
  DYING = 'DYING',
  DEAD = 'DEAD',
}

export class EvilKabochaComponent extends GameComponent {
  private config: EvilKabochaConfig;
  private state: BossState = BossState.PATROL;
  private stateTimer: number = 0;
  private surprised: boolean = false;
  private surpriseTimer: number = 0;
  // Track hits to determine when to die
  private hitsRemaining: number;

  constructor(config?: Partial<EvilKabochaConfig>) {
    super(ComponentPhase.THINK);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.hitsRemaining = this.config.life;
  }

  /**
   * Configure the Evil Kabocha
   */
  configure(config: Partial<EvilKabochaConfig>): void {
    this.config = { ...this.config, ...config };
    this.hitsRemaining = this.config.life;
  }

  /**
   * Update boss behavior
   */
  update(deltaTime: number, parent: GameObject): void {
    this.stateTimer += deltaTime;

    switch (this.state) {
      case BossState.PATROL:
        this.updatePatrol(deltaTime, parent);
        break;

      case BossState.HIT_REACT:
        this.updateHitReact(deltaTime, parent);
        break;

      case BossState.DYING:
        this.updateDying(deltaTime, parent);
        break;

      case BossState.DEAD:
        // Do nothing - wait for removal
        break;
    }

    // Update surprise state (can happen during patrol)
    if (this.surprised) {
      this.surpriseTimer -= deltaTime;
      if (this.surpriseTimer <= 0) {
        this.surprised = false;
      }
    }

    // Check for death
    if (parent.life <= 0 && this.state !== BossState.DYING && this.state !== BossState.DEAD) {
      this.enterDying(parent);
    }
  }

  /**
   * Handle patrol state - normal boss behavior
   */
  private updatePatrol(_deltaTime: number, parent: GameObject): void {
    // Check if we were hit
    if (parent.lastReceivedHitType === HitType.HIT || parent.lastReceivedHitType === HitType.ATTACK) {
      this.handleHit(parent);
      parent.lastReceivedHitType = HitType.INVALID;
    }

    // Set animation based on movement
    if (this.surprised) {
      parent.setCurrentAction(ActionType.FROZEN); // Use FROZEN for surprised
    } else if (Math.abs(parent.getVelocity().x) > 10) {
      parent.setCurrentAction(ActionType.MOVE);
    } else {
      parent.setCurrentAction(ActionType.IDLE);
    }
  }

  /**
   * Handle being hit
   */
  private handleHit(parent: GameObject): void {
    this.hitsRemaining--;

    // Play hit sound
    const soundSystem = sSystemRegistry?.soundSystem;
    if (soundSystem) {
      soundSystem.playSfx('sound_kabocha_hit', 1.0, false);
    }

    if (this.hitsRemaining <= 0) {
      // Boss defeated
      parent.life = 0;
      this.enterDying(parent);
    } else {
      // React to hit but survive
      this.enterHitReact(parent);
    }
  }

  /**
   * Enter hit reaction state
   */
  private enterHitReact(parent: GameObject): void {
    this.state = BossState.HIT_REACT;
    this.stateTimer = 0;

    // Apply knockback
    const velocity = parent.getVelocity();
    const knockbackDir = parent.facingDirection.x > 0 ? -1 : 1;
    parent.getImpulse().x = knockbackDir * this.config.knockbackImpulse;

    // Stop horizontal movement
    velocity.x = 0;
    parent.getTargetVelocity().x = 0;

    // Set hit reaction action
    parent.setCurrentAction(ActionType.HIT_REACT);
  }

  /**
   * Update hit reaction state
   */
  private updateHitReact(_deltaTime: number, parent: GameObject): void {
    // Remain in hit reaction until timer expires
    if (this.stateTimer >= this.config.hitPauseDuration) {
      this.state = BossState.PATROL;
      parent.setCurrentAction(ActionType.IDLE);
    }
  }

  /**
   * Enter dying state
   */
  private enterDying(parent: GameObject): void {
    this.state = BossState.DYING;
    this.stateTimer = 0;

    // Stop all movement
    parent.getVelocity().zero();
    parent.getTargetVelocity().zero();
    parent.setCurrentAction(ActionType.DEATH);
  }

  /**
   * Update dying state
   */
  private updateDying(_deltaTime: number, parent: GameObject): void {
    // Wait for death delay before triggering ending
    if (this.stateTimer >= this.config.deathDelay) {
      this.state = BossState.DEAD;

      if (this.config.triggerEnding) {
        this.triggerEnding();
      }

      // Mark for removal
      parent.markForRemoval();
    }
  }

  /**
   * Trigger the ending cutscene
   */
  private triggerEnding(): void {
    const gameFlowEvent = sSystemRegistry?.gameFlowEvent;
    if (gameFlowEvent) {
      // Trigger the ending animation/cutscene
      // In the original, this was: GameFlowEvent.EVENT_SHOW_ANIMATION with ROKUDOU_ENDING
      // TODO: Implement when cutscene system is available
      // gameFlowEvent.postEvent(GameFlowEvent.EVENT_SHOW_ANIMATION, this.config.endingType);
    }
  }

  /**
   * Set the boss to surprised state (triggered by channel system)
   */
  triggerSurprise(duration: number = 4.0): void {
    this.surprised = true;
    this.surpriseTimer = duration;
  }

  /**
   * Check if boss is surprised
   */
  isSurprised(): boolean {
    return this.surprised;
  }

  /**
   * Get remaining hits
   */
  getHitsRemaining(): number {
    return this.hitsRemaining;
  }

  /**
   * Get current boss state
   */
  getState(): BossState {
    return this.state;
  }

  /**
   * Reset the component
   */
  reset(): void {
    this.state = BossState.PATROL;
    this.stateTimer = 0;
    this.hitsRemaining = this.config.life;
    this.surprised = false;
    this.surpriseTimer = 0;
  }
}

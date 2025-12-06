/**
 * The Source Component - Final boss behavior
 * Ported from: Original/src/com/replica/replicaisland/TheSourceComponent.java
 * 
 * The Source is the final boss that shakes when hit and spawns explosions when dying.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import type { CameraSystem } from '../../engine/CameraSystem';
import type { EffectsSystem } from '../../engine/EffectsSystem';

// Configuration constants from original
const SHAKE_TIME = 0.6;
const DIE_TIME = 30.0;
const EXPLOSION_TIME = 0.1;
const SHAKE_MAGNITUDE = 5.0;
const SHAKE_SCALE = 300.0;
const CAMERA_HIT_SHAKE_MAGNITUDE = 3.0;
const SINK_SPEED = 20; // Positive = down in canvas coordinates

export interface TheSourceConfig {
  gameEvent?: number;
  gameEventIndex?: number;
}

export class TheSourceComponent extends GameComponent {
  private timer: number = 0;
  private explosionTimer: number = 0;
  private shakeStartPosition: number = 0;
  private dead: boolean = false;
  
  // External systems
  private cameraSystem: CameraSystem | null = null;
  private effectsSystem: EffectsSystem | null = null;
  
  // Channel for signaling death
  private onDeathChannel: (() => void) | null = null;
  
  // Game event to trigger on death
  private gameEvent: number = -1;
  private gameEventIndex: number = -1;
  
  // Callback for game events
  private onGameEvent: ((event: number, index: number) => void) | null = null;
  
  constructor() {
    super(ComponentPhase.THINK);
  }
  
  reset(): void {
    this.timer = 0;
    this.explosionTimer = 0;
    this.shakeStartPosition = 0;
    this.dead = false;
    this.gameEvent = -1;
    this.gameEventIndex = -1;
  }
  
  /**
   * Set camera system for shaking and focus
   */
  setCameraSystem(camera: CameraSystem): void {
    this.cameraSystem = camera;
  }
  
  /**
   * Set effects system for explosions
   */
  setEffectsSystem(effects: EffectsSystem): void {
    this.effectsSystem = effects;
  }
  
  /**
   * Set callback for death
   */
  setOnDeathChannel(callback: () => void): void {
    this.onDeathChannel = callback;
  }
  
  /**
   * Set game event to trigger on death complete
   */
  setGameEvent(event: number, index: number): void {
    this.gameEvent = event;
    this.gameEventIndex = index;
  }
  
  /**
   * Set callback for game events
   */
  setOnGameEvent(callback: (event: number, index: number) => void): void {
    this.onGameEvent = callback;
  }
  
  /**
   * Configure the component
   */
  configure(config: TheSourceConfig): void {
    if (config.gameEvent !== undefined) {
      this.gameEvent = config.gameEvent;
    }
    if (config.gameEventIndex !== undefined) {
      this.gameEventIndex = config.gameEventIndex;
    }
  }
  
  update(dt: number, parent: GameObject): void {
    const currentAction = parent.getCurrentAction();
    
    // Handle hit reaction
    if (currentAction === ActionType.HIT_REACT) {
      if (parent.life > 0) {
        // Still alive - shake
        this.timer = SHAKE_TIME;
        if (this.cameraSystem) {
          this.cameraSystem.shake(SHAKE_TIME, CAMERA_HIT_SHAKE_MAGNITUDE);
        }
        this.shakeStartPosition = parent.getPosition().x;
        parent.setCurrentAction(ActionType.IDLE);
      } else {
        // Dead - start death sequence
        parent.setCurrentAction(ActionType.DEATH);
        this.timer = DIE_TIME;
        this.explosionTimer = EXPLOSION_TIME;
        
        // Signal death through channel
        if (this.onDeathChannel) {
          this.onDeathChannel();
        }
        
        this.dead = true;
      }
    }
    
    this.timer -= dt;
    
    if (this.dead) {
      // Death sequence - sink and spawn explosions
      
      // Make camera follow the dying boss
      if (this.cameraSystem) {
        const target = this.cameraSystem.getTarget();
        // Only steal camera if player has it
        if (target && target !== parent) {
          this.cameraSystem.setTarget(parent);
        }
      }
      
      // Sink downward
      parent.getPosition().y += SINK_SPEED * dt;
      
      // Spawn explosions
      this.explosionTimer -= dt;
      if (this.explosionTimer < 0 && this.effectsSystem) {
        // Random position within the boss
        const x = (Math.random() - 0.5) * (parent.width * 0.75);
        const y = (Math.random() - 0.5) * (parent.height * 0.75);
        
        this.effectsSystem.spawnExplosion(
          parent.getPosition().x + parent.width / 2 + x,
          parent.getPosition().y + parent.height / 2 + y,
          'giant'
        );
        
        this.explosionTimer = EXPLOSION_TIME;
      }
      
      // Check if death sequence is complete
      if (this.timer <= 0) {
        this.timer = 0;
        if (this.gameEvent !== -1 && this.onGameEvent) {
          this.onGameEvent(this.gameEvent, this.gameEventIndex);
          this.gameEvent = -1;
        }
      }
    } else if (this.timer > 0) {
      // Hit shake animation
      const delta = Math.sin(this.timer * SHAKE_SCALE) * SHAKE_MAGNITUDE;
      parent.getPosition().x = this.shakeStartPosition + delta;
      
      // End shake cleanly
      if (this.timer - dt <= 0) {
        this.timer = 0;
        parent.getPosition().x = this.shakeStartPosition;
      }
    }
  }
  
  /**
   * Check if the boss is dead
   */
  isDead(): boolean {
    return this.dead;
  }
  
  /**
   * Get remaining death timer
   */
  getDeathTimer(): number {
    return this.timer;
  }
}

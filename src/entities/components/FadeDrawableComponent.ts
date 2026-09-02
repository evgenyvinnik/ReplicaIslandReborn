/**
 * Fade Drawable Component - Per-object opacity animation with easing
 * Ported from: Original/src/com/replica/replicaisland/FadeDrawableComponent.java
 * 
 * Animates opacity of a game object's sprite with configurable:
 * - Start and end opacity
 * - Duration
 * - Easing function (linear or ease)
 * - Loop modes (none, loop, ping-pong)
 * - Initial delay
 * - Phase duration for repeating patterns
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import { SpriteComponent } from './SpriteComponent';

// Loop types
export enum FadeLoopType {
  NONE = 0,       // Play once and stay at target
  LOOP = 1,       // Loop back to start
  PING_PONG = 2,  // Oscillate between start and target
}

// Easing functions
export enum FadeFunction {
  LINEAR = 0,     // Linear interpolation
  EASE = 1,       // Eased interpolation (slow start/end)
}

export interface FadeConfig {
  startOpacity: number;     // 0.0 - 1.0
  endOpacity: number;       // 0.0 - 1.0
  duration: number;         // In seconds
  loopType: FadeLoopType;
  fadeFunction: FadeFunction;
  initialDelay?: number;    // Delay before fade starts
  phaseDuration?: number;   // If set, restarts fade cycle after this duration
}

/**
 * Linear interpolation
 */
function lerp(start: number, end: number, duration: number, elapsed: number): number {
  if (duration <= 0) return end;
  const t = Math.min(elapsed / duration, 1.0);
  return start + (end - start) * t;
}

/**
 * Ease interpolation (slow at start and end)
 * Uses smoothstep: 3t² - 2t³
 */
function ease(start: number, end: number, duration: number, elapsed: number): number {
  if (duration <= 0) return end;
  const t = Math.min(elapsed / duration, 1.0);
  // Smoothstep easing
  const easedT = t * t * (3 - 2 * t);
  return start + (end - start) * easedT;
}

export class FadeDrawableComponent extends GameComponent {
  // Fade parameters
  private initialOpacity: number = 1.0;
  private targetOpacity: number = 1.0;
  /**
   * The pair as configured. PING_PONG swaps the working values every cycle, so
   * restarting a phase has to come back to these rather than to whatever the
   * cycle happened to leave behind.
   */
  private configuredInitialOpacity: number = 1.0;
  private configuredTargetOpacity: number = 1.0;
  private duration: number = 1.0;
  private loopType: FadeLoopType = FadeLoopType.NONE;
  private fadeFunction: FadeFunction = FadeFunction.LINEAR;
  private initialDelay: number = 0;
  private phaseDuration: number = 0;

  // Runtime state
  private startTime: number = 0;
  private activateTime: number = 0;
  private initialDelayTimer: number = 0;
  private currentOpacity: number = 1.0;
  private gameTime: number = 0;
  private isActive: boolean = true;
  private spriteComponent: SpriteComponent | null = null;

  constructor() {
    super();
    this.phase = ComponentPhase.PRE_DRAW;
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.initialOpacity = 1.0;
    this.targetOpacity = 1.0;
    this.duration = 1.0;
    this.loopType = FadeLoopType.NONE;
    this.fadeFunction = FadeFunction.LINEAR;
    this.initialDelay = 0;
    this.phaseDuration = 0;
    this.startTime = 0;
    this.activateTime = 0;
    this.initialDelayTimer = 0;
    this.currentOpacity = 1.0;
    this.gameTime = 0;
    this.isActive = true;
    this.spriteComponent = null;
  }

  /**
   * Configure the fade animation
   */
  setupFade(config: FadeConfig): void {
    this.initialOpacity = Math.max(0, Math.min(1, config.startOpacity));
    this.targetOpacity = Math.max(0, Math.min(1, config.endOpacity));
    this.configuredInitialOpacity = this.initialOpacity;
    this.configuredTargetOpacity = this.targetOpacity;
    this.duration = Math.max(0.001, config.duration);
    this.loopType = config.loopType;
    this.fadeFunction = config.fadeFunction;
    this.initialDelay = config.initialDelay ?? 0;
    this.phaseDuration = config.phaseDuration ?? 0;
    
    // Reset timing
    this.startTime = 0;
    this.activateTime = 0;
    this.initialDelayTimer = this.initialDelay;
    this.currentOpacity = this.initialOpacity;
  }

  /**
   * The sprite this fade drives. Matches the original's setRenderComponent():
   * the fade does not pick what is drawn, only how opaque it is.
   */
  setSpriteComponent(sprite: SpriteComponent): void {
    this.spriteComponent = sprite;
  }

  /**
   * Set phase duration (enables phase repeating)
   */
  setPhaseDuration(duration: number): void {
    this.phaseDuration = duration;
  }

  /**
   * Restart the phase timer, so a fade that flashes near the end of a powerup
   * starts counting again when the powerup is extended.
   * Original: FadeDrawableComponent.resetPhase(), called from PlayerComponent
   * when a second glow is collected before the first runs out.
   */
  resetPhase(): void {
    this.activateTime = 0;
    this.startTime = 0;
    this.initialOpacity = this.configuredInitialOpacity;
    this.targetOpacity = this.configuredTargetOpacity;
    this.currentOpacity = this.initialOpacity;
  }

  /**
   * Enable/disable the fade effect
   */
  setActive(active: boolean): void {
    this.isActive = active;
  }

  /**
   * Get current opacity value
   */
  getOpacity(): number {
    return this.currentOpacity;
  }

  /**
   * Check if fade is complete (for non-looping fades)
   */
  isComplete(): boolean {
    if (this.loopType !== FadeLoopType.NONE) return false;
    return this.currentOpacity === this.targetOpacity;
  }

  /**
   * Update fade animation
   */
  update(deltaTime: number, parent: GameObject): void {
    if (!this.isActive) return;

    this.gameTime += deltaTime;

    // Handle phase timing (repeating patterns)
    if (this.activateTime === 0) {
      this.activateTime = this.gameTime;
      this.initialDelayTimer = this.initialDelay;
    } else if (this.phaseDuration > 0 && this.gameTime - this.activateTime > this.phaseDuration) {
      // Phase ended, restart
      this.activateTime = this.gameTime;
      this.initialDelayTimer = this.initialDelay;
      this.startTime = 0;
    }

    // Handle initial delay. The original can simply return here, because its
    // SpriteComponent allocates a fresh drawable at full opacity every frame;
    // here opacity is state that persists on the sprite, so a fade waiting out
    // its delay has to keep asserting where it starts - otherwise a restarted
    // phase leaves the sprite frozen mid-flash.
    if (this.initialDelayTimer > 0) {
      this.initialDelayTimer -= deltaTime;
      this.currentOpacity = this.initialOpacity;
      this.applyOpacity(parent);
      return;
    }

    // Start fade timing
    if (this.startTime === 0) {
      this.startTime = this.gameTime;
    }

    let elapsed = this.gameTime - this.startTime;
    let opacity = this.initialOpacity;

    // Handle looping
    if (this.loopType !== FadeLoopType.NONE && elapsed > this.duration) {
      const endTime = this.startTime + this.duration;
      elapsed = this.gameTime - endTime;
      this.startTime = endTime;

      if (this.loopType === FadeLoopType.PING_PONG) {
        // Swap initial and target for ping-pong
        const temp = this.initialOpacity;
        this.initialOpacity = this.targetOpacity;
        this.targetOpacity = temp;
      }
    }

    // Calculate current opacity
    if (elapsed >= this.duration) {
      opacity = this.targetOpacity;
    } else if (elapsed > 0) {
      if (this.fadeFunction === FadeFunction.LINEAR) {
        opacity = lerp(this.initialOpacity, this.targetOpacity, this.duration, elapsed);
      } else {
        opacity = ease(this.initialOpacity, this.targetOpacity, this.duration, elapsed);
      }
    }

    this.currentOpacity = opacity;
    this.applyOpacity(parent);
  }

  /**
   * Push the current opacity onto the sprite. The original sets it on the
   * drawable held by a RenderComponent; here SpriteComponent owns the drawing.
   * An object can carry several (The Source has five layers, each with its own
   * fade), so the target is normally set explicitly; falling back to the
   * object's only sprite covers the single-sprite case.
   */
  private applyOpacity(parent: GameObject): void {
    const sprite = this.spriteComponent ?? parent.getComponent(SpriteComponent);
    if (sprite) {
      this.spriteComponent = sprite;
      sprite.setOpacity(this.currentOpacity);
    }
  }

  /**
   * Quick setup for common fade patterns
   */
  
  /** Fade in from invisible to fully visible */
  static fadeIn(duration: number = 1.0, delay: number = 0): FadeConfig {
    return {
      startOpacity: 0,
      endOpacity: 1,
      duration,
      loopType: FadeLoopType.NONE,
      fadeFunction: FadeFunction.EASE,
      initialDelay: delay,
    };
  }

  /** Fade out from visible to invisible */
  static fadeOut(duration: number = 1.0, delay: number = 0): FadeConfig {
    return {
      startOpacity: 1,
      endOpacity: 0,
      duration,
      loopType: FadeLoopType.NONE,
      fadeFunction: FadeFunction.EASE,
      initialDelay: delay,
    };
  }

  /** Pulsing opacity effect */
  static pulse(minOpacity: number = 0.3, maxOpacity: number = 1.0, duration: number = 1.0): FadeConfig {
    return {
      startOpacity: minOpacity,
      endOpacity: maxOpacity,
      duration,
      loopType: FadeLoopType.PING_PONG,
      fadeFunction: FadeFunction.EASE,
    };
  }

  /** Blinking effect */
  static blink(duration: number = 0.5): FadeConfig {
    return {
      startOpacity: 0,
      endOpacity: 1,
      duration,
      loopType: FadeLoopType.PING_PONG,
      fadeFunction: FadeFunction.LINEAR,
    };
  }
}

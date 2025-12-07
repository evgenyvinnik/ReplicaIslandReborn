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
  }

  /**
   * Configure the fade animation
   */
  setupFade(config: FadeConfig): void {
    this.initialOpacity = Math.max(0, Math.min(1, config.startOpacity));
    this.targetOpacity = Math.max(0, Math.min(1, config.endOpacity));
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
   * Set phase duration (enables phase repeating)
   */
  setPhaseDuration(duration: number): void {
    this.phaseDuration = duration;
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

    // Handle initial delay
    if (this.initialDelayTimer > 0) {
      this.initialDelayTimer -= deltaTime;
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

    // Apply to parent's opacity (if parent supports it)
    const gameObj = parent as GameObject & { opacity?: number };
    if ('opacity' in gameObj) {
      gameObj.opacity = this.currentOpacity;
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

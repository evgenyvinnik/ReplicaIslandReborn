/**
 * Time System - Manages game time and timing utilities
 * Ported from: Original/src/com/replica/replicaisland/TimeSystem.java
 */

/** Original: TimeSystem.EASE_DURATION. */
const EASE_DURATION = 0.5;

/**
 * The original's Lerp.ease: a smoothstep between start and target over
 * `duration`, clamped at both ends.
 */
function ease(start: number, target: number, duration: number, elapsed: number): number {
  if (duration <= 0) return target;
  const t = Math.min(Math.max(elapsed / duration, 0), 1);
  return start + (target - start) * (t * t * (3 - 2 * t));
}

export class TimeSystem {
  private gameTime: number = 0;
  private realTime: number = 0;
  private frameTime: number = 0;
  private timeScale: number = 1.0;
  private paused: boolean = false;
  
  // Freeze support (pause-on-attack effect)
  private freezeTime: number = 0;
  private frozen: boolean = false;
  /**
   * Real time at which the current scale ramp began. Guarded by `scaleActive`
   * rather than a positive test: the original compares mScaleStartTime > 0,
   * which quietly ignores a scale applied on the very first frame, when its
   * real clock is still zero.
   */
  private scaleStartTime: number = 0;
  private scaleActive: boolean = false;
  private scaleDuration: number = 0;
  private targetScale: number = 1.0;
  private easeScale: boolean = false;

  constructor() {
    this.reset();
  }

  /**
   * Reset the time system
   */
  reset(): void {
    this.gameTime = 0;
    this.realTime = 0;
    this.frameTime = 0;
    this.timeScale = 1.0;
    this.scaleStartTime = 0;
    this.scaleActive = false;
    this.scaleDuration = 0;
    this.targetScale = 1.0;
    this.easeScale = false;
    this.paused = false;
    this.freezeTime = 0;
    this.frozen = false;
  }

  /**
   * Update the time system
   */
  update(deltaTime: number): void {
    this.realTime += deltaTime;

    // Handle freeze countdown
    if (this.frozen) {
      this.freezeTime -= deltaTime;
      if (this.freezeTime <= 0) {
        this.frozen = false;
        this.freezeTime = 0;
      }
    }

    if (!this.paused && !this.frozen) {
      this.frameTime = deltaTime * this.timeScale * this.currentScale();
      this.gameTime += this.frameTime;
    } else {
      this.frameTime = 0;
    }
  }

  /**
   * The scale factor for this frame, ramping in and out when eased.
   * Original: TimeSystem.update()'s scale block, with EASE_DURATION = 0.5.
   */
  private currentScale(): number {
    if (!this.scaleActive) return 1.0;

    const scaleTime = this.realTime - this.scaleStartTime;
    if (scaleTime > this.scaleDuration) {
      this.scaleActive = false;
      return 1.0;
    }
    if (!this.easeScale) return this.targetScale;

    if (scaleTime <= EASE_DURATION) {
      return ease(1.0, this.targetScale, EASE_DURATION, scaleTime);
    }
    if (this.scaleDuration - scaleTime < EASE_DURATION) {
      const easeOutTime = EASE_DURATION - (this.scaleDuration - scaleTime);
      return ease(this.targetScale, 1.0, EASE_DURATION, easeOutTime);
    }
    return this.targetScale;
  }

  /**
   * Run the game clock at `scale` for `duration` real seconds.
   *
   * The original spells this `appyScale` and uses it in exactly one place:
   * PlayerComponent.gotoWin() calls appyScale(0.1f, 8.0f, true), which is the
   * slow-motion flourish when you finish a level. The port had no time scaling
   * at all, so winning simply cut to the level-complete screen.
   */
  applyScale(scale: number, duration: number, ease: boolean = false): void {
    this.targetScale = scale;
    this.scaleDuration = duration;
    this.easeScale = ease;
    this.scaleStartTime = this.realTime;
    this.scaleActive = true;
  }

  /** Whether a scale ramp is currently running. */
  isScaling(): boolean {
    return this.scaleActive;
  }

  /**
   * Drop any running scale ramp. The win flourish lasts eight seconds but the
   * level ends well before that, so it has to be cleared or the next level
   * starts in slow motion.
   */
  clearScale(): void {
    this.scaleActive = false;
    this.scaleStartTime = 0;
    this.targetScale = 1.0;
    this.scaleDuration = 0;
    this.easeScale = false;
  }

  /**
   * Get the current game time (affected by time scale and pause)
   */
  getGameTime(): number {
    return this.gameTime;
  }

  /**
   * Get the current real time (not affected by time scale or pause)
   */
  getRealTime(): number {
    return this.realTime;
  }

  /**
   * Get the current frame's delta time
   */
  getFrameDelta(): number {
    return this.frameTime;
  }

  /**
   * Get the time scale
   */
  getTimeScale(): number {
    return this.timeScale;
  }

  /**
   * Set the time scale (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
   */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }

  /**
   * Pause game time
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume game time
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Check if time is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Freeze game time for a specified duration (pause-on-attack effect)
   * Unlike pause(), freeze automatically unfreezes after the duration
   */
  freeze(duration: number): void {
    this.frozen = true;
    this.freezeTime = duration;
  }

  /**
   * Check if time is frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Unfreeze time immediately
   */
  unfreeze(): void {
    this.frozen = false;
    this.freezeTime = 0;
  }
}

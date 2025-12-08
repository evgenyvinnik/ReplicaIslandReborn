/**
 * Time System - Manages game time and timing utilities
 * Ported from: Original/src/com/replica/replicaisland/TimeSystem.java
 */

export class TimeSystem {
  private gameTime: number = 0;
  private realTime: number = 0;
  private frameTime: number = 0;
  private timeScale: number = 1.0;
  private paused: boolean = false;
  
  // Freeze support (pause-on-attack effect)
  private freezeTime: number = 0;
  private frozen: boolean = false;

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
      this.frameTime = deltaTime * this.timeScale;
      this.gameTime += this.frameTime;
    } else {
      this.frameTime = 0;
    }
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

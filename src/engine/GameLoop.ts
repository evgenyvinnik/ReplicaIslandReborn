/**
 * Main game loop implementation
 * Ported from: Original/src/com/replica/replicaisland/GameThread.java
 *
 * Uses requestAnimationFrame for smooth 60fps rendering
 * Implements fixed timestep with variable rendering for consistent physics
 */

import { SystemRegistry } from './SystemRegistry';

export type UpdateCallback = (deltaTime: number) => void;
export type RenderCallback = (interpolation: number) => void;

export class GameLoop {
  private running: boolean = false;
  private paused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;

  // Fixed timestep configuration (similar to original game's 16ms target)
  private readonly fixedDeltaTime: number = 1 / 60; // 60 FPS
  private readonly maxDeltaTime: number = 0.1; // Cap delta to prevent spiral of death

  // Performance tracking
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private currentFPS: number = 0;

  // Callbacks
  private updateCallback: UpdateCallback | null = null;
  private renderCallback: RenderCallback | null = null;

  // Error reporting. A throw inside update/render used to escape tick() before
  // the next requestAnimationFrame was scheduled, which killed the loop for the
  // rest of the session. Callbacks are guarded now, and the first few failures
  // are logged so the underlying bug is still visible.
  private static readonly MAX_LOGGED_ERRORS = 5;
  private loggedErrors: number = 0;
  private lastError: unknown = null;

  // System registry reference
  private systemRegistry: SystemRegistry | null = null;

  constructor() {
    this.tick = this.tick.bind(this);
  }

  /**
   * Set the update callback (game logic)
   */
  setUpdateCallback(callback: UpdateCallback): void {
    this.updateCallback = callback;
  }

  /**
   * Set the render callback (drawing)
   */
  setRenderCallback(callback: RenderCallback): void {
    this.renderCallback = callback;
  }

  /**
   * Set the system registry
   */
  setSystemRegistry(registry: SystemRegistry): void {
    this.systemRegistry = registry;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Pause the game loop (keeps running but doesn't update game state)
   */
  pause(): void {
    this.paused = true;
    if (this.systemRegistry?.soundSystem) {
      this.systemRegistry.soundSystem.pauseAll();
    }
  }

  /**
   * Resume the game loop
   */
  resume(): void {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now();
      this.accumulator = 0;
      if (this.systemRegistry?.soundSystem) {
        this.systemRegistry.soundSystem.resumeAll();
      }
    }
  }

  /**
   * Check if the game loop is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if the game loop is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.currentFPS;
  }

  /**
   * Main tick function called every frame
   */
  private tick(currentTime: number): void {
    if (!this.running) return;

    // Calculate delta time in seconds
    let deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Cap delta time to prevent spiral of death
    if (deltaTime > this.maxDeltaTime) {
      deltaTime = this.maxDeltaTime;
    }

    // Update FPS counter
    this.frameCount++;
    this.fpsTimer += deltaTime;
    if (this.fpsTimer >= 1.0) {
      this.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer -= 1.0;
    }

    // Only update game state if not paused
    if (!this.paused) {
      // Fixed timestep update with accumulator
      this.accumulator += deltaTime;

      // Update game state at fixed intervals
      while (this.accumulator >= this.fixedDeltaTime) {
        if (this.updateCallback) {
          this.guard('update', this.updateCallback, this.fixedDeltaTime);
        }
        this.accumulator -= this.fixedDeltaTime;
      }

      // Calculate interpolation for smooth rendering
      const interpolation = this.accumulator / this.fixedDeltaTime;

      // Render with interpolation
      if (this.renderCallback) {
        this.guard('render', this.renderCallback, interpolation);
      }
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  /**
   * Run a frame callback without letting a throw tear down the loop.
   */
  private guard(label: string, callback: (arg: number) => void, arg: number): void {
    try {
      callback(arg);
    } catch (error) {
      this.lastError = error;
      if (this.loggedErrors < GameLoop.MAX_LOGGED_ERRORS) {
        this.loggedErrors++;
        console.error(`[GameLoop] ${label} callback threw:`, error);
        if (this.loggedErrors === GameLoop.MAX_LOGGED_ERRORS) {
          console.error('[GameLoop] further frame errors will be suppressed');
        }
      }
    }
  }

  /**
   * Most recent error thrown by a frame callback, if any.
   */
  getLastError(): unknown {
    return this.lastError;
  }

  /**
   * Advance the simulation by a fixed number of frames without waiting for
   * requestAnimationFrame. Intended for automated testing and for headless /
   * background contexts where the browser throttles rAF to a standstill.
   */
  step(frames: number = 1, render: boolean = true): void {
    for (let i = 0; i < frames; i++) {
      if (this.updateCallback) {
        this.guard('update', this.updateCallback, this.fixedDeltaTime);
      }
    }
    if (render && this.renderCallback) {
      this.guard('render', this.renderCallback, 0);
    }
  }

  /**
   * Get the fixed delta time
   */
  getFixedDeltaTime(): number {
    return this.fixedDeltaTime;
  }
}

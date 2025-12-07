/**
 * Performance Monitor - Tracks FPS and frame timing
 * Inspired by: Original/src/com/replica/replicaisland/FrameRateWatcherComponent.java
 * 
 * This system monitors game performance and provides:
 * - FPS tracking
 * - Frame time tracking
 * - Performance warnings
 * - Statistics for debugging
 */

export interface PerformanceStats {
  /** Current frames per second */
  fps: number;
  /** Average FPS over sample window */
  avgFps: number;
  /** Minimum FPS in sample window */
  minFps: number;
  /** Maximum FPS in sample window */
  maxFps: number;
  /** Current frame time in milliseconds */
  frameTime: number;
  /** Average frame time in milliseconds */
  avgFrameTime: number;
  /** Number of dropped frames (> 33ms) */
  droppedFrames: number;
  /** Total frames counted */
  totalFrames: number;
}

export class PerformanceMonitor {
  /** Sample window size for averaging */
  private static readonly SAMPLE_SIZE = 60;
  
  /** Frame time threshold for "dropped frame" (33ms = ~30fps) */
  private static readonly DROPPED_FRAME_THRESHOLD = 33;
  
  /** Target frame time (16.67ms = 60fps) */
  private static readonly TARGET_FRAME_TIME = 1000 / 60;

  /** Frame time history */
  private frameTimes: number[] = [];
  
  /** Sample index for circular buffer */
  private sampleIndex: number = 0;
  
  /** Last timestamp */
  private lastTimestamp: number = 0;
  
  /** Dropped frame count */
  private droppedFrames: number = 0;
  
  /** Total frames */
  private totalFrames: number = 0;
  
  /** Enabled state */
  private enabled: boolean = true;
  
  /** Callback for performance warnings */
  private warningCallback: ((warning: string) => void) | null = null;
  
  /** Last FPS for smoothing */
  private lastFps: number = 60;

  constructor() {
    // Initialize frame time buffer
    this.frameTimes = new Array(PerformanceMonitor.SAMPLE_SIZE).fill(PerformanceMonitor.TARGET_FRAME_TIME);
  }

  /**
   * Reset the monitor
   */
  reset(): void {
    this.frameTimes.fill(PerformanceMonitor.TARGET_FRAME_TIME);
    this.sampleIndex = 0;
    this.lastTimestamp = 0;
    this.droppedFrames = 0;
    this.totalFrames = 0;
    this.lastFps = 60;
  }

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set callback for performance warnings
   */
  setWarningCallback(callback: ((warning: string) => void) | null): void {
    this.warningCallback = callback;
  }

  /**
   * Update with current timestamp (called each frame)
   * @param timestamp Current timestamp in milliseconds (from requestAnimationFrame)
   */
  update(timestamp: number): void {
    if (!this.enabled) return;

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      return;
    }

    const frameTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.totalFrames++;

    // Store in circular buffer
    this.frameTimes[this.sampleIndex] = frameTime;
    this.sampleIndex = (this.sampleIndex + 1) % PerformanceMonitor.SAMPLE_SIZE;

    // Check for dropped frames
    if (frameTime > PerformanceMonitor.DROPPED_FRAME_THRESHOLD) {
      this.droppedFrames++;
      
      if (this.warningCallback) {
        this.warningCallback(`Frame drop: ${frameTime.toFixed(1)}ms`);
      }
    }
  }

  /**
   * Update with delta time (alternative to timestamp)
   * @param deltaTime Frame delta time in seconds
   */
  updateWithDelta(deltaTime: number): void {
    if (!this.enabled) return;

    const frameTime = deltaTime * 1000;
    this.totalFrames++;

    // Store in circular buffer
    this.frameTimes[this.sampleIndex] = frameTime;
    this.sampleIndex = (this.sampleIndex + 1) % PerformanceMonitor.SAMPLE_SIZE;

    // Check for dropped frames
    if (frameTime > PerformanceMonitor.DROPPED_FRAME_THRESHOLD) {
      this.droppedFrames++;
    }
  }

  /**
   * Get current performance statistics
   */
  getStats(): PerformanceStats {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (const time of this.frameTimes) {
      sum += time;
      min = Math.min(min, time);
      max = Math.max(max, time);
    }

    const avgFrameTime = sum / PerformanceMonitor.SAMPLE_SIZE;
    const currentFrameTime = this.frameTimes[(this.sampleIndex - 1 + PerformanceMonitor.SAMPLE_SIZE) % PerformanceMonitor.SAMPLE_SIZE];
    
    // Calculate FPS with smoothing
    const currentFps = currentFrameTime > 0 ? 1000 / currentFrameTime : 60;
    this.lastFps = this.lastFps * 0.9 + currentFps * 0.1;

    return {
      fps: Math.round(this.lastFps),
      avgFps: Math.round(avgFrameTime > 0 ? 1000 / avgFrameTime : 60),
      minFps: Math.round(max > 0 ? 1000 / max : 60),
      maxFps: Math.round(min > 0 ? 1000 / min : 60),
      frameTime: currentFrameTime,
      avgFrameTime: avgFrameTime,
      droppedFrames: this.droppedFrames,
      totalFrames: this.totalFrames,
    };
  }

  /**
   * Get current FPS
   */
  getFps(): number {
    return Math.round(this.lastFps);
  }

  /**
   * Check if performance is good (above 55 fps average)
   */
  isPerformanceGood(): boolean {
    const stats = this.getStats();
    return stats.avgFps >= 55;
  }

  /**
   * Check if performance is acceptable (above 30 fps average)
   */
  isPerformanceAcceptable(): boolean {
    const stats = this.getStats();
    return stats.avgFps >= 30;
  }

  /**
   * Get dropped frame percentage
   */
  getDroppedFramePercentage(): number {
    if (this.totalFrames === 0) return 0;
    return (this.droppedFrames / this.totalFrames) * 100;
  }

  /**
   * Get a formatted performance string for display
   */
  getDisplayString(): string {
    const stats = this.getStats();
    return `FPS: ${stats.fps} (avg: ${stats.avgFps})`;
  }

  /**
   * Get a detailed performance report
   */
  getDetailedReport(): string {
    const stats = this.getStats();
    return [
      `FPS: ${stats.fps} (min: ${stats.minFps}, max: ${stats.maxFps}, avg: ${stats.avgFps})`,
      `Frame Time: ${stats.frameTime.toFixed(2)}ms (avg: ${stats.avgFrameTime.toFixed(2)}ms)`,
      `Dropped Frames: ${stats.droppedFrames} (${this.getDroppedFramePercentage().toFixed(1)}%)`,
      `Total Frames: ${stats.totalFrames}`,
    ].join('\n');
  }
}

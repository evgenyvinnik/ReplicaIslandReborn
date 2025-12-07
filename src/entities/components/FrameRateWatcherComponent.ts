/**
 * FrameRateWatcherComponent - Shows visual indicator on low frame rate
 * Ported from: Original/src/com/replica/replicaisland/FrameRateWatcherComponent.java
 *
 * This component watches the frame time and shows a visual indicator
 * (like a warning icon) when the frame rate drops below a threshold.
 * Useful for debugging performance issues during gameplay.
 */

import { GameComponent } from '../GameComponent';
import type { GameObject } from '../GameObject';
import { ComponentPhase } from '../../types';

// Default threshold: 30 FPS = 33.33ms per frame
const DEFAULT_MAX_FRAME_TIME = 1.0 / 30.0;

export interface FrameRateWatcherConfig {
  maxFrameTime?: number; // Maximum acceptable frame time before showing warning
  alwaysShow?: boolean; // Always show even when performance is good
}

// Callback type for showing/hiding the warning
type WarningCallback = (show: boolean, frameTime: number) => void;

export class FrameRateWatcherComponent extends GameComponent {
  private maxFrameTime: number = DEFAULT_MAX_FRAME_TIME;
  private alwaysShow: boolean = false;
  private isShowingWarning: boolean = false;
  private warningCallback: WarningCallback | null = null;

  // Stats tracking
  private worstFrameTime: number = 0;
  private slowFrameCount: number = 0;
  private totalFrameCount: number = 0;

  constructor(config?: FrameRateWatcherConfig) {
    super(ComponentPhase.THINK);

    if (config) {
      this.maxFrameTime = config.maxFrameTime ?? DEFAULT_MAX_FRAME_TIME;
      this.alwaysShow = config.alwaysShow ?? false;
    }
  }

  /**
   * Set callback for warning state changes
   */
  setWarningCallback(callback: WarningCallback): void {
    this.warningCallback = callback;
  }

  /**
   * Set the maximum acceptable frame time
   */
  setMaxFrameTime(maxTime: number): void {
    this.maxFrameTime = maxTime;
  }

  /**
   * Get the threshold FPS (converted from frame time)
   */
  getThresholdFPS(): number {
    return 1.0 / this.maxFrameTime;
  }

  /**
   * Check if warning is currently being shown
   */
  isWarningShown(): boolean {
    return this.isShowingWarning;
  }

  /**
   * Get statistics
   */
  getStats(): {
    worstFrameTime: number;
    slowFrameCount: number;
    totalFrameCount: number;
    slowFramePercentage: number;
  } {
    return {
      worstFrameTime: this.worstFrameTime,
      slowFrameCount: this.slowFrameCount,
      totalFrameCount: this.totalFrameCount,
      slowFramePercentage: this.totalFrameCount > 0
        ? (this.slowFrameCount / this.totalFrameCount) * 100
        : 0,
    };
  }

  /**
   * Update - check frame time and show/hide warning
   */
  update(deltaTime: number, _parent: GameObject): void {
    this.totalFrameCount++;

    // Track worst frame time
    if (deltaTime > this.worstFrameTime) {
      this.worstFrameTime = deltaTime;
    }

    // Check if frame time exceeds threshold
    const isSlow = deltaTime > this.maxFrameTime;

    if (isSlow) {
      this.slowFrameCount++;
    }

    // Update warning state
    const shouldShowWarning = this.alwaysShow || isSlow;

    if (shouldShowWarning !== this.isShowingWarning) {
      this.isShowingWarning = shouldShowWarning;

      if (this.warningCallback) {
        this.warningCallback(shouldShowWarning, deltaTime);
      }
    } else if (this.isShowingWarning && this.warningCallback) {
      // Update callback with current frame time when warning is shown
      this.warningCallback(true, deltaTime);
    }
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.isShowingWarning = false;
    this.worstFrameTime = 0;
    this.slowFrameCount = 0;
    this.totalFrameCount = 0;
  }

  /**
   * Reset statistics only (keep configuration)
   */
  resetStats(): void {
    this.worstFrameTime = 0;
    this.slowFrameCount = 0;
    this.totalFrameCount = 0;
  }
}

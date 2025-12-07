/**
 * Motion Blur Component - Draws sprite trail with decreasing opacity
 * Ported from: Original/src/com/replica/replicaisland/MotionBlurComponent.java
 * 
 * Creates a motion blur effect by storing position history and rendering
 * ghost images with decreasing opacity trailing behind the object.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import { Vector2 } from '../../utils/Vector2';

// Blur configuration
const STEP_COUNT = 4;          // Number of ghost images in trail
const STEP_DELAY = 0.1;        // Time between capturing positions (seconds)
const OPACITY_STEP = 1.0 / (STEP_COUNT + 1);  // Opacity decrease per step

interface BlurRecord {
  position: Vector2;
  spriteKey: string | null;
  frameIndex: number;
  width: number;
  height: number;
  valid: boolean;
}

export class MotionBlurComponent extends GameComponent {
  private history: BlurRecord[];
  private currentStep: number = 0;
  private timeSinceLastStep: number = 0;
  private stepDelay: number = STEP_DELAY;
  private enabled: boolean = true;

  constructor() {
    super();
    this.phase = ComponentPhase.PRE_DRAW;
    
    // Initialize history buffer
    this.history = [];
    for (let i = 0; i < STEP_COUNT; i++) {
      this.history.push({
        position: new Vector2(0, 0),
        spriteKey: null,
        frameIndex: 0,
        width: 0,
        height: 0,
        valid: false,
      });
    }
  }

  /**
   * Reset component state
   */
  reset(): void {
    for (const record of this.history) {
      record.position.set(0, 0);
      record.spriteKey = null;
      record.frameIndex = 0;
      record.width = 0;
      record.height = 0;
      record.valid = false;
    }
    this.currentStep = 0;
    this.timeSinceLastStep = 0;
  }

  /**
   * Enable/disable motion blur
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  /**
   * Check if motion blur is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set the delay between blur steps
   */
  setStepDelay(delay: number): void {
    this.stepDelay = Math.max(0.01, delay);
  }

  /**
   * Update motion blur history
   */
  update(deltaTime: number, parent: GameObject): void {
    if (!this.enabled) return;

    this.timeSinceLastStep += deltaTime;

    if (this.timeSinceLastStep >= this.stepDelay) {
      // Capture current position and sprite info
      const record = this.history[this.currentStep];
      record.position.set(parent.getPosition().x, parent.getPosition().y);
      record.width = parent.width;
      record.height = parent.height;
      record.valid = true;

      // Try to get sprite info from parent
      // Note: In web port, sprite info comes from animation state
      const spriteData = (parent as unknown as { currentSpriteKey?: string; currentFrameIndex?: number });
      record.spriteKey = spriteData.currentSpriteKey ?? parent.type;
      record.frameIndex = spriteData.currentFrameIndex ?? 0;

      // Move to next step (circular buffer)
      this.currentStep = (this.currentStep + 1) % STEP_COUNT;
      this.timeSinceLastStep = 0;
    }
  }

  /**
   * Get blur records for rendering
   * Returns records from newest to oldest with calculated opacity
   */
  getBlurRecords(): Array<{ record: BlurRecord; opacity: number }> {
    const result: Array<{ record: BlurRecord; opacity: number }> = [];

    // Start from most recent (one step before current)
    const startStep = this.currentStep > 0 ? this.currentStep - 1 : STEP_COUNT - 1;

    for (let i = 0; i < STEP_COUNT; i++) {
      const stepIndex = (startStep - i + STEP_COUNT) % STEP_COUNT;
      const record = this.history[stepIndex];

      if (record.valid) {
        // Opacity decreases for older records
        const opacity = (STEP_COUNT - i) * OPACITY_STEP;
        result.push({ record, opacity });
      }
    }

    return result;
  }

  /**
   * Clear all blur history (call when teleporting/respawning)
   */
  clearHistory(): void {
    for (const record of this.history) {
      record.valid = false;
    }
    this.currentStep = 0;
    this.timeSinceLastStep = 0;
  }
}

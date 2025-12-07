/**
 * Camera System - Manages the game camera
 * Ported from: Original/src/com/replica/replicaisland/CameraSystem.java
 */

import { Vector2 } from '../utils/Vector2';
import { lerp, clamp } from '../utils/helpers';

export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class CameraSystem {
  private position: Vector2 = new Vector2();
  private targetPosition: Vector2 = new Vector2();
  private focusPosition: Vector2 = new Vector2();

  private viewportWidth: number;
  private viewportHeight: number;

  private bounds: CameraBounds | null = null;
  private target: { getPosition: () => Vector2 } | null = null;

  // Camera smoothing
  private smoothing: number = 5.0;
  private lookAheadX: number = 0;
  private lookAheadY: number = 0;

  // Shake effect
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeTimer: number = 0;
  private shakeOffset: Vector2 = new Vector2();

  // Bias for following movement direction
  private biasX: number = 0;
  private biasY: number = 0;
  private readonly _biasSpeed: number = 2.0;

  // NPC focus mode - when true, camera is following an NPC for cutscene
  private npcFocusMode: boolean = false;
  private npcTarget: { getPosition: () => Vector2 } | null = null;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  /**
   * Get bias speed
   */
  getBiasSpeed(): number {
    return this._biasSpeed;
  }

  /**
   * Reset the camera
   */
  reset(): void {
    this.position.zero();
    this.targetPosition.zero();
    this.focusPosition.zero();
    this.target = null;
    this.bounds = null;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
    this.shakeOffset.zero();
    this.biasX = 0;
    this.biasY = 0;
    this.npcFocusMode = false;
    this.npcTarget = null;
  }

  /**
   * Set the camera target to follow
   * If npcFocusMode is active, this won't override the NPC target
   */
  setTarget(target: { getPosition: () => Vector2 } | null): void {
    // Don't override if in NPC focus mode - NPCComponent will release this
    if (!this.npcFocusMode) {
      this.target = target;
    }
  }

  /**
   * Set the NPC target (takes camera focus from player)
   */
  setNPCTarget(target: { getPosition: () => Vector2 } | null): void {
    if (target) {
      this.npcFocusMode = true;
      this.npcTarget = target;
      this.target = target;
    }
  }

  /**
   * Release NPC focus and return to player
   */
  releaseNPCFocus(player: { getPosition: () => Vector2 } | null): void {
    this.npcFocusMode = false;
    this.npcTarget = null;
    if (player) {
      this.target = player;
    }
  }

  /**
   * Check if camera is in NPC focus mode
   */
  isNPCFocusMode(): boolean {
    return this.npcFocusMode;
  }

  /**
   * Get the NPC target (if in NPC focus mode)
   */
  getNPCTarget(): { getPosition: () => Vector2 } | null {
    return this.npcTarget;
  }

  /**
   * Get the current camera target
   */
  getTarget(): { getPosition: () => Vector2 } | null {
    return this.target;
  }

  /**
   * Set camera bounds
   */
  setBounds(bounds: CameraBounds | null): void {
    this.bounds = bounds;
  }

  /**
   * Update the camera
   */
  update(deltaTime: number): void {
    // Update target position from followed object
    if (this.target) {
      const targetPos = this.target.getPosition();
      this.targetPosition.set(targetPos.x, targetPos.y);
    }

    // Apply look-ahead bias
    this.targetPosition.x += this.lookAheadX + this.biasX;
    this.targetPosition.y += this.lookAheadY + this.biasY;

    // Center the camera on the target
    this.targetPosition.x -= this.viewportWidth / 2;
    this.targetPosition.y -= this.viewportHeight / 2;

    // Smooth camera movement
    this.position.x = lerp(
      this.position.x,
      this.targetPosition.x,
      this.smoothing * deltaTime
    );
    this.position.y = lerp(
      this.position.y,
      this.targetPosition.y,
      this.smoothing * deltaTime
    );

    // Apply bounds
    if (this.bounds) {
      this.position.x = clamp(
        this.position.x,
        this.bounds.minX,
        this.bounds.maxX - this.viewportWidth
      );
      this.position.y = clamp(
        this.position.y,
        this.bounds.minY,
        this.bounds.maxY - this.viewportHeight
      );
    }

    // Update shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= deltaTime;
      const intensity = this.shakeIntensity * (this.shakeTimer / this.shakeDuration);
      this.shakeOffset.x = (Math.random() * 2 - 1) * intensity;
      this.shakeOffset.y = (Math.random() * 2 - 1) * intensity;
    } else {
      this.shakeOffset.zero();
    }

    // Update focus position (position + shake)
    this.focusPosition.x = this.position.x + this.shakeOffset.x;
    this.focusPosition.y = this.position.y + this.shakeOffset.y;
  }

  /**
   * Shake the camera
   */
  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /**
   * Check if the camera is currently shaking
   */
  isShaking(): boolean {
    return this.shakeTimer > 0;
  }

  /**
   * Check if a point is visible on screen (with optional radius for objects)
   */
  isPointVisible(point: Vector2, radius: number = 0): boolean {
    return (
      point.x + radius >= this.focusPosition.x &&
      point.x - radius <= this.focusPosition.x + this.viewportWidth &&
      point.y + radius >= this.focusPosition.y &&
      point.y - radius <= this.focusPosition.y + this.viewportHeight
    );
  }

  /**
   * Set look-ahead distance
   */
  setLookAhead(x: number, y: number): void {
    this.lookAheadX = x;
    this.lookAheadY = y;
  }

  /**
   * Set position bias based on movement direction
   */
  setBias(direction: Vector2, maxBias: number = 50): void {
    const targetBiasX = direction.x * maxBias;
    const targetBiasY = direction.y * maxBias;

    // Smoothly interpolate bias
    this.biasX = lerp(this.biasX, targetBiasX, 0.1);
    this.biasY = lerp(this.biasY, targetBiasY, 0.1);
  }

  /**
   * Add camera bias toward a position
   * Used by CameraBiasComponent to pull camera toward points of interest
   */
  addCameraBias(biasPosition: Vector2): void {
    const focalX = this.focusPosition.x;
    const focalY = this.focusPosition.y;

    // Calculate direction from focal point to bias position
    const dx = biasPosition.x - focalX;
    const dy = biasPosition.y - focalY;

    // Normalize the direction
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length > 0.001) {
      const normalizedX = dx / length;
      const normalizedY = dy / length;

      // Accumulate bias
      this.biasX += normalizedX;
      this.biasY += normalizedY;
    }
  }

  /**
   * Set camera position directly (immediately, no lerping)
   */
  setPosition(x: number, y: number): void {
    this.position.set(x, y);
    this.targetPosition.set(x, y);
    // Also set focusPosition immediately so the camera doesn't lerp from (0,0)
    this.focusPosition.set(x, y);
  }

  /**
   * Get camera position (with shake)
   */
  getPosition(): Vector2 {
    return this.focusPosition;
  }

  /**
   * Get camera X position
   */
  getFocusPositionX(): number {
    return this.focusPosition.x;
  }

  /**
   * Get camera Y position
   */
  getFocusPositionY(): number {
    return this.focusPosition.y;
  }

  /**
   * Get viewport width
   */
  getViewportWidth(): number {
    return this.viewportWidth;
  }

  /**
   * Get viewport height
   */
  getViewportHeight(): number {
    return this.viewportHeight;
  }

  /**
   * Set viewport size
   */
  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Set camera smoothing (higher = faster following)
   */
  setSmoothing(smoothing: number): void {
    this.smoothing = smoothing;
  }

  /**
   * Check if a point is visible on screen
   */
  isVisible(x: number, y: number, width: number = 0, height: number = 0): boolean {
    return (
      x + width >= this.focusPosition.x &&
      x <= this.focusPosition.x + this.viewportWidth &&
      y + height >= this.focusPosition.y &&
      y <= this.focusPosition.y + this.viewportHeight
    );
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.focusPosition.x,
      y: worldY - this.focusPosition.y,
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX + this.focusPosition.x,
      y: screenY + this.focusPosition.y,
    };
  }
}

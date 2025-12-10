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

// Camera target interface - needs position, width, and height to center properly
export interface CameraTarget {
  getPosition: () => Vector2;
  width: number;
  height: number;
}

export class CameraSystem {
  private position: Vector2 = new Vector2();
  private targetPosition: Vector2 = new Vector2();
  private focusPosition: Vector2 = new Vector2();

  private viewportWidth: number;
  private viewportHeight: number;

  private bounds: CameraBounds | null = null;
  private target: CameraTarget | null = null;

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
  private npcTarget: CameraTarget | null = null;

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
  setTarget(target: CameraTarget | null): void {
    // Don't override if in NPC focus mode - NPCComponent will release this
    if (!this.npcFocusMode) {
      this.target = target;
    }
  }

  /**
   * Set the NPC target (takes camera focus from player)
   */
  setNPCTarget(target: CameraTarget | null): void {
    // console.log('[CameraSystem] setNPCTarget called with:', target ? 'valid target' : 'null');
    if (target) {
      this.npcFocusMode = true;
      this.npcTarget = target;
      this.target = target;
      // console.log('[CameraSystem] NPC target set, npcFocusMode:', this.npcFocusMode);
    }
  }

  /**
   * Release NPC focus and return to player
   */
  releaseNPCFocus(player: CameraTarget | null): void {
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
  getNPCTarget(): CameraTarget | null {
    return this.npcTarget;
  }

  /**
   * Get the current camera target
   */
  getTarget(): CameraTarget | null {
    return this.target;
  }

  /**
   * Set camera bounds
   */
  setBounds(bounds: CameraBounds | null): void {
    this.bounds = bounds;
  }

  // Debug frame counter
  private debugFrameCount: number = 0;
  
  /**
   * Update the camera
   */
  update(deltaTime: number): void {
    this.debugFrameCount++;
    
    // Always log on frame 1 to confirm update is called
    if (this.debugFrameCount === 1) {
      // console.log(`[CameraSystem] FIRST UPDATE CALL - target exists: ${!!this.target}, npcFocusMode: ${this.npcFocusMode}`);
    }
    
    // Update target position from followed object
    if (this.target) {
      const targetPos = this.target.getPosition();
      // getPosition() returns top-left of sprite, so add half width/height to get center
      const centerX = targetPos.x + this.target.width / 2;
      const centerY = targetPos.y + this.target.height / 2;
      this.targetPosition.set(centerX, centerY);

      // Apply look-ahead bias
      this.targetPosition.x += this.lookAheadX + this.biasX;
      this.targetPosition.y += this.lookAheadY + this.biasY;

      // Convert from center focus point to top-left corner of viewport
      this.targetPosition.x -= this.viewportWidth / 2;
      this.targetPosition.y -= this.viewportHeight / 2;
      
      // Debug every 60 frames
      if (this.debugFrameCount % 60 === 1) {
        // console.log(`[CameraSystem] update frame ${this.debugFrameCount}: targetPos=(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}) center=(${centerX.toFixed(1)}, ${centerY.toFixed(1)}) cameraTarget=(${this.targetPosition.x.toFixed(1)}, ${this.targetPosition.y.toFixed(1)}) cameraPos=(${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)}) focusPos=(${this.focusPosition.x.toFixed(1)}, ${this.focusPosition.y.toFixed(1)})`);
      }
    } else {
      // No target - camera stays where it is
      if (this.debugFrameCount % 60 === 1) {
        // console.log('[CameraSystem] update: No target set!');
      }
    }

    // Smooth camera movement toward target
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
   * x, y are world coordinates where you want the camera centered (e.g., player/NPC position)
   * Internally converts to top-left corner coordinates for rendering
   */
  setPosition(x: number, y: number): void {
    // Convert center point to top-left corner
    let topLeftX = x - this.viewportWidth / 2;
    let topLeftY = y - this.viewportHeight / 2;
    
    // Apply bounds clamping (same as update does)
    if (this.bounds) {
      topLeftX = clamp(
        topLeftX,
        this.bounds.minX,
        this.bounds.maxX - this.viewportWidth
      );
      topLeftY = clamp(
        topLeftY,
        this.bounds.minY,
        this.bounds.maxY - this.viewportHeight
      );
    }
    
    this.position.set(topLeftX, topLeftY);
    this.targetPosition.set(topLeftX, topLeftY);
    // Also set focusPosition immediately so the camera doesn't lerp from (0,0)
    this.focusPosition.set(topLeftX, topLeftY);
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

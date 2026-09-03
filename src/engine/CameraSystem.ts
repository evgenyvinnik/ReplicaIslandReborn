/**
 * Camera System - Manages the game camera
 * Ported from: Original/src/com/replica/replicaisland/CameraSystem.java
 */

import { Vector2 } from '../utils/Vector2';
import { lerp, clamp } from '../utils/helpers';

/**
 * Camera constants, transcribed from CameraSystem.java.
 *
 * The follow distances are a dead zone, not a smoothing factor: the original
 * locks the camera to the target horizontally (X_FOLLOW_DISTANCE is 0) and
 * lets it drift up to 90px *above* the camera before the view rises, so an
 * ordinary jump does not shove the whole screen up and down. Downward it
 * follows immediately.
 *
 * This port used a lerp toward the target instead, which both lagged behind
 * the player horizontally and bobbed vertically on every hop.
 */
const X_FOLLOW_DISTANCE = 0;
const Y_UP_FOLLOW_DISTANCE = 90;
const Y_DOWN_FOLLOW_DISTANCE = 0;
const MAX_INTERPOLATE_TO_TARGET_DISTANCE = 300;
const INTERPOLATE_TO_TARGET_TIME = 1.0;
const SHAKE_FREQUENCY = 40;
const BIAS_SPEED = 400;

export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Camera target interface - needs position, width, and height to center properly
export interface CameraTarget {
  getPosition: () => Vector2;
  /** The original only applies camera bias while the target is moving. */
  getVelocity?: () => Vector2;
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

  // Shake effect
  private shakeIntensity: number = 0;
  private shakeTimer: number = 0;
  private shakeOffset: Vector2 = new Vector2();

  // Bias for following movement direction
  /** Seconds since this camera was created, for target-change easing. */
  private elapsedTime: number = 0;
  /** When the target last changed, or -1 when not interpolating. */
  private targetChangedTime: number = -1;
  private preInterpolateX: number = 0;
  private preInterpolateY: number = 0;
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
    this.shakeTimer = 0;
    this.shakeOffset.zero();
    this.biasX = 0;
    this.biasY = 0;
    this.npcFocusMode = false;
    this.npcTarget = null;
    this.targetChangedTime = -1;
    this.preInterpolateX = 0;
    this.preInterpolateY = 0;
  }

  /**
   * Set the camera target to follow
   * If npcFocusMode is active, this won't override the NPC target
   */
  setTarget(target: CameraTarget | null): void {
    // Don't override if in NPC focus mode - NPCComponent will release this
    if (!this.npcFocusMode) {
      this.beginTargetInterpolation(target);
      this.target = target;
    }
  }

  /**
   * Start easing towards a newly handed-over target instead of cutting to it.
   * The original only does this when the new target is within
   * MAX_INTERPOLATE_TO_TARGET_DISTANCE; further than that it snaps, because
   * sliding the camera across half a level would be worse than a cut.
   */
  private beginTargetInterpolation(next: CameraTarget | null): void {
    if (!next || next === this.target) return;
    const position = next.getPosition();
    const centreX = position.x + next.width / 2;
    const centreY = position.y + next.height / 2;
    const cameraCentreX = this.position.x + this.viewportWidth / 2;
    const cameraCentreY = this.position.y + this.viewportHeight / 2;
    const dx = centreX - cameraCentreX;
    const dy = centreY - cameraCentreY;
    if (dx * dx + dy * dy > MAX_INTERPOLATE_TO_TARGET_DISTANCE * MAX_INTERPOLATE_TO_TARGET_DISTANCE) {
      this.targetChangedTime = -1;
      return;
    }
    this.preInterpolateX = cameraCentreX;
    this.preInterpolateY = cameraCentreY;
    this.targetChangedTime = this.elapsedTime;
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
  
  /**
   * Update the camera
   */
  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    // Shake oscillates the Y axis only, as a sine of the remaining time.
    // Original: mShakeOffsetY = sin(mShakeTime * SHAKE_FREQUENCY) * mShakeMagnitude.
    let shakeOffsetY = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= deltaTime;
      shakeOffsetY = Math.sin(this.shakeTimer * SHAKE_FREQUENCY) * this.shakeIntensity;
    }

    if (this.target) {
      const targetPosition = this.target.getPosition();
      const targetCentreX = targetPosition.x + this.target.width / 2;
      const targetCentreY = targetPosition.y + this.target.height / 2;

      // Work in the camera's centre, which is what the original tracks; the
      // stored position is the viewport's top-left.
      let centreX = this.position.x + this.viewportWidth / 2;
      let centreY = this.position.y + this.viewportHeight / 2;

      if (this.targetChangedTime > 0) {
        // Handing the camera to a new target eases over a second rather than
        // cutting, so a cutscene hand-off is not a jump.
        const delta = this.elapsedTime - this.targetChangedTime;
        const t = Math.min(delta / INTERPOLATE_TO_TARGET_TIME, 1);
        const eased = t * t * (3 - 2 * t);
        centreX = this.preInterpolateX + (targetCentreX - this.preInterpolateX) * eased;
        centreY = this.preInterpolateY + (targetCentreY - this.preInterpolateY) * eased;
        if (delta > INTERPOLATE_TO_TARGET_TIME) {
          this.targetChangedTime = -1;
        }
      } else {
        // Bias only counts while the target is actually moving - no camera
        // motion without player input.
        const biasLengthSquared = this.biasX * this.biasX + this.biasY * this.biasY;
        const velocity = this.target.getVelocity?.();
        const speedSquared = velocity
          ? velocity.x * velocity.x + velocity.y * velocity.y
          : 0;
        if (biasLengthSquared > 0 && speedSquared > 1) {
          const length = Math.sqrt(biasLengthSquared);
          centreX += (this.biasX / length) * BIAS_SPEED * deltaTime;
          centreY += (this.biasY / length) * BIAS_SPEED * deltaTime;
        }

        const xDelta = targetCentreX - centreX;
        if (Math.abs(xDelta) > X_FOLLOW_DISTANCE) {
          centreX = targetCentreX - X_FOLLOW_DISTANCE * Math.sign(xDelta);
        }

        // Y-down conversion: the original's "target is above the camera" is
        // yDelta > 0 in its Y-up space, which is yDelta < 0 here.
        const yDelta = targetCentreY - centreY;
        if (yDelta < -Y_UP_FOLLOW_DISTANCE) {
          centreY = targetCentreY + Y_UP_FOLLOW_DISTANCE;
        } else if (yDelta > Y_DOWN_FOLLOW_DISTANCE) {
          centreY = targetCentreY - Y_DOWN_FOLLOW_DISTANCE;
        }
      }

      this.position.x = centreX - this.viewportWidth / 2;
      this.position.y = centreY - this.viewportHeight / 2;
    }

    // Camera-bias objects submit their influence every frame; the original
    // consumes and clears the accumulated vector after each update.
    this.biasX = 0;
    this.biasY = 0;

    if (this.bounds) {
      this.position.x = clamp(
        this.position.x,
        this.bounds.minX,
        Math.max(this.bounds.minX, this.bounds.maxX - this.viewportWidth)
      );
      this.position.y = clamp(
        this.position.y,
        this.bounds.minY,
        Math.max(this.bounds.minY, this.bounds.maxY - this.viewportHeight)
      );
    }

    // The original floors the focal point so pixel art lands on whole pixels.
    this.shakeOffset.x = 0;
    this.shakeOffset.y = shakeOffsetY;
    this.focusPosition.x = Math.floor(this.position.x);
    this.focusPosition.y = Math.floor(this.position.y + shakeOffsetY);
  }

  /**
   * Shake the camera
   */
  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
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

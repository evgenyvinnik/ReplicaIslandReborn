/**
 * Multi-Sprite Animation Component
 * Handles animations where each frame is a separate sprite image
 * (e.g., energy_ball01, energy_ball02, energy_ball03, energy_ball04)
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { RenderSystem } from '../../engine/RenderSystem';

export class MultiSpriteAnimComponent extends GameComponent {
  private spriteNames: string[] = [];
  private currentFrame: number = 0;
  private frameTimer: number = 0;
  private frameDuration: number = 0.1;
  private loop: boolean = true;
  private renderSystem: RenderSystem | null = null;
  private opacity: number = 1;
  private flipX: boolean = false;
  private flipY: boolean = false;
  private offsetX: number = 0;
  private offsetY: number = 0;

  constructor() {
    super(ComponentPhase.DRAW);
  }

  /**
   * Set the render system reference
   */
  setRenderSystem(renderSystem: RenderSystem): void {
    this.renderSystem = renderSystem;
  }

  /**
   * Set the sequence of sprite names to animate through
   */
  setSpriteSequence(spriteNames: string[], frameDuration: number, loop: boolean = true): void {
    this.spriteNames = spriteNames;
    this.frameDuration = frameDuration;
    this.loop = loop;
    this.currentFrame = 0;
    this.frameTimer = 0;
  }

  /**
   * Set opacity
   */
  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity));
  }

  /**
   * Set sprite flip
   */
  setFlip(flipX: boolean, flipY: boolean): void {
    this.flipX = flipX;
    this.flipY = flipY;
  }

  /**
   * Set sprite offset from object position
   */
  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * Check if the animation has finished (for non-looping animations)
   */
  animationFinished(): boolean {
    if (this.loop) {
      return false;
    }
    return this.currentFrame >= this.spriteNames.length - 1;
  }

  /**
   * Get current sprite name
   */
  getCurrentSpriteName(): string {
    return this.spriteNames[this.currentFrame] || '';
  }

  /**
   * Update animation
   */
  update(deltaTime: number, parent: GameObject): void {
    if (this.spriteNames.length === 0 || !this.renderSystem) return;

    // Update animation frame
    this.frameTimer += deltaTime;

    if (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration;
      this.currentFrame++;

      // Handle animation end
      if (this.currentFrame >= this.spriteNames.length) {
        if (this.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.spriteNames.length - 1;
        }
      }
    }

    // Get current sprite name
    const spriteName = this.spriteNames[this.currentFrame];
    if (!spriteName) return;

    // Only render if the sprite is actually loaded
    if (!this.renderSystem.hasSprite(spriteName)) {
      return;
    }

    // Queue sprite for rendering
    const pos = parent.getPosition();

    // Check flip based on facing direction
    const facingLeft = parent.facingDirection.x < 0;

    this.renderSystem.drawSprite(
      spriteName,
      pos.x + this.offsetX,
      pos.y + this.offsetY,
      0, // frame index (each sprite is a single 32x32 image)
      5, // z-index for projectiles
      this.opacity,
      facingLeft !== this.flipX ? -1 : 1, // scaleX
      this.flipY ? -1 : 1 // scaleY
    );
  }

  /**
   * Reset component
   */
  reset(): void {
    this.currentFrame = 0;
    this.frameTimer = 0;
    this.opacity = 1;
    this.flipX = false;
    this.flipY = false;
  }
}

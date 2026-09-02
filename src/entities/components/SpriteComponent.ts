/**
 * Sprite Component - Handles sprite rendering
 * Ported from: Original/src/com/replica/replicaisland/SpriteComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { AnimationDefinition } from '../../types';
import type { GameObject } from '../GameObject';
import type { RenderSystem } from '../../engine/RenderSystem';
import { DynamicCollisionComponent } from './DynamicCollisionComponent';
import type { CollisionVolume } from '../../engine/collision/CollisionVolume';

export class SpriteComponent extends GameComponent {
  /** Receives each frame's collision volumes. */
  private collisionComponent: DynamicCollisionComponent | null = null;
  /** Draw order, matching the original's SortConstants. */
  private priority: number = 0;

  private spriteName: string = '';
  private currentFrame: number = 0;
  private frameTimer: number = 0;
  private animations: Map<string, AnimationDefinition> = new Map();
  private animationsByIndex: AnimationDefinition[] = [];
  private currentAnimation: AnimationDefinition | null = null;
  private currentAnimationIndex: number = -1;
  private animationComplete: boolean = false;
  private renderSystem: RenderSystem | null = null;
  private opacity: number = 1;
  private visible: boolean = true;
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
   * Set the sprite sheet name
   */
  setSprite(name: string): void {
    this.spriteName = name;
  }

  /**
   * Add an animation
   */
  addAnimation(name: string, animation: AnimationDefinition): void {
    this.animations.set(name, animation);
  }

  /**
   * Add an animation at a specific index
   */
  addAnimationAtIndex(index: number, animation: AnimationDefinition): void {
    this.animationsByIndex[index] = animation;
  }

  /**
   * Play an animation by name
   */
  playAnimation(nameOrIndex: string | number): void {
    let animation: AnimationDefinition | undefined;
    
    if (typeof nameOrIndex === 'number') {
      // Play by index
      if (nameOrIndex === this.currentAnimationIndex) {
        return; // Already playing this animation
      }
      if (nameOrIndex === -1) {
        // Stop animation
        this.currentAnimation = null;
        this.currentAnimationIndex = -1;
        this.animationComplete = false;
        return;
      }
      animation = this.animationsByIndex[nameOrIndex];
      if (animation && animation !== this.currentAnimation) {
        this.currentAnimation = animation;
        this.currentAnimationIndex = nameOrIndex;
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.animationComplete = false;
      }
    } else {
      // Play by name
      animation = this.animations.get(nameOrIndex);
      if (animation && animation !== this.currentAnimation) {
        this.currentAnimation = animation;
        this.currentAnimationIndex = -1;
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.animationComplete = false;
      }
    }
  }

  /**
   * Check if the current animation has finished (for non-looping animations)
   */
  animationFinished(): boolean {
    if (!this.currentAnimation) {
      return true;
    }
    if (this.currentAnimation.loop) {
      return false; // Looping animations never "finish"
    }
    return this.animationComplete;
  }

  /**
   * Get current animation index
   */
  getCurrentAnimationIndex(): number {
    return this.currentAnimationIndex;
  }

  /**
   * Get current animation (if any)
   */
  getCurrentAnimation(): AnimationDefinition | null {
    return this.currentAnimation;
  }

  /**
   * Find an animation by index
   * Returns the animation if it exists, null otherwise
   */
  findAnimation(index: number): AnimationDefinition | null {
    return this.animationsByIndex[index] ?? null;
  }

  /**
   * Find an animation by name
   */
  findAnimationByName(name: string): AnimationDefinition | null {
    return this.animations.get(name) ?? null;
  }

  /**
   * Get current animation time
   */
  getCurrentAnimationTime(): number {
    return this.frameTimer;
  }

  /**
   * Set current animation time offset
   */
  setCurrentAnimationTime(time: number): void {
    this.frameTimer = time;
    if (this.currentAnimation) {
      // Calculate the correct frame based on time
      const totalFrameTime = this.currentAnimation.frames.reduce(
        (sum, frame) => sum + (frame.duration || 0.1),
        0
      );
      if (totalFrameTime > 0) {
        const normalizedTime = time % totalFrameTime;
        let accumulatedTime = 0;
        for (let i = 0; i < this.currentAnimation.frames.length; i++) {
          accumulatedTime += this.currentAnimation.frames[i].duration || 0.1;
          if (normalizedTime <= accumulatedTime) {
            this.currentFrame = i;
            break;
          }
        }
      }
    }
  }

  /**
   * Play animation based on action type
   */
  playAnimationForAction(action: ActionType): void {
    const animationName = this.getAnimationNameForAction(action);
    this.playAnimation(animationName);
  }

  private getAnimationNameForAction(action: ActionType): string {
    switch (action) {
      case ActionType.IDLE:
        return 'idle';
      case ActionType.MOVE:
        return 'walk';
      case ActionType.ATTACK:
        return 'attack';
      case ActionType.HIT_REACT:
        return 'hit';
      case ActionType.DEATH:
        return 'death';
      case ActionType.FROZEN:
        return 'frozen';
      default:
        return 'idle';
    }
  }

  /**
   * Set sprite opacity
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
   * Update animation
   */
  update(deltaTime: number, parent: GameObject): void {
    if (!this.currentAnimation) return;

    // Update animation frame
    this.frameTimer += deltaTime;
    const currentFrameData = this.currentAnimation.frames[this.currentFrame];

    if (currentFrameData && this.frameTimer >= currentFrameData.duration) {
      this.frameTimer -= currentFrameData.duration;
      this.currentFrame++;

      // Handle animation end
      if (this.currentFrame >= this.currentAnimation.frames.length) {
        if (this.currentAnimation.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.currentAnimation.frames.length - 1;
          this.animationComplete = true;
        }
      }
    }

    // Hand this frame's collision volumes to the object, the way the original
    // does: an AnimationFrame carries its hitboxes alongside its texture, so an
    // enemy's volumes change with what it is doing. `undefined` on a frame means
    // "leave the current volumes alone".
    this.applyFrameVolumes(parent);

    // Some campaign objects are rendered by Game's atlas-aware renderer, but
    // their SpriteComponent still owns animation timing/state.
    if (!this.renderSystem || !this.visible) return;

    const frameData = this.currentAnimation.frames[this.currentFrame];
    // A frame may name its own image; the port's art is individual files rather
    // than sheets, so most animations are a list of sprite names.
    const spriteName = frameData?.sprite ?? this.spriteName;

    // Only render if the sprite is actually loaded (don't use placeholders)
    // This allows Game.tsx to handle fallback rendering with colored rectangles
    if (!this.renderSystem.hasSprite(spriteName)) {
      return;
    }

    // Queue sprite for rendering
    const pos = parent.getPosition();
    const frame = frameData?.sprite !== undefined ? 0 : this.getCurrentFrameIndex();

    // Check flip based on facing direction
    const facingLeft = parent.facingDirection.x < 0;

    this.renderSystem.drawSprite(
      spriteName,
      pos.x + this.offsetX + (frameData?.offsetX ?? 0),
      pos.y + this.offsetY + (frameData?.offsetY ?? 0),
      frame,
      this.priority,
      this.opacity,
      facingLeft !== this.flipX ? -1 : 1, // scaleX
      this.flipY ? -1 : 1 // scaleY
    );
  }

  /**
   * Push the current frame's collision volumes to the object's
   * DynamicCollisionComponent. Frames that define no volumes leave whatever is
   * already set in place, so an animation only has to declare them where they
   * change.
   */
  private applyFrameVolumes(parent: GameObject): void {
    const frameData = this.currentAnimation?.frames[this.currentFrame];
    if (!frameData) return;
    if (frameData.attackVolumes === undefined && frameData.vulnerabilityVolumes === undefined) {
      return;
    }

    const collision = this.collisionComponent
      ?? parent.getComponent(DynamicCollisionComponent);
    if (!collision) return;
    this.collisionComponent = collision;

    collision.setCollisionVolumes(
      (frameData.attackVolumes ?? null) as CollisionVolume[] | null,
      (frameData.vulnerabilityVolumes ?? null) as CollisionVolume[] | null
    );
  }

  /**
   * Link the collision component that receives this sprite's frame volumes.
   * Original: `sprite.setCollisionComponent(collision)`.
   */
  setCollisionComponent(collision: DynamicCollisionComponent): void {
    this.collisionComponent = collision;
  }

  /**
   * Whether this sprite draws. The original achieves the same thing by swapping
   * the render component in and out (ChangeComponentsComponent); hiding keeps
   * animation and volume timing running, which is what the swap-in expects.
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  /**
   * What this sprite is drawing right now: its image name, draw offset and
   * priority. MotionBlurComponent reads this to build its trail, the way the
   * original reads the DrawableBitmap off its target RenderComponent.
   */
  getCurrentDraw(): {
    sprite: string;
    frame: number;
    offsetX: number;
    offsetY: number;
    priority: number;
  } | null {
    const frameData = this.currentAnimation?.frames[this.currentFrame];
    const sprite = frameData?.sprite ?? this.spriteName;
    if (!sprite) return null;
    return {
      sprite,
      frame: frameData?.sprite !== undefined ? 0 : this.getCurrentFrameIndex(),
      offsetX: this.offsetX + (frameData?.offsetX ?? 0),
      offsetY: this.offsetY + (frameData?.offsetY ?? 0),
      priority: this.priority,
    };
  }

  /** Draw order for this sprite; see SortConstants in the original. */
  setPriority(priority: number): void {
    this.priority = priority;
  }

  /**
   * Get current frame index for sprite sheet
   */
  private getCurrentFrameIndex(): number {
    if (!this.currentAnimation || this.currentAnimation.frames.length === 0) {
      return 0;
    }

    // Calculate frame index based on position in sprite sheet
    // This assumes frames are sequential in the sprite sheet
    return this.currentFrame;
  }

  /**
   * Reset component
   */
  reset(): void {
    this.currentFrame = 0;
    this.frameTimer = 0;
    this.currentAnimation = null;
    this.currentAnimationIndex = -1;
    this.animationComplete = false;
    this.opacity = 1;
    this.visible = true;
    this.flipX = false;
    this.flipY = false;
    this.collisionComponent = null;
    this.priority = 0;
  }
}

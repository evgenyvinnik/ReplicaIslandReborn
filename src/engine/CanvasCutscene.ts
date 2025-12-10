/**
 * Canvas-based Cutscene System
 * Renders cutscenes directly to Canvas instead of React DOM
 * 
 * Ported from: Original/src/com/replica/replicaisland/AnimationPlayerActivity.java
 * 
 * Handles:
 * - Kyle death animation (frame-by-frame)
 * - Ending cutscenes (parallax scrolling layers)
 * - Touch/click to skip functionality
 */

import {
  CutsceneType,
  getCutscene,
  type CutsceneDefinition,
  type AnimationLayer,
} from '../data/cutscenes';
import { assetPath } from '../utils/helpers';

/**
 * Accelerate-decelerate interpolation function
 * Matches Android's AccelerateDecelerateInterpolator
 */
function accelerateDecelerateInterpolation(t: number): number {
  return (Math.cos((t + 1) * Math.PI) / 2.0) + 0.5;
}

/**
 * Calculate animated value for a layer at current time
 */
function getAnimatedPosition(
  layer: AnimationLayer,
  elapsedTime: number
): { x: number; y: number } {
  // Not started yet
  if (elapsedTime < layer.startOffset) {
    return { x: layer.fromX, y: layer.fromY };
  }

  // Animation complete
  if (elapsedTime >= layer.startOffset + layer.duration) {
    return { x: layer.toX, y: layer.toY };
  }

  // Calculate progress with interpolation
  const progress = (elapsedTime - layer.startOffset) / layer.duration;
  const interpolated = accelerateDecelerateInterpolation(progress);

  return {
    x: layer.fromX + (layer.toX - layer.fromX) * interpolated,
    y: layer.fromY + (layer.toY - layer.fromY) * interpolated,
  };
}

interface CutsceneState {
  cutscene: CutsceneDefinition | null;
  startTime: number;
  currentFrame: number;
  canSkip: boolean;
  showHint: boolean;
  isLoading: boolean;
}

export class CanvasCutscene {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  
  // State
  private state: CutsceneState = {
    cutscene: null,
    startTime: 0,
    currentFrame: 0,
    canSkip: false,
    showHint: false,
    isLoading: true,
  };
  
  // Loaded images
  private images: Map<string, HTMLImageElement> = new Map();
  
  // Timers
  private frameTimer: number | null = null;
  private skipTimer: number | null = null;
  
  // Callbacks
  private onComplete: (() => void) | null = null;
  
  // Hint animation
  private hintOpacity: number = 0.3;
  private hintFadeDirection: number = 1;
  
  // Bound handlers
  private boundHandleKeyDown: (e: KeyboardEvent) => void;
  private boundHandleClick: (e: MouseEvent | TouchEvent) => void;
  
  constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, width: number, height: number) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
  }
  
  /**
   * Set canvas dimensions
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
  
  /**
   * Start playing a cutscene
   */
  async play(cutsceneType: CutsceneType, onComplete: () => void): Promise<void> {
    this.state.cutscene = getCutscene(cutsceneType);
    this.state.startTime = performance.now();
    this.state.currentFrame = 0;
    this.state.canSkip = false;
    this.state.showHint = false;
    this.state.isLoading = true;
    this.onComplete = onComplete;
    
    // Attach event listeners
    this.attach();
    
    // Preload images
    await this.preloadImages();
    
    this.state.isLoading = false;
    this.state.startTime = performance.now();
    
    // Start frame animation timer if needed
    if (this.state.cutscene?.frameAnimation) {
      this.startFrameAnimation();
    }
    
    // Start skip timer
    this.startSkipTimer();
  }
  
  /**
   * Stop cutscene
   */
  stop(): void {
    this.cleanupTimers();
    this.detach();
    this.state.cutscene = null;
    this.onComplete = null;
  }
  
  /**
   * Check if cutscene is active
   */
  isActive(): boolean {
    return this.state.cutscene !== null;
  }
  
  /**
   * Preload all images for the cutscene
   */
  private async preloadImages(): Promise<void> {
    if (!this.state.cutscene) return;
    
    const imagesToLoad: string[] = [];
    
    if (this.state.cutscene.frameAnimation) {
      imagesToLoad.push(...this.state.cutscene.frameAnimation.frames);
    }
    
    if (this.state.cutscene.layers) {
      for (const layer of this.state.cutscene.layers) {
        if (!imagesToLoad.includes(layer.sprite)) {
          imagesToLoad.push(layer.sprite);
        }
      }
    }
    
    if (imagesToLoad.length === 0) return;
    
    const loadPromises = imagesToLoad.map(src => this.loadImage(src));
    await Promise.all(loadPromises);
  }
  
  private loadImage(src: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.images.has(src)) {
        resolve();
        return;
      }
      
      const img = new Image();
      img.onload = (): void => {
        this.images.set(src, img);
        resolve();
      };
      img.onerror = (): void => {
        // console.log(`Failed to load cutscene image: ${src}`);
        resolve();
      };
      // Handle both relative and absolute paths
      img.src = src.startsWith('/') || src.startsWith('http') ? assetPath(src) : assetPath('/' + src);
    });
  }
  
  /**
   * Start frame animation timer
   */
  private startFrameAnimation(): void {
    if (!this.state.cutscene?.frameAnimation) return;
    
    const { frameDuration } = this.state.cutscene.frameAnimation;
    
    this.frameTimer = window.setInterval(() => {
      this.advanceFrame();
    }, frameDuration);
  }
  
  /**
   * Advance to next frame
   */
  private advanceFrame(): void {
    if (!this.state.cutscene?.frameAnimation) return;
    
    const { frames, loop } = this.state.cutscene.frameAnimation;
    const next = this.state.currentFrame + 1;
    
    if (next >= frames.length) {
      if (loop) {
        this.state.currentFrame = 0;
      } else {
        this.state.currentFrame = frames.length - 1;
        // Auto-complete after a brief pause
        if (this.state.canSkip) {
          setTimeout(() => this.complete(), 500);
        }
      }
    } else {
      this.state.currentFrame = next;
    }
  }
  
  /**
   * Start skip timer
   */
  private startSkipTimer(): void {
    if (!this.state.cutscene) return;
    
    this.skipTimer = window.setTimeout(() => {
      this.state.canSkip = true;
      this.state.showHint = true;
    }, this.state.cutscene.totalDuration);
  }
  
  /**
   * Cleanup timers
   */
  private cleanupTimers(): void {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.skipTimer) {
      clearTimeout(this.skipTimer);
      this.skipTimer = null;
    }
  }
  
  /**
   * Attach event listeners
   */
  private attach(): void {
    window.addEventListener('keydown', this.boundHandleKeyDown);
    this.canvas.addEventListener('click', this.boundHandleClick);
    this.canvas.addEventListener('touchend', this.boundHandleClick);
  }
  
  /**
   * Detach event listeners
   */
  private detach(): void {
    window.removeEventListener('keydown', this.boundHandleKeyDown);
    this.canvas.removeEventListener('click', this.boundHandleClick);
    this.canvas.removeEventListener('touchend', this.boundHandleClick);
  }
  
  /**
   * Handle keyboard input
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      this.trySkip();
    }
  }
  
  /**
   * Handle click/tap
   */
  private handleClick(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this.trySkip();
  }
  
  /**
   * Try to skip cutscene
   */
  private trySkip(): void {
    if (this.state.canSkip) {
      this.complete();
    }
  }
  
  /**
   * Complete the cutscene
   */
  private complete(): void {
    this.cleanupTimers();
    this.detach();
    
    const callback = this.onComplete;
    
    this.state.cutscene = null;
    this.onComplete = null;
    
    callback?.();
  }
  
  /**
   * Update cutscene animation
   */
  update(deltaTime: number): void {
    if (!this.state.cutscene || this.state.isLoading) return;
    
    // Update hint opacity animation
    if (this.state.showHint) {
      this.hintOpacity += deltaTime * 0.001 * this.hintFadeDirection;
      if (this.hintOpacity >= 0.8) {
        this.hintOpacity = 0.8;
        this.hintFadeDirection = -1;
      } else if (this.hintOpacity <= 0.3) {
        this.hintOpacity = 0.3;
        this.hintFadeDirection = 1;
      }
    }
  }
  
  /**
   * Render cutscene to canvas
   */
  render(): void {
    if (!this.state.cutscene) return;
    
    this.ctx.save();
    
    // Clear/fill background
    this.ctx.fillStyle = this.state.cutscene.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    if (this.state.isLoading) {
      this.renderLoading();
    } else if (this.state.cutscene.frameAnimation) {
      this.renderFrameAnimation();
    } else if (this.state.cutscene.layers) {
      this.renderParallaxLayers();
    }
    
    // Render skip hint
    if (this.state.showHint) {
      this.renderHint();
    }
    
    this.ctx.restore();
  }
  
  /**
   * Render loading state
   */
  private renderLoading(): void {
    this.ctx.font = '12px "Press Start 2P", monospace';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Loading...', this.width / 2, this.height / 2);
  }
  
  /**
   * Render frame-by-frame animation
   */
  private renderFrameAnimation(): void {
    if (!this.state.cutscene?.frameAnimation) return;
    
    const frameSrc = this.state.cutscene.frameAnimation.frames[this.state.currentFrame];
    const img = this.images.get(frameSrc);
    
    if (img) {
      this.ctx.imageSmoothingEnabled = false;
      const x = (this.width - img.width) / 2;
      const y = (this.height - img.height) / 2;
      this.ctx.drawImage(img, x, y);
    }
  }
  
  /**
   * Render parallax layers
   */
  private renderParallaxLayers(): void {
    if (!this.state.cutscene?.layers) return;
    
    const elapsedTime = performance.now() - this.state.startTime;
    
    // Sort layers by z-order
    const sortedLayers = [...this.state.cutscene.layers].sort((a, b) => a.zOrder - b.zOrder);
    
    this.ctx.imageSmoothingEnabled = false;
    
    for (const layer of sortedLayers) {
      const img = this.images.get(layer.sprite);
      if (!img) continue;
      
      const pos = getAnimatedPosition(layer, elapsedTime);
      
      // Center the image in the canvas
      const x = (this.width - img.width) / 2 + pos.x;
      const y = (this.height - img.height) / 2 + pos.y;
      
      this.ctx.drawImage(img, x, y);
    }
  }
  
  /**
   * Render skip hint
   */
  private renderHint(): void {
    this.ctx.font = '8px "Press Start 2P", monospace';
    this.ctx.fillStyle = `rgba(255, 255, 255, ${this.hintOpacity})`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText('TAP TO CONTINUE', this.width / 2, this.height - 16);
  }
}

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
  elapsedTime: number;
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
    elapsedTime: 0,
    currentFrame: 0,
    canSkip: false,
    showHint: false,
    isLoading: true,
  };
  
  // Loaded images
  private images: Map<string, HTMLImageElement> = new Map();
  
  // A replaced/stopped play cannot finish loading into its successor.
  private playVersion: number = 0;
  
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
    this.stop();
    const version = this.playVersion;
    this.state.cutscene = getCutscene(cutsceneType);
    this.state.elapsedTime = 0;
    this.state.currentFrame = 0;
    this.state.canSkip = false;
    this.state.showHint = false;
    this.state.isLoading = true;
    this.onComplete = onComplete;
    this.hintOpacity = 0.3;
    this.hintFadeDirection = 1;
    
    // Attach event listeners
    this.attach();
    
    // Preload images
    await this.preloadImages();
    if (version !== this.playVersion) return;
    
    this.state.isLoading = false;
    this.update(0);
  }
  
  /**
   * Stop cutscene
   */
  stop(): void {
    this.playVersion++;
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
      e.preventDefault();
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
    const callback = this.onComplete;
    this.stop();
    callback?.();
  }
  
  /**
   * Update cutscene animation
   */
  update(deltaTime: number): void {
    if (!this.state.cutscene || this.state.isLoading) return;
    // One display-time clock drives frames, parallax and skip eligibility.
    // No wall-clock callbacks may outlive this playback or advance a later one.
    this.state.elapsedTime += Math.max(0, deltaTime) * 1000;
    const { frameAnimation, totalDuration } = this.state.cutscene;
    if (frameAnimation) {
      const frame = Math.floor(this.state.elapsedTime / frameAnimation.frameDuration);
      if (!frameAnimation.loop && frame >= frameAnimation.frames.length) {
        this.complete();
        return;
      }
      this.state.currentFrame = frame % frameAnimation.frames.length;
    }
    this.state.canSkip = this.state.elapsedTime >= totalDuration;
    this.state.showHint = this.state.canSkip && !frameAnimation;
    
    // Update hint opacity animation
    if (this.state.showHint) {
      this.hintOpacity += deltaTime * this.hintFadeDirection;
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
      this.renderTextPanel();
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
    
    const elapsedTime = this.state.elapsedTime;
    
    // Sort layers by z-order
    const sortedLayers = [...this.state.cutscene.layers].sort((a, b) => a.zOrder - b.zOrder);
    
    this.ctx.imageSmoothingEnabled = false;
    
    for (const layer of sortedLayers) {
      const img = this.images.get(layer.sprite);
      if (!img) continue;
      
      const pos = getAnimatedPosition(layer, elapsedTime);
      
      // Original layouts anchor oversized layers at the top-left of a 480×320
      // stage. Centering each image crops the scene and exposes blank edges.
      const x = (this.width - 480) / 2 + pos.x;
      const y = (this.height - 320) / 2 + pos.y;
      
      this.ctx.drawImage(img, x, y);
    }
  }

  private renderTextPanel(): void {
    const panel = this.state.cutscene?.textPanel;
    if (!panel) return;
    const progress = Math.max(0, Math.min(1,
      (this.state.elapsedTime - panel.startOffset) / panel.duration));
    const remaining = 1 - accelerateDecelerateInterpolation(progress);
    const x = (this.width - 480) / 2 + panel.x + panel.fromX * remaining;
    const y = (this.height - 320) / 2 + panel.y + panel.fromY * remaining;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, panel.width, panel.height, 10);
    this.ctx.fill();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const lines = panel.text === 'THANKS FOR PLAYING!' ? ['THANKS FOR', 'PLAYING!'] : [panel.text];
    lines.forEach((line, index) => this.ctx.fillText(line, x + panel.width / 2,
      y + panel.height / 2 + (index - (lines.length - 1) / 2) * 24));
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

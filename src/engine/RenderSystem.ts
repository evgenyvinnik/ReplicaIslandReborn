/**
 * Render System - Canvas 2D rendering
 * Ported from: Original/src/com/replica/replicaisland/RenderSystem.java
 */

import type { RenderCommand, CameraState } from '../types';
import { placeholders } from '../utils/PlaceholderSprites';
import { assetPath } from '../utils/helpers';

export interface Sprite {
  image: HTMLImageElement | HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
  framesPerRow: number;
}

export class RenderSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprites: Map<string, Sprite> = new Map();

  // Double buffering with render queues
  private renderQueue: RenderCommand[] = [];
  private backgroundQueue: RenderCommand[] = [];

  // Camera state
  private camera: CameraState = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    width: 480,
    height: 320,
    zoom: 1,
  };

  // Debug rendering
  private debugMode: boolean = false;
  private debugColor: string = '#00ff00';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = ctx;

    // Disable image smoothing for pixel art
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Set canvas size
   */
  setSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.width = width;
    this.camera.height = height;
    // Re-disable image smoothing after resize
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Get canvas width
   */
  getWidth(): number {
    return this.canvas.width;
  }

  /**
   * Get canvas height
   */
  getHeight(): number {
    return this.canvas.height;
  }

  /**
   * Get the 2D rendering context (for advanced effects like glow)
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Set camera position
   */
  setCamera(x: number, y: number): void {
    this.camera.x = x;
    this.camera.y = y;
  }

  /**
   * Get camera state
   */
  getCamera(): CameraState {
    return this.camera;
  }

  /**
   * Load a sprite sheet
   */
  async loadSprite(
    name: string,
    url: string,
    frameWidth: number,
    frameHeight: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = (): void => {
        const framesPerRow = Math.floor(image.width / frameWidth);
        this.sprites.set(name, {
          image,
          frameWidth,
          frameHeight,
          framesPerRow,
        });
        resolve();
      };
      image.onerror = (): void => {
        reject(new Error(`Failed to load sprite: ${name}`));
      };
      image.src = url;
    });
  }

  /**
   * Check if a sprite is loaded
   */
  hasSprite(name: string): boolean {
    return this.sprites.has(name);
  }

  /**
   * Get a loaded sprite's image (for direct rendering)
   */
  getSpriteImage(name: string): HTMLImageElement | HTMLCanvasElement | null {
    const sprite = this.sprites.get(name);
    return sprite ? sprite.image : null;
  }

  /**
   * Load a single image (no frames)
   */
  async loadSingleImage(name: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = (): void => {
        this.sprites.set(name, {
          image,
          frameWidth: image.width,
          frameHeight: image.height,
          framesPerRow: 1,
        });
        resolve();
      };
      image.onerror = (): void => {
        reject(new Error(`Failed to load image: ${name}`));
      };
      image.src = url;
    });
  }

  /**
   * Load a tileset image
   * Tilesets use 32x32 tiles arranged in a grid
   */
  async loadTileset(name: string, url: string, tileSize: number = 32): Promise<void> {
    return this.loadSprite(name, url, tileSize, tileSize);
  }

  /**
   * Load all game tilesets
   */
  async loadAllTilesets(): Promise<void> {
    const tilesets = [
      'grass',
      'island',
      'sewage',
      'cave',
      'lab',
      'tutorial',
      'titletileset',
    ];

    const tileSize = 32;
    const loadPromises = tilesets.map(name =>
      this.loadTileset(name, assetPath(`/assets/sprites/${name}.png`), tileSize).catch(err => {
        console.warn(`Failed to load tileset ${name}:`, err);
      })
    );

    await Promise.all(loadPromises);
  }

  /**
   * Register a canvas-based sprite directly
   */
  registerCanvasSprite(
    name: string,
    canvas: HTMLCanvasElement,
    frameWidth?: number,
    frameHeight?: number
  ): void {
    const fw = frameWidth || canvas.width;
    const fh = frameHeight || canvas.height;
    const framesPerRow = Math.floor(canvas.width / fw);
    this.sprites.set(name, {
      image: canvas,
      frameWidth: fw,
      frameHeight: fh,
      framesPerRow: Math.max(1, framesPerRow),
    });
  }

  /**
   * Queue a sprite for rendering
   */
  drawSprite(
    spriteName: string,
    x: number,
    y: number,
    frame: number = 0,
    z: number = 0,
    alpha: number = 1,
    scaleX: number = 1,
    scaleY: number = 1,
    rotation: number = 0
  ): void {
    this.renderQueue.push({
      type: 'sprite',
      sprite: spriteName,
      x,
      y,
      z,
      frame,
      alpha,
      scaleX,
      scaleY,
      rotation,
    });
  }

  /**
   * Queue a rectangle for rendering
   */
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    z: number = 0,
    alpha: number = 1
  ): void {
    this.renderQueue.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      color,
      z,
      alpha,
    });
  }

  /**
   * Queue text for rendering
   */
  drawText(
    text: string,
    x: number,
    y: number,
    color: string = '#ffffff',
    z: number = 100
  ): void {
    this.renderQueue.push({
      type: 'text',
      text,
      x,
      y,
      color,
      z,
    });
  }

  /**
   * Queue a tile for rendering (background layer)
   */
  drawTile(
    spriteName: string,
    x: number,
    y: number,
    tileIndex: number,
    z: number = -10
  ): void {
    this.backgroundQueue.push({
      type: 'tile',
      sprite: spriteName,
      x,
      y,
      z,
      frame: tileIndex,
    });
  }

  /**
   * Clear the canvas
   */
  clear(color: string = '#1a1a2e'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render all queued commands
   * Note: Does NOT clear - caller should clear before frame starts
   * to allow direct canvas drawing (like tiles) before queued rendering
   */
  render(): void {
    // Don't clear here - we clear at the start of the frame in Game.tsx
    // This allows TileMapRenderer to draw directly before we render queued commands

    // Combine and sort queues by z-index
    const allCommands = [...this.backgroundQueue, ...this.renderQueue];
    allCommands.sort((a, b) => a.z - b.z);

    // Save context state
    this.ctx.save();

    // Apply camera transform
    this.ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

    // Render each command
    for (const cmd of allCommands) {
      this.renderCommand(cmd);
    }

    // Restore context state
    this.ctx.restore();

    // Clear queues for next frame
    this.renderQueue = [];
    this.backgroundQueue = [];
  }

  /**
   * Render a single command
   */
  private renderCommand(cmd: RenderCommand): void {
    this.ctx.globalAlpha = cmd.alpha ?? 1;

    switch (cmd.type) {
      case 'sprite':
      case 'tile':
        this.renderSprite(cmd);
        break;
      case 'rect':
        this.renderRect(cmd);
        break;
      case 'text':
        this.renderText(cmd);
        break;
    }

    this.ctx.globalAlpha = 1;
  }

  /**
   * Render a sprite
   */
  private renderSprite(cmd: RenderCommand): void {
    let sprite = this.sprites.get(cmd.sprite!);
    
    // Use placeholder if sprite not loaded
    if (!sprite) {
      const placeholder = placeholders.getSprite(cmd.sprite!, cmd.frame ?? 0);
      sprite = {
        image: placeholder,
        frameWidth: placeholder.width,
        frameHeight: placeholder.height,
        framesPerRow: 1,
      };
    }

    const frame = cmd.frame ?? 0;
    const srcX = (frame % sprite.framesPerRow) * sprite.frameWidth;
    const srcY = Math.floor(frame / sprite.framesPerRow) * sprite.frameHeight;

    const scaleX = cmd.scaleX ?? 1;
    const scaleY = cmd.scaleY ?? 1;
    const rotation = cmd.rotation ?? 0;

    const destX = Math.floor(cmd.x);
    const destY = Math.floor(cmd.y);
    const destWidth = sprite.frameWidth * Math.abs(scaleX);
    const destHeight = sprite.frameHeight * Math.abs(scaleY);

    if (rotation !== 0 || scaleX < 0 || scaleY < 0) {
      this.ctx.save();
      this.ctx.translate(destX + destWidth / 2, destY + destHeight / 2);
      this.ctx.rotate(rotation);
      this.ctx.scale(scaleX < 0 ? -1 : 1, scaleY < 0 ? -1 : 1);
      this.ctx.drawImage(
        sprite.image,
        srcX,
        srcY,
        sprite.frameWidth,
        sprite.frameHeight,
        -destWidth / 2,
        -destHeight / 2,
        destWidth,
        destHeight
      );
      this.ctx.restore();
    } else {
      this.ctx.drawImage(
        sprite.image,
        srcX,
        srcY,
        sprite.frameWidth,
        sprite.frameHeight,
        destX,
        destY,
        destWidth,
        destHeight
      );
    }
  }

  /**
   * Render a rectangle
   */
  private renderRect(cmd: RenderCommand): void {
    this.ctx.fillStyle = cmd.color ?? '#ffffff';
    this.ctx.fillRect(
      Math.floor(cmd.x),
      Math.floor(cmd.y),
      cmd.width ?? 0,
      cmd.height ?? 0
    );
  }

  /**
   * Render text
   */
  private renderText(cmd: RenderCommand): void {
    this.ctx.fillStyle = cmd.color ?? '#ffffff';
    this.ctx.font = '16px monospace';
    this.ctx.fillText(cmd.text ?? '', Math.floor(cmd.x), Math.floor(cmd.y));
  }

  /**
   * Swap render queues (for double buffering pattern from original)
   */
  swap(cameraX: number, cameraY: number): void {
    this.camera.x = cameraX;
    this.camera.y = cameraY;
    this.render();
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Draw a debug rectangle (collision box, etc.)
   */
  drawDebugRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color?: string
  ): void {
    if (!this.debugMode) return;

    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);
    this.ctx.strokeStyle = color ?? this.debugColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.restore();
  }

  /**
   * Draw a debug line
   */
  drawDebugLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color?: string
  ): void {
    if (!this.debugMode) return;

    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);
    this.ctx.strokeStyle = color ?? this.debugColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Draw directly to screen (for HUD, etc.)
   */
  drawToScreen(
    callback: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  ): void {
    this.ctx.save();
    callback(this.ctx, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /**
   * Empty the render queues
   */
  emptyQueues(): void {
    this.renderQueue = [];
    this.backgroundQueue = [];
  }
}

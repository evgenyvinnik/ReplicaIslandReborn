/**
 * Canvas-based Pause Menu
 * Renders pause overlay directly to Canvas instead of React DOM
 * 
 * Original: res/layout/main.xml - ImageView with @drawable/ui_paused
 */

import { assetPath } from '../utils/helpers';

export class CanvasPauseMenu {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  
  // State
  private isActive: boolean = false;
  
  // Loaded image
  private pausedImage: HTMLImageElement | null = null;
  private imageLoaded: boolean = false;
  
  // Callbacks
  private onResume: (() => void) | null = null;
  
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
    
    // Preload the pause image
    this.preload();
  }
  
  /**
   * Preload pause image
   */
  preload(): void {
    const img = new Image();
    img.onload = (): void => {
      this.pausedImage = img;
      this.imageLoaded = true;
    };
    img.onerror = (): void => {
      console.warn('Failed to load pause image');
    };
    img.src = assetPath('/assets/sprites/ui_paused.png');
  }
  
  /**
   * Set canvas dimensions
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
  
  /**
   * Show pause menu
   */
  show(onResume: () => void): void {
    this.isActive = true;
    this.onResume = onResume;
    this.attach();
  }
  
  /**
   * Hide pause menu
   */
  hide(): void {
    this.isActive = false;
    this.onResume = null;
    this.detach();
  }
  
  /**
   * Check if pause menu is active
   */
  isShowing(): boolean {
    return this.isActive;
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
    e.preventDefault();
    this.resume();
  }
  
  /**
   * Handle click/tap
   */
  private handleClick(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this.resume();
  }
  
  /**
   * Resume game
   */
  private resume(): void {
    this.detach();
    this.isActive = false;
    this.onResume?.();
    this.onResume = null;
  }
  
  /**
   * Render pause menu to canvas
   */
  render(): void {
    if (!this.isActive) return;
    
    this.ctx.save();
    
    // Semi-transparent backdrop
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw paused image centered
    if (this.pausedImage && this.imageLoaded) {
      this.ctx.imageSmoothingEnabled = false;
      const x = (this.width - this.pausedImage.width) / 2;
      const y = (this.height - this.pausedImage.height) / 2;
      this.ctx.drawImage(this.pausedImage, x, y);
    } else {
      // Fallback text if image not loaded
      this.ctx.font = 'bold 24px "Press Start 2P", monospace';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
    }
    
    // Hint text
    this.ctx.font = '8px "Press Start 2P", monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText('Press any key to continue', this.width / 2, this.height - 16);
    
    this.ctx.restore();
  }
}

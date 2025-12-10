/**
 * Canvas-based HUD System
 * Renders HUD elements directly to Canvas instead of React DOM
 * 
 * Matches the original HudSystem.java layout from Replica Island
 */

import { assetPath } from '../utils/helpers';

// ============================================================================
// HUD Layout Constants (from original HudSystem.java)
// ============================================================================

const FUEL_BAR_EDGE_PADDING = 15;
const FUEL_DECREASE_BAR_SPEED = 0.75;
const FUEL_INCREASE_BAR_SPEED = 2.0;

const COLLECTABLE_EDGE_PADDING = 8;
const RUBY_OFFSET_FROM_CENTER = 100;

const FUEL_BAR_BG_WIDTH = 128;
const FUEL_BAR_BG_HEIGHT = 16;
const FUEL_BAR_INNER_OFFSET = 2;
const FUEL_BAR_INNER_MAX_WIDTH = 96;

const COIN_SPRITE_SIZE = 16;

const DIGIT_SPRITE_WIDTH = 32;
const DIGIT_SPRITE_HEIGHT = 32;
const DIGIT_CHARACTER_WIDTH = DIGIT_SPRITE_WIDTH / 2;

const X_MARK_SIZE = 32;
const FPS_EDGE_PADDING = 10;

// Toast display constants (from original CustomToastSystem.java)
const TOAST_DURATION_LONG = 3.5;  // Toast.LENGTH_LONG in Android
const TOAST_DURATION_SHORT = 2.0; // Toast.LENGTH_SHORT in Android
const TOAST_FADE_DURATION = 0.3;
const TOAST_PADDING = 16;
const TOAST_FONT_SIZE = 14;
const TOAST_BG_COLOR = 'rgba(0, 0, 0, 0.75)';
const TOAST_TEXT_COLOR = '#ffffff';
const TOAST_BORDER_COLOR = '#4080ff';
const TOAST_BORDER_WIDTH = 2;

export class CanvasHUD {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  // Loaded sprites
  private sprites: Map<string, HTMLImageElement> = new Map();
  private spritesLoaded: boolean = false;
  
  // Animated fuel value
  private displayFuel: number = 1;
  private targetFuel: number = 1;
  
  // Inventory state
  private coins: number = 0;
  private rubies: number = 0;
  
  // FPS display
  private showFPS: boolean = false;
  private fps: number = 60;
  
  // Toast state (for memory playback messages, diary found, etc.)
  private toastMessage: string | null = null;
  private toastTimeRemaining: number = 0;
  private toastOpacity: number = 0;
  
  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }
  
  /**
   * Preload all HUD sprites
   */
  async preload(): Promise<void> {
    const spriteNames = [
      'ui_bar_bg',
      'ui_bar',
      'ui_x',
      'ui_0', 'ui_1', 'ui_2', 'ui_3', 'ui_4',
      'ui_5', 'ui_6', 'ui_7', 'ui_8', 'ui_9',
      'object_coin01',
      'object_ruby01',
    ];
    
    const loadPromises = spriteNames.map(name => this.loadSprite(name));
    await Promise.all(loadPromises);
    this.spritesLoaded = true;
  }
  
  private loadSprite(name: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = (): void => {
        this.sprites.set(name, img);
        resolve();
      };
      img.onerror = (): void => {
        // console.log(`Failed to load HUD sprite: ${name}`);
        resolve(); // Don't fail on missing sprites
      };
      img.src = assetPath(`/assets/sprites/${name}.png`);
    });
  }
  
  /**
   * Set canvas dimensions
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
  
  /**
   * Set fuel value (0-1)
   */
  setFuel(fuel: number): void {
    this.targetFuel = Math.max(0, Math.min(1, fuel));
  }
  
  /**
   * Set inventory values
   */
  setInventory(coins: number, rubies: number): void {
    this.coins = coins;
    this.rubies = rubies;
  }
  
  /**
   * Set whether to show FPS
   */
  setShowFPS(show: boolean): void {
    this.showFPS = show;
  }
  
  /**
   * Set current FPS value
   */
  setFPS(fps: number): void {
    this.fps = fps;
  }
  
  /**
   * Show a toast message (like Android Toast)
   * @param message The message to display
   * @param durationLong If true, use long duration (3.5s), otherwise short (2s)
   */
  showToast(message: string, durationLong: boolean = true): void {
    this.toastMessage = message;
    this.toastTimeRemaining = durationLong ? TOAST_DURATION_LONG : TOAST_DURATION_SHORT;
    this.toastOpacity = 1;
  }
  
  /**
   * Clear any active toast
   */
  clearToast(): void {
    this.toastMessage = null;
    this.toastTimeRemaining = 0;
    this.toastOpacity = 0;
  }
  
  /**
   * Update animated values
   */
  update(deltaTime: number): void {
    // Animate fuel bar
    if (Math.abs(this.displayFuel - this.targetFuel) > 0.001) {
      if (this.displayFuel < this.targetFuel) {
        this.displayFuel = Math.min(
          this.displayFuel + FUEL_INCREASE_BAR_SPEED * deltaTime,
          this.targetFuel
        );
      } else {
        this.displayFuel = Math.max(
          this.displayFuel - FUEL_DECREASE_BAR_SPEED * deltaTime,
          this.targetFuel
        );
      }
    }
    
    // Update toast animation
    if (this.toastTimeRemaining > 0) {
      this.toastTimeRemaining -= deltaTime;
      
      // Fade out during last TOAST_FADE_DURATION seconds
      if (this.toastTimeRemaining <= TOAST_FADE_DURATION) {
        this.toastOpacity = Math.max(0, this.toastTimeRemaining / TOAST_FADE_DURATION);
      } else {
        this.toastOpacity = 1;
      }
      
      // Clear toast when done
      if (this.toastTimeRemaining <= 0) {
        this.toastMessage = null;
        this.toastOpacity = 0;
      }
    }
  }
  
  /**
   * Render HUD to canvas
   */
  render(): void {
    if (!this.spritesLoaded) return;
    
    this.ctx.save();
    
    // Disable smoothing for pixel art
    this.ctx.imageSmoothingEnabled = false;
    
    // Draw fuel bar (top-left)
    this.drawFuelBar();
    
    // Draw coins (center-top)
    this.drawCoins();
    
    // Draw rubies (center-top, offset right)
    this.drawRubies();
    
    // Draw FPS (bottom-right)
    if (this.showFPS) {
      this.drawFPS();
    }
    
    // Draw toast message (center-bottom)
    if (this.toastMessage && this.toastOpacity > 0) {
      this.drawToast();
    }
    
    this.ctx.restore();
  }
  
  private drawToast(): void {
    if (!this.toastMessage) return;
    
    this.ctx.save();
    this.ctx.globalAlpha = this.toastOpacity;
    
    // Measure text
    this.ctx.font = `bold ${TOAST_FONT_SIZE}px Arial, sans-serif`;
    const textMetrics = this.ctx.measureText(this.toastMessage);
    const textWidth = textMetrics.width;
    const textHeight = TOAST_FONT_SIZE;
    
    // Calculate toast box dimensions
    const boxWidth = textWidth + TOAST_PADDING * 2;
    const boxHeight = textHeight + TOAST_PADDING * 2;
    
    // Position at center-bottom (like Android toast)
    const x = (this.width - boxWidth) / 2;
    const y = this.height - boxHeight - 40; // 40px from bottom
    
    // Draw background with border
    this.ctx.fillStyle = TOAST_BG_COLOR;
    this.ctx.strokeStyle = TOAST_BORDER_COLOR;
    this.ctx.lineWidth = TOAST_BORDER_WIDTH;
    
    // Rounded rectangle
    const radius = 8;
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + boxWidth - radius, y);
    this.ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
    this.ctx.lineTo(x + boxWidth, y + boxHeight - radius);
    this.ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
    this.ctx.lineTo(x + radius, y + boxHeight);
    this.ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw text
    this.ctx.fillStyle = TOAST_TEXT_COLOR;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.toastMessage, this.width / 2, y + boxHeight / 2);
    
    this.ctx.restore();
  }
  
  private drawFuelBar(): void {
    const barBg = this.sprites.get('ui_bar_bg');
    const bar = this.sprites.get('ui_bar');
    if (!barBg || !bar) return;
    
    const x = FUEL_BAR_EDGE_PADDING;
    const y = FUEL_BAR_EDGE_PADDING;
    
    // Draw background
    this.ctx.drawImage(barBg, x, y, FUEL_BAR_BG_WIDTH, FUEL_BAR_BG_HEIGHT);
    
    // Draw fuel bar (inner)
    const barWidth = Math.floor(FUEL_BAR_INNER_MAX_WIDTH * this.displayFuel);
    if (barWidth > 0) {
      // The bar sprite is small, stretch it
      this.ctx.drawImage(
        bar,
        x + FUEL_BAR_INNER_OFFSET,
        y + FUEL_BAR_INNER_OFFSET,
        barWidth,
        FUEL_BAR_BG_HEIGHT - FUEL_BAR_INNER_OFFSET * 2
      );
    }
  }
  
  private drawCoins(): void {
    const coinSprite = this.sprites.get('object_coin01');
    if (!coinSprite) return;
    
    const centerX = this.width / 2;
    const y = COLLECTABLE_EDGE_PADDING;
    
    // Draw coin icon
    const iconX = centerX - COIN_SPRITE_SIZE / 2 - 50;
    this.ctx.drawImage(coinSprite, iconX, y, COIN_SPRITE_SIZE, COIN_SPRITE_SIZE);
    
    // Draw "x" and count
    this.drawNumber(this.coins, iconX + COIN_SPRITE_SIZE + 4, y - 8, true);
  }
  
  private drawRubies(): void {
    const rubySprite = this.sprites.get('object_ruby01');
    if (!rubySprite) return;
    
    const centerX = this.width / 2 + RUBY_OFFSET_FROM_CENTER;
    const y = COLLECTABLE_EDGE_PADDING;
    
    // Draw ruby icon (scale down to match coins visually)
    const displaySize = 24;
    const iconX = centerX - displaySize / 2;
    this.ctx.drawImage(rubySprite, iconX, y, displaySize, displaySize);
    
    // Draw "x" and count
    this.drawNumber(this.rubies, iconX + displaySize + 4, y - 4, true);
  }
  
  private drawFPS(): void {
    const x = this.width - FPS_EDGE_PADDING;
    const y = this.height - FPS_EDGE_PADDING - DIGIT_SPRITE_HEIGHT;
    
    // Draw FPS number right-aligned
    const digits = this.intToDigitArray(Math.round(this.fps));
    const totalWidth = digits.length * DIGIT_CHARACTER_WIDTH;
    this.drawNumber(Math.round(this.fps), x - totalWidth, y, false);
  }
  
  /**
   * Draw a number using digit sprites
   */
  private drawNumber(value: number, x: number, y: number, drawX: boolean = false): void {
    const digits = this.intToDigitArray(value);
    let currentX = x;
    
    if (drawX) {
      const xMark = this.sprites.get('ui_x');
      if (xMark) {
        this.ctx.drawImage(xMark, currentX, y, X_MARK_SIZE, X_MARK_SIZE);
        currentX += DIGIT_CHARACTER_WIDTH; // Half overlap
      }
    }
    
    for (const digit of digits) {
      const digitSprite = this.sprites.get(`ui_${digit}`);
      if (digitSprite) {
        this.ctx.drawImage(digitSprite, currentX, y, DIGIT_SPRITE_WIDTH, DIGIT_SPRITE_HEIGHT);
        currentX += DIGIT_CHARACTER_WIDTH; // Half overlap for compact display
      }
    }
  }
  
  /**
   * Convert integer to digit array
   */
  private intToDigitArray(value: number): number[] {
    const digits: number[] = [];
    const v = Math.max(0, Math.floor(value));
    
    let characterCount = 1;
    if (v >= 1000) characterCount = 4;
    else if (v >= 100) characterCount = 3;
    else if (v >= 10) characterCount = 2;
    
    let remainingValue = v;
    for (let i = characterCount - 1; i >= 0; i--) {
      digits[i] = remainingValue % 10;
      remainingValue = Math.floor(remainingValue / 10);
    }
    
    return digits;
  }
}

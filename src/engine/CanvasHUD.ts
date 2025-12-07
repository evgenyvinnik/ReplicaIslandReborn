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
        console.warn(`Failed to load HUD sprite: ${name}`);
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

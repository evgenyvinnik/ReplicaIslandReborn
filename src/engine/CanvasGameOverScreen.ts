/**
 * Canvas-based Game Over Screen
 * Renders game over overlay directly to Canvas instead of React DOM
 * 
 * Shows when the player runs out of lives
 */

import { getInventory, resetInventory } from '../entities/components/InventoryComponent';

interface MenuOption {
  label: string;
  action: 'retry' | 'menu';
}

export class CanvasGameOverScreen {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  
  // State
  private isActive: boolean = false;
  private selectedOption: number = 0;
  private isFlickering: boolean = false;
  private flickerTimer: number = 0;
  private showStats: boolean = false;
  private showStatsTimer: number = 0;
  private pulseTimer: number = 0;
  
  // Menu options
  private options: MenuOption[] = [
    { label: 'Try Again', action: 'retry' },
    { label: 'Main Menu', action: 'menu' },
  ];
  
  // Callbacks
  private onRetry: (() => void) | null = null;
  private onMainMenu: (() => void) | null = null;
  
  // Bound handlers
  private boundHandleKeyDown: (e: KeyboardEvent) => void;
  private boundHandleClick: (e: MouseEvent) => void;
  
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
   * Show game over screen
   */
  show(onRetry: () => void, onMainMenu: () => void): void {
    this.isActive = true;
    this.onRetry = onRetry;
    this.onMainMenu = onMainMenu;
    this.selectedOption = 0;
    this.isFlickering = false;
    this.showStats = false;
    this.showStatsTimer = 0;
    this.pulseTimer = 0;
    this.attach();
  }
  
  /**
   * Hide game over screen
   */
  hide(): void {
    this.isActive = false;
    this.onRetry = null;
    this.onMainMenu = null;
    this.detach();
  }
  
  /**
   * Check if screen is active
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
  }
  
  /**
   * Detach event listeners
   */
  private detach(): void {
    window.removeEventListener('keydown', this.boundHandleKeyDown);
    this.canvas.removeEventListener('click', this.boundHandleClick);
  }
  
  /**
   * Handle keyboard input
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (this.isFlickering) return;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.selectedOption = (this.selectedOption - 1 + this.options.length) % this.options.length;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.selectedOption = (this.selectedOption + 1) % this.options.length;
        break;
      case 'Enter':
      case ' ':
        this.selectOption();
        break;
    }
  }
  
  /**
   * Handle click
   */
  private handleClick(e: MouseEvent): void {
    if (this.isFlickering) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Check if click is on an option button
    const buttonWidth = 150;
    const buttonHeight = 30;
    const buttonX = (this.width - buttonWidth) / 2;
    const baseY = this.height / 2 + 60;
    
    for (let i = 0; i < this.options.length; i++) {
      const buttonY = baseY + i * 40;
      if (x >= buttonX && x <= buttonX + buttonWidth &&
          y >= buttonY && y <= buttonY + buttonHeight) {
        this.selectedOption = i;
        this.selectOption();
        return;
      }
    }
  }
  
  /**
   * Select current option
   */
  private selectOption(): void {
    this.isFlickering = true;
    this.flickerTimer = 0.4;
  }
  
  /**
   * Execute selected option
   */
  private executeOption(): void {
    const option = this.options[this.selectedOption];
    resetInventory();
    
    this.detach();
    this.isActive = false;
    
    if (option.action === 'retry') {
      this.onRetry?.();
    } else {
      this.onMainMenu?.();
    }
    
    this.onRetry = null;
    this.onMainMenu = null;
  }
  
  /**
   * Update animations
   */
  update(deltaTime: number): void {
    if (!this.isActive) return;
    
    // Update show stats timer
    if (!this.showStats) {
      this.showStatsTimer += deltaTime;
      if (this.showStatsTimer >= 0.5) {
        this.showStats = true;
      }
    }
    
    // Update pulse animation
    this.pulseTimer += deltaTime;
    
    // Update flicker animation
    if (this.isFlickering) {
      this.flickerTimer -= deltaTime;
      if (this.flickerTimer <= 0) {
        this.executeOption();
      }
    }
  }
  
  /**
   * Render game over screen to canvas
   */
  render(): void {
    if (!this.isActive) return;
    
    this.ctx.save();
    
    // Dark backdrop
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Game Over title with pulse effect
    const pulse = 1 + Math.sin(this.pulseTimer * 4) * 0.02;
    this.ctx.save();
    this.ctx.translate(this.width / 2, 60);
    this.ctx.scale(pulse, pulse);
    this.ctx.font = 'bold 24px "Press Start 2P", monospace';
    this.ctx.fillStyle = '#ff4444';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowColor = '#880000';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillText('GAME OVER', 0, 0);
    this.ctx.restore();
    
    // Stats section
    if (this.showStats) {
      const inventory = getInventory();
      const boxX = this.width / 2 - 100;
      const boxY = 100;
      const boxWidth = 200;
      const boxHeight = 90;
      
      // Stats box background
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.strokeStyle = '#666666';
      this.ctx.lineWidth = 2;
      this.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Final Score label
      this.ctx.font = '8px "Press Start 2P", monospace';
      this.ctx.fillStyle = '#aaaaaa';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.shadowColor = 'transparent';
      this.ctx.fillText('Final Score', this.width / 2, boxY + 12);
      
      // Score value
      this.ctx.font = '16px "Press Start 2P", monospace';
      this.ctx.fillStyle = '#ffcc00';
      this.ctx.fillText(inventory.score.toLocaleString(), this.width / 2, boxY + 28);
      
      // Collectibles row
      this.ctx.font = '8px "Press Start 2P", monospace';
      this.ctx.fillStyle = '#88ff88';
      this.ctx.textAlign = 'left';
      
      const statsY = boxY + 60;
      const col1 = boxX + 20;
      const col2 = boxX + 80;
      const col3 = boxX + 140;
      
      // Coins
      this.ctx.fillStyle = '#ffcc00';
      this.ctx.fillText('C', col1, statsY);
      this.ctx.fillStyle = '#88ff88';
      this.ctx.fillText(String(inventory.coinCount), col1 + 12, statsY);
      
      // Rubies
      this.ctx.fillStyle = '#ff6699';
      this.ctx.fillText('R', col2, statsY);
      this.ctx.fillStyle = '#88ff88';
      this.ctx.fillText(String(inventory.rubyCount), col2 + 12, statsY);
      
      // Pearls
      this.ctx.fillStyle = '#66ccff';
      this.ctx.fillText('P', col3, statsY);
      this.ctx.fillStyle = '#88ff88';
      this.ctx.fillText(String(inventory.pearls), col3 + 12, statsY);
    }
    
    // Menu options
    const buttonWidth = 150;
    const buttonHeight = 30;
    const baseY = this.height / 2 + 60;
    
    for (let i = 0; i < this.options.length; i++) {
      const isSelected = this.selectedOption === i;
      const buttonX = (this.width - buttonWidth) / 2;
      const buttonY = baseY + i * 40;
      
      // Flicker effect
      let opacity = 1;
      if (this.isFlickering && isSelected) {
        opacity = Math.floor(this.flickerTimer * 20) % 2 === 0 ? 1 : 0.3;
      }
      
      this.ctx.globalAlpha = opacity;
      
      // Button background
      this.ctx.fillStyle = isSelected ? '#333333' : 'transparent';
      this.ctx.strokeStyle = isSelected ? '#ff4444' : '#666666';
      this.ctx.lineWidth = 2;
      this.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 4);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Button text
      this.ctx.font = '10px "Press Start 2P", monospace';
      this.ctx.fillStyle = isSelected ? '#ff6666' : '#999999';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const prefix = isSelected ? '> ' : '  ';
      this.ctx.fillText(prefix + this.options[i].label, this.width / 2, buttonY + buttonHeight / 2);
      
      this.ctx.globalAlpha = 1;
    }
    
    // Instructions
    this.ctx.font = '6px "Press Start 2P", monospace';
    this.ctx.fillStyle = '#666666';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText('Use UP/DOWN to select, ENTER to confirm', this.width / 2, this.height - 12);
    
    this.ctx.restore();
  }
  
  /**
   * Draw a rounded rectangle
   */
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }
}

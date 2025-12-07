/**
 * Canvas-based Level Complete Screen
 * Renders level complete overlay directly to Canvas instead of React DOM
 */

import { getInventory, resetInventory } from '../entities/components/InventoryComponent';

interface MenuOption {
  label: string;
  action: 'continue' | 'menu';
}

interface LevelStats {
  bestTime: number | null;
  bestScore: number;
  currentTime: number;
}

export class CanvasLevelCompleteScreen {
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
  private showBonus: boolean = false;
  private showBonusTimer: number = 0;
  private pulseTimer: number = 0;
  private lifeBonus: number = 0;
  private finalScore: number = 0;
  private levelName: string = 'Level';
  
  // Level stats for display
  private levelStats: LevelStats = {
    bestTime: null,
    bestScore: 0,
    currentTime: 0,
  };
  private isNewBestTime: boolean = false;
  private isNewHighScore: boolean = false;
  
  // Menu options
  private options: MenuOption[] = [
    { label: 'Continue', action: 'continue' },
    { label: 'Main Menu', action: 'menu' },
  ];
  
  // Callbacks
  private onContinue: (() => void) | null = null;
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
   * Show level complete screen
   * @param levelName The level's display name
   * @param onContinue Callback when continue is selected
   * @param onMainMenu Callback when main menu is selected
   * @param stats Optional level stats (best time, high score, current time)
   */
  show(
    levelName: string,
    onContinue: () => void,
    onMainMenu: () => void,
    stats?: LevelStats
  ): void {
    this.isActive = true;
    this.levelName = levelName;
    this.onContinue = onContinue;
    this.onMainMenu = onMainMenu;
    this.selectedOption = 0;
    this.isFlickering = false;
    this.showStats = false;
    this.showStatsTimer = 0;
    this.showBonus = false;
    this.showBonusTimer = 0;
    this.pulseTimer = 0;
    
    // Calculate life bonus
    const inventory = getInventory();
    this.lifeBonus = inventory.lives * 1000;
    this.finalScore = inventory.score + this.lifeBonus;
    
    // Store stats and check for new records
    if (stats) {
      this.levelStats = stats;
      this.isNewBestTime = stats.bestTime === null || stats.currentTime < stats.bestTime;
      this.isNewHighScore = this.finalScore > stats.bestScore;
    } else {
      this.levelStats = { bestTime: null, bestScore: 0, currentTime: 0 };
      this.isNewBestTime = false;
      this.isNewHighScore = false;
    }
    
    this.attach();
  }
  
  /**
   * Hide level complete screen
   */
  hide(): void {
    this.isActive = false;
    this.onContinue = null;
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
    const baseY = this.height / 2 + 80;
    
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
    
    if (option.action === 'continue') {
      this.onContinue?.();
    } else {
      this.onMainMenu?.();
    }
    
    this.onContinue = null;
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
    
    // Update show bonus timer
    if (this.showStats && !this.showBonus) {
      this.showBonusTimer += deltaTime;
      if (this.showBonusTimer >= 0.5) {
        this.showBonus = true;
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
   * Render level complete screen to canvas
   */
  render(): void {
    if (!this.isActive) return;
    
    this.ctx.save();
    
    // Dark backdrop with green tint
    this.ctx.fillStyle = 'rgba(0, 20, 0, 0.9)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Level Complete title with pulse effect
    const pulse = 1 + Math.sin(this.pulseTimer * 4) * 0.02;
    this.ctx.save();
    this.ctx.translate(this.width / 2, 45);
    this.ctx.scale(pulse, pulse);
    this.ctx.font = 'bold 20px "Press Start 2P", monospace';
    this.ctx.fillStyle = '#44ff44';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowColor = '#008800';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillText('LEVEL COMPLETE', 0, 0);
    this.ctx.restore();
    
    // Level name
    this.ctx.font = '9px "Press Start 2P", monospace';
    this.ctx.fillStyle = '#88cc88';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowColor = 'transparent';
    this.ctx.fillText(this.levelName, this.width / 2, 75);
    
    // Stats section
    if (this.showStats) {
      const inventory = getInventory();
      const boxX = this.width / 2 - 110;
      const boxY = 90;
      const boxWidth = 220;
      const boxHeight = 150;  // Increased height for time display
      
      // Stats box background
      this.ctx.fillStyle = 'rgba(0, 30, 0, 0.7)';
      this.ctx.strokeStyle = '#44aa44';
      this.ctx.lineWidth = 2;
      this.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Base Score label
      this.ctx.font = '8px "Press Start 2P", monospace';
      this.ctx.fillStyle = '#aaaaaa';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText('Score', this.width / 2, boxY + 10);
      
      // Score value with high score indicator
      this.ctx.font = '14px "Press Start 2P", monospace';
      this.ctx.fillStyle = this.isNewHighScore ? '#44ff44' : '#ffcc00';
      this.ctx.fillText(inventory.score.toLocaleString(), this.width / 2, boxY + 22);
      if (this.isNewHighScore) {
        this.ctx.font = '6px "Press Start 2P", monospace';
        this.ctx.fillStyle = '#44ff44';
        this.ctx.fillText('NEW HIGH!', this.width / 2, boxY + 40);
      }
      
      // Time display
      const timeY = boxY + (this.isNewHighScore ? 52 : 44);
      this.ctx.font = '8px "Press Start 2P", monospace';
      this.ctx.fillStyle = '#aaaaaa';
      this.ctx.fillText('Time', this.width / 2, timeY);
      
      const currentTime = this.formatTime(this.levelStats.currentTime);
      this.ctx.font = '10px "Press Start 2P", monospace';
      this.ctx.fillStyle = this.isNewBestTime ? '#44ff44' : '#88ccff';
      this.ctx.fillText(currentTime, this.width / 2, timeY + 12);
      
      if (this.isNewBestTime) {
        this.ctx.font = '6px "Press Start 2P", monospace';
        this.ctx.fillStyle = '#44ff44';
        this.ctx.fillText('BEST TIME!', this.width / 2, timeY + 24);
      } else if (this.levelStats.bestTime !== null) {
        this.ctx.font = '6px "Press Start 2P", monospace';
        this.ctx.fillStyle = '#888888';
        this.ctx.fillText(`Best: ${this.formatTime(this.levelStats.bestTime)}`, this.width / 2, timeY + 24);
      }
      
      // Collectibles row
      this.ctx.font = '8px "Press Start 2P", monospace';
      const statsY = boxY + (this.isNewHighScore || this.isNewBestTime ? 82 : 74);
      const col1 = boxX + 30;
      const col2 = boxX + 80;
      const col3 = boxX + 130;
      const col4 = boxX + 180;
      
      // Coins
      this.ctx.fillStyle = '#ffcc00';
      this.ctx.textAlign = 'left';
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
      
      // Lives
      this.ctx.fillStyle = '#ff8888';
      this.ctx.fillText('L', col4, statsY);
      this.ctx.fillStyle = '#88ff88';
      this.ctx.fillText(String(inventory.lives), col4 + 12, statsY);
      
      // Life bonus section
      if (this.showBonus) {
        const bonusBaseY = statsY + 16;
        
        // Divider line
        this.ctx.strokeStyle = '#44aa44';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(boxX + 20, bonusBaseY);
        this.ctx.lineTo(boxX + boxWidth - 20, bonusBaseY);
        this.ctx.stroke();
        
        // Life Bonus
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Life Bonus', this.width / 2, bonusBaseY + 10);
        
        this.ctx.font = '11px "Press Start 2P", monospace';
        this.ctx.fillStyle = '#44ff44';
        this.ctx.fillText('+' + this.lifeBonus.toLocaleString(), this.width / 2, bonusBaseY + 24);
        
        // Final Score
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.fillText('Final Score', this.width / 2, bonusBaseY + 40);
        
        this.ctx.font = '11px "Press Start 2P", monospace';
        this.ctx.fillStyle = '#ffff44';
        this.ctx.fillText(this.finalScore.toLocaleString(), this.width / 2, bonusBaseY + 54);
      }
    }
    
    // Menu options
    const buttonWidth = 150;
    const buttonHeight = 30;
    const baseY = this.height / 2 + 80;
    
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
      this.ctx.fillStyle = isSelected ? '#113311' : 'transparent';
      this.ctx.strokeStyle = isSelected ? '#44ff44' : '#336633';
      this.ctx.lineWidth = 2;
      this.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 4);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Button text
      this.ctx.font = '10px "Press Start 2P", monospace';
      this.ctx.fillStyle = isSelected ? '#66ff66' : '#669966';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const prefix = isSelected ? '> ' : '  ';
      this.ctx.fillText(prefix + this.options[i].label, this.width / 2, buttonY + buttonHeight / 2);
      
      this.ctx.globalAlpha = 1;
    }
    
    // Instructions
    this.ctx.font = '6px "Press Start 2P", monospace';
    this.ctx.fillStyle = '#336633';
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
  
  /**
   * Format time in seconds to MM:SS.cc format
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const centisecs = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centisecs.toString().padStart(2, '0')}`;
  }
}

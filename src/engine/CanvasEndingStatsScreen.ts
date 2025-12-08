/**
 * Canvas-based Ending Stats Screen
 * Renders game completion stats directly to Canvas after completing all endings
 * Shows total stats across the playthrough: play time, score, enemies defeated, etc.
 */

interface EndingStats {
  totalPlayTime: number; // In seconds
  totalScore: number;
  totalCoinsCollected: number;
  totalRubiesCollected: number;
  totalEnemiesDefeated: number;
  totalDeaths: number;
  diariesCollected: number;
  totalDiaries: number;
  ending: 'good' | 'bad' | 'neutral';
}

export class CanvasEndingStatsScreen {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  
  // State
  private isActive: boolean = false;
  private stats: EndingStats | null = null;
  private showTimer: number = 0;
  private lineRevealIndex: number = 0;
  private pulseTimer: number = 0;
  private canContinue: boolean = false;
  
  // Callbacks
  private onContinue: (() => void) | null = null;
  
  // Bound handlers
  private boundHandleKeyDown: (e: KeyboardEvent) => void;
  private boundHandleClick: (e: MouseEvent) => void;
  
  // Animation constants
  private readonly LINE_REVEAL_DELAY = 0.4; // Time between each stat line
  private readonly CAN_CONTINUE_DELAY = 2.0; // Time before allowing continue
  
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
   * Show ending stats screen
   */
  show(stats: EndingStats, onContinue: () => void): void {
    this.isActive = true;
    this.stats = stats;
    this.onContinue = onContinue;
    this.showTimer = 0;
    this.lineRevealIndex = 0;
    this.pulseTimer = 0;
    this.canContinue = false;
    
    this.attach();
  }
  
  /**
   * Hide ending stats screen
   */
  hide(): void {
    this.isActive = false;
    this.stats = null;
    this.onContinue = null;
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
    if (!this.isActive || !this.canContinue) return;
    
    // Any key to continue
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      this.selectContinue();
    }
  }
  
  /**
   * Handle click input
   */
  private handleClick(e: MouseEvent): void {
    if (!this.isActive || !this.canContinue) return;
    
    e.preventDefault();
    this.selectContinue();
  }
  
  /**
   * Select continue option
   */
  private selectContinue(): void {
    if (this.onContinue) {
      this.hide();
      this.onContinue();
    }
  }
  
  /**
   * Format time as HH:MM:SS or MM:SS
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Get ending title based on ending type
   */
  private getEndingTitle(): string {
    if (!this.stats) return 'Game Complete';
    
    switch (this.stats.ending) {
      case 'good':
        return 'True Ending!';
      case 'bad':
        return 'Game Over...';
      case 'neutral':
      default:
        return 'Game Complete';
    }
  }
  
  /**
   * Update screen state
   */
  update(deltaTime: number): void {
    if (!this.isActive) return;
    
    this.showTimer += deltaTime;
    this.pulseTimer += deltaTime * 2;
    
    // Reveal stats lines one by one
    const targetLines = 7; // Number of stat lines
    const newLineIndex = Math.floor(this.showTimer / this.LINE_REVEAL_DELAY);
    if (newLineIndex > this.lineRevealIndex && this.lineRevealIndex < targetLines) {
      this.lineRevealIndex = Math.min(newLineIndex, targetLines);
    }
    
    // Allow continue after delay
    if (this.showTimer >= this.CAN_CONTINUE_DELAY) {
      this.canContinue = true;
    }
  }
  
  /**
   * Render the ending stats screen
   */
  render(): void {
    if (!this.isActive || !this.stats) return;
    
    const ctx = this.ctx;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Calculate dimensions
    const boxWidth = Math.min(400, this.width - 40);
    const boxHeight = Math.min(320, this.height - 40);
    const boxX = (this.width - boxWidth) / 2;
    const boxY = (this.height - boxHeight) / 2;
    
    // Draw box background
    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    // Draw box border
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // Title with pulsing effect
    const pulse = Math.sin(this.pulseTimer) * 0.2 + 0.8;
    ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`; // Gold color
    ctx.font = 'bold 24px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.getEndingTitle(), this.width / 2, boxY + 35);
    
    // Stats
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    
    const statStartY = boxY + 70;
    const lineHeight = 28;
    const labelX = boxX + 30;
    const valueX = boxX + boxWidth - 30;
    
    const statLines = [
      { label: 'Play Time', value: this.formatTime(this.stats.totalPlayTime) },
      { label: 'Final Score', value: this.stats.totalScore.toLocaleString() },
      { label: 'Coins', value: this.stats.totalCoinsCollected.toLocaleString() },
      { label: 'Rubies', value: this.stats.totalRubiesCollected.toLocaleString() },
      { label: 'Enemies', value: this.stats.totalEnemiesDefeated.toLocaleString() },
      { label: 'Deaths', value: this.stats.totalDeaths.toLocaleString() },
      { label: 'Diaries', value: `${this.stats.diariesCollected}/${this.stats.totalDiaries}` },
    ];
    
    // Draw revealed stat lines
    for (let i = 0; i < Math.min(this.lineRevealIndex, statLines.length); i++) {
      const stat = statLines[i];
      const y = statStartY + i * lineHeight;
      
      // Fade in effect for newly revealed lines
      const lineAge = this.showTimer - (i * this.LINE_REVEAL_DELAY);
      const alpha = Math.min(1, lineAge / 0.2);
      
      // Label
      ctx.fillStyle = `rgba(200, 200, 255, ${alpha})`;
      ctx.textAlign = 'left';
      ctx.fillText(stat.label, labelX, y);
      
      // Value
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.textAlign = 'right';
      ctx.fillText(stat.value, valueX, y);
    }
    
    // Draw separator line after all stats revealed
    if (this.lineRevealIndex >= statLines.length) {
      ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(labelX, statStartY + statLines.length * lineHeight + 5);
      ctx.lineTo(valueX, statStartY + statLines.length * lineHeight + 5);
      ctx.stroke();
    }
    
    // Continue prompt (pulsing)
    if (this.canContinue) {
      const promptPulse = Math.sin(this.pulseTimer * 2) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${promptPulse})`;
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press any key to continue', this.width / 2, boxY + boxHeight - 25);
    }
    
    // Thank you message
    ctx.fillStyle = 'rgba(180, 180, 220, 0.8)';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Thanks for playing!', this.width / 2, boxY + boxHeight - 10);
  }
}

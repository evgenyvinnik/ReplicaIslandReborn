/**
 * Canvas-based Diary Overlay
 * Shows diary entries when the player collects a diary item
 * 
 * Based on the original DiaryActivity.java
 */

import { DiaryEntry } from '../data/diaries';
import { assetPath } from '../utils/helpers';

// Layout constants
const PADDING = 20;
const TITLE_FONT_SIZE = 18;
const TEXT_FONT_SIZE = 14;
const LINE_HEIGHT = 1.4;
const MAX_TEXT_WIDTH_RATIO = 0.85;

export class CanvasDiaryOverlay {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  
  // State
  private visible: boolean = false;
  private currentEntry: DiaryEntry | null = null;
  private onClose: (() => void) | null = null;
  
  // Background image
  private bgImage: HTMLImageElement | null = null;
  
  // Animation
  private fadeAlpha: number = 0;
  private targetAlpha: number = 0;
  
  // Scrolling
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private lastY: number = 0;
  
  // Bound handlers
  private boundClickHandler: (e: MouseEvent | TouchEvent) => void;
  private boundWheelHandler: (e: globalThis.Event) => void;
  private boundTouchMoveHandler: (e: TouchEvent) => void;
  
  constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, width: number, height: number) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    
    // Bind handlers
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundWheelHandler = this.handleWheel.bind(this);
    this.boundTouchMoveHandler = this.handleTouchMove.bind(this);
    
    // Load background
    this.loadBackground();
  }
  
  private loadBackground(): void {
    this.bgImage = new Image();
    this.bgImage.onerror = (): void => {
      // console.log('Failed to load diary background');
    };
    // Use a dark parchment-like background
    this.bgImage.src = assetPath('/assets/sprites/ui_options_background.png');
  }
  
  /**
   * Show a diary entry
   */
  show(entry: DiaryEntry, onClose?: () => void): void {
    this.currentEntry = entry;
    this.onClose = onClose ?? null;
    this.visible = true;
    this.targetAlpha = 1;
    this.scrollY = 0;
    this.calculateMaxScroll();
    
    // Attach event listeners
    this.canvas.addEventListener('click', this.boundClickHandler);
    this.canvas.addEventListener('touchend', this.boundClickHandler);
    this.canvas.addEventListener('wheel', this.boundWheelHandler);
    this.canvas.addEventListener('touchmove', this.boundTouchMoveHandler, { passive: false });
  }
  
  /**
   * Hide the diary overlay
   */
  hide(): void {
    this.targetAlpha = 0;
    
    // Remove event listeners
    this.canvas.removeEventListener('click', this.boundClickHandler);
    this.canvas.removeEventListener('touchend', this.boundClickHandler);
    this.canvas.removeEventListener('wheel', this.boundWheelHandler);
    this.canvas.removeEventListener('touchmove', this.boundTouchMoveHandler);
  }
  
  /**
   * Check if visible
   */
  isVisible(): boolean {
    return this.visible || this.fadeAlpha > 0;
  }
  
  private handleClick(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    
    // Close on click/tap
    this.hide();
    if (this.onClose) {
      this.onClose();
    }
  }
  
  private handleWheel(e: globalThis.Event): void {
    e.preventDefault();
    const wheelEvent = e as unknown as { deltaY: number };
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + wheelEvent.deltaY * 0.5));
  }
  
  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaY = this.lastY - touch.clientY;
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + deltaY));
      this.lastY = touch.clientY;
    }
  }
  
  private calculateMaxScroll(): void {
    if (!this.currentEntry) {
      this.maxScrollY = 0;
      return;
    }
    
    const maxWidth = this.width * MAX_TEXT_WIDTH_RATIO;
    const lines = this.wrapText(this.currentEntry.text, maxWidth);
    const textHeight = lines.length * TEXT_FONT_SIZE * LINE_HEIGHT;
    const totalHeight = PADDING * 3 + TITLE_FONT_SIZE * 2 + textHeight + PADDING * 2;
    
    this.maxScrollY = Math.max(0, totalHeight - this.height + PADDING * 2);
  }
  
  /**
   * Update animation
   */
  update(deltaTime: number): void {
    // Animate fade
    const fadeSpeed = 4;
    if (this.fadeAlpha < this.targetAlpha) {
      this.fadeAlpha = Math.min(this.targetAlpha, this.fadeAlpha + fadeSpeed * deltaTime);
    } else if (this.fadeAlpha > this.targetAlpha) {
      this.fadeAlpha = Math.max(this.targetAlpha, this.fadeAlpha - fadeSpeed * deltaTime);
    }
    
    // Hide when fully faded out
    if (this.targetAlpha === 0 && this.fadeAlpha <= 0) {
      this.visible = false;
      this.currentEntry = null;
    }
  }
  
  /**
   * Render the diary overlay
   */
  render(): void {
    if (!this.visible && this.fadeAlpha <= 0) return;
    if (!this.currentEntry) return;
    
    this.ctx.save();
    this.ctx.globalAlpha = this.fadeAlpha;
    
    // Draw dark overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw paper-like background
    const bgPadding = PADDING;
    const bgX = bgPadding;
    const bgY = bgPadding;
    const bgWidth = this.width - bgPadding * 2;
    const bgHeight = this.height - bgPadding * 2;
    
    // Paper background with slight transparency
    this.ctx.fillStyle = 'rgba(245, 235, 220, 0.95)';
    this.ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    
    // Paper border
    this.ctx.strokeStyle = 'rgba(139, 90, 43, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
    
    // Create clipping region for scrolling text
    this.ctx.beginPath();
    this.ctx.rect(bgX + 5, bgY + 5, bgWidth - 10, bgHeight - 10);
    this.ctx.clip();
    
    // Starting Y position (with scroll offset)
    let y = bgY + PADDING - this.scrollY;
    
    // Draw "FOUND OLD DIARY" header
    this.ctx.fillStyle = 'rgba(139, 90, 43, 1)';
    this.ctx.font = `bold ${TITLE_FONT_SIZE}px "Courier New", monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('FOUND OLD DIARY', this.width / 2, y + TITLE_FONT_SIZE);
    y += TITLE_FONT_SIZE * 2;
    
    // Draw separator line
    this.ctx.strokeStyle = 'rgba(139, 90, 43, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(bgX + 30, y);
    this.ctx.lineTo(bgX + bgWidth - 30, y);
    this.ctx.stroke();
    y += PADDING;
    
    // Draw entry title
    this.ctx.fillStyle = 'rgba(80, 50, 20, 1)';
    this.ctx.font = `bold ${TEXT_FONT_SIZE + 2}px "Courier New", monospace`;
    this.ctx.textAlign = 'left';
    this.ctx.fillText(this.currentEntry.title, bgX + PADDING, y + TEXT_FONT_SIZE);
    y += TEXT_FONT_SIZE * LINE_HEIGHT + PADDING / 2;
    
    // Draw entry text with word wrapping
    this.ctx.font = `${TEXT_FONT_SIZE}px "Courier New", monospace`;
    this.ctx.fillStyle = 'rgba(60, 40, 20, 1)';
    
    const maxWidth = bgWidth - PADDING * 2;
    const lines = this.wrapText(this.currentEntry.text, maxWidth);
    
    for (const line of lines) {
      this.ctx.fillText(line, bgX + PADDING, y + TEXT_FONT_SIZE);
      y += TEXT_FONT_SIZE * LINE_HEIGHT;
    }
    
    // Reset clip
    this.ctx.restore();
    this.ctx.save();
    this.ctx.globalAlpha = this.fadeAlpha;
    
    // Draw scroll indicator if scrollable
    if (this.maxScrollY > 0) {
      const scrollIndicatorHeight = 30;
      const scrollProgress = this.scrollY / this.maxScrollY;
      const indicatorY = bgY + 10 + (bgHeight - 20 - scrollIndicatorHeight) * scrollProgress;
      
      this.ctx.fillStyle = 'rgba(139, 90, 43, 0.5)';
      this.ctx.fillRect(bgX + bgWidth - 10, indicatorY, 4, scrollIndicatorHeight);
    }
    
    // Draw "tap to close" hint
    this.ctx.fillStyle = 'rgba(100, 70, 40, 0.8)';
    this.ctx.font = `italic ${TEXT_FONT_SIZE - 2}px "Courier New", monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Tap anywhere to close', this.width / 2, this.height - bgPadding - 5);
    
    this.ctx.restore();
  }
  
  /**
   * Word wrap text to fit within max width
   */
  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    
    // Split by newlines first
    const paragraphs = text.split('\n');
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push('');
        continue;
      }
      
      const words = paragraph.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = this.ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    
    return lines;
  }
  
  /**
   * Set canvas dimensions
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.calculateMaxScroll();
  }
}

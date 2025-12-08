/**
 * Canvas-based Dialog System
 * Renders dialog boxes and typewriter text directly to Canvas instead of React DOM
 * 
 * Matches the original ConversationDialogActivity.java layout from Replica Island
 */

import type { Dialog, Conversation, Character } from '../data/dialogs';
import { getCharacterName } from '../data/dialogs';
import { assetPath } from '../utils/helpers';

// Character name colors
const CHARACTER_COLORS: Record<Character, string> = {
  Wanda: '#ff88cc',
  Kyle: '#88ccff',
  Kabocha: '#88ff88',
  Rokudou: '#ffcc88',
};

// Layout constants
const DIALOG_BOX_MARGIN = 16;
const DIALOG_BOX_PADDING = 12;
const PORTRAIT_SIZE = 80;
const TEXT_GAP = 12;
const TEXT_LINE_HEIGHT = 18;
const CURSOR_BLINK_RATE = 500;

interface DialogState {
  conversationIndex: number;
  pageIndex: number;
}

export class CanvasDialog {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  
  // Current dialog
  private dialog: Dialog | null = null;
  private state: DialogState = {
    conversationIndex: 0,
    pageIndex: 0,
  };
  
  // Loaded portraits cache
  private portraits: Map<string, HTMLImageElement> = new Map();
  
  // Cursor blink state
  private cursorVisible: boolean = true;
  private lastCursorBlink: number = 0;
  
  // Callbacks
  private onComplete: (() => void) | null = null;
  private onSkip: (() => void) | null = null;
  
  // Single conversation mode - only show one conversation then complete
  private singleConversation: boolean = false;
  
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
   * Start showing a dialog
   * @param dialog The dialog to show
   * @param onComplete Callback when dialog is complete
   * @param onSkip Optional callback when dialog is skipped
   * @param conversationIndex Optional index of which conversation to start at (default 0)
   * @param singleConversation If true, only show one conversation then complete (default false)
   */
  show(
    dialog: Dialog, 
    onComplete: () => void, 
    onSkip?: () => void, 
    conversationIndex: number = 0,
    singleConversation: boolean = false
  ): void {
    this.dialog = dialog;
    this.onComplete = onComplete;
    this.onSkip = onSkip ?? null;
    this.singleConversation = singleConversation;
    
    // Clamp conversation index to valid range
    const validConvIndex = Math.min(
      Math.max(0, conversationIndex), 
      dialog.conversations.length - 1
    );
    
    this.state = {
      conversationIndex: validConvIndex,
      pageIndex: 0,
    };
    
    // Preload all portraits in this dialog
    this.preloadPortraits();
    
    // Attach event listeners
    this.attach();
  }
  
  /**
   * Hide dialog
   */
  hide(): void {
    this.dialog = null;
    this.detach();
  }
  
  /**
   * Check if dialog is active
   */
  isActive(): boolean {
    return this.dialog !== null;
  }
  
  /**
   * Preload portrait images
   */
  private preloadPortraits(): void {
    if (!this.dialog) return;
    
    const portraitsToLoad = new Set<string>();
    for (const conversation of this.dialog.conversations) {
      for (const page of conversation.pages) {
        portraitsToLoad.add(page.portrait);
      }
    }
    
    for (const portraitPath of portraitsToLoad) {
      if (!this.portraits.has(portraitPath)) {
        const img = new Image();
        img.src = assetPath(portraitPath);
        img.onload = (): void => {
          this.portraits.set(portraitPath, img);
        };
      }
    }
  }
  
  /**
   * Attach event listeners
   */
  private attach(): void {
    window.addEventListener('keydown', this.boundHandleKeyDown);
    this.canvas.addEventListener('click', this.boundHandleClick);
    this.canvas.addEventListener('touchstart', this.boundHandleClick);
  }
  
  /**
   * Detach event listeners
   */
  private detach(): void {
    window.removeEventListener('keydown', this.boundHandleKeyDown);
    this.canvas.removeEventListener('click', this.boundHandleClick);
    this.canvas.removeEventListener('touchstart', this.boundHandleClick);
  }
  
  /**
   * Handle keyboard input
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      this.advance();
    } else if (e.key === 'Escape' && this.onSkip) {
      e.preventDefault();
      this.onSkip();
    }
  }
  
  /**
   * Handle click/tap
   */
  private handleClick(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this.advance();
  }
  
  /**
   * Advance to next page or complete dialog
   */
  private advance(): void {
    if (!this.dialog) return;
    
    const currentConversation: Conversation | undefined = this.dialog.conversations[this.state.conversationIndex];
    
    if (!currentConversation) return;
    
    // Advance to next page
    if (this.state.pageIndex < currentConversation.pages.length - 1) {
      this.state.pageIndex++;
      return;
    }
    
    // If in single conversation mode, complete after this conversation
    if (this.singleConversation) {
      this.detach();
      this.dialog = null;
      this.singleConversation = false;
      this.onComplete?.();
      return;
    }
    
    // Advance to next conversation
    if (this.state.conversationIndex < this.dialog.conversations.length - 1) {
      this.state.conversationIndex++;
      this.state.pageIndex = 0;
      return;
    }
    
    // Dialog complete
    this.detach();
    this.dialog = null;
    this.onComplete?.();
  }
  
  /**
   * Update dialog state
   */
  update(_deltaTime: number): void {
    if (!this.dialog) return;
    
    const now = performance.now();
    
    // Update cursor blink for "tap to continue" indicator
    if (now - this.lastCursorBlink > CURSOR_BLINK_RATE) {
      this.cursorVisible = !this.cursorVisible;
      this.lastCursorBlink = now;
    }
  }
  
  /**
   * Render dialog to canvas
   */
  render(): void {
    if (!this.dialog) return;
    
    const currentConversation = this.dialog.conversations[this.state.conversationIndex];
    const currentPage = currentConversation?.pages[this.state.pageIndex];
    
    if (!currentPage) return;
    
    this.ctx.save();
    
    // No backdrop - let the gameplay be visible behind the dialog
    
    // Calculate text area width first to determine line count
    const boxX = DIALOG_BOX_MARGIN;
    const boxWidth = this.width - DIALOG_BOX_MARGIN * 2;
    const textWidth = boxWidth - DIALOG_BOX_PADDING * 2 - PORTRAIT_SIZE - TEXT_GAP;
    
    // Pre-calculate wrapped text lines to determine box height
    this.ctx.font = '12px monospace';
    const fullTextLines = this.wrapText(currentPage.text, textWidth);
    const textHeight = Math.max(fullTextLines.length * TEXT_LINE_HEIGHT, PORTRAIT_SIZE - 24); // At least portrait height minus name
    
    // Calculate dialog box dimensions dynamically based on content
    // Height = padding + name line + text lines + padding + hint line
    const minBoxHeight = PORTRAIT_SIZE + DIALOG_BOX_PADDING * 2 + 20; // Minimum height with portrait
    const contentBoxHeight = DIALOG_BOX_PADDING + 24 + textHeight + DIALOG_BOX_PADDING + 16; // name(24) + text + hint(16)
    const boxHeight = Math.max(minBoxHeight, contentBoxHeight);
    
    // Position dialog at top of screen so it doesn't cover the action below
    // But cap it so it doesn't exceed a reasonable portion of the screen
    const maxBoxHeight = this.height * 0.4; // Max 40% of screen height
    const finalBoxHeight = Math.min(boxHeight, maxBoxHeight);
    const boxY = DIALOG_BOX_MARGIN;
    
    // Draw dialog box background
    this.ctx.fillStyle = 'rgba(0, 20, 40, 0.95)';
    this.ctx.strokeStyle = '#446688';
    this.ctx.lineWidth = 3;
    this.roundRect(boxX, boxY, boxWidth, finalBoxHeight, 8);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw portrait
    const portraitX = boxX + DIALOG_BOX_PADDING;
    const portraitY = boxY + DIALOG_BOX_PADDING;
    
    // Portrait border
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.strokeStyle = '#446688';
    this.ctx.lineWidth = 2;
    this.roundRect(portraitX, portraitY, PORTRAIT_SIZE, PORTRAIT_SIZE, 4);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Portrait image
    const portrait = this.portraits.get(currentPage.portrait);
    if (portrait) {
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(portrait, portraitX + 4, portraitY + 4, PORTRAIT_SIZE - 8, PORTRAIT_SIZE - 8);
    }
    
    // Text area
    const textX = portraitX + PORTRAIT_SIZE + TEXT_GAP;
    const textY = portraitY;
    // textWidth already calculated above for box height
    
    // Character name
    const characterColor = CHARACTER_COLORS[currentPage.character] || '#ffffff';
    const characterName = getCharacterName(currentPage.character);
    
    this.ctx.font = 'bold 14px monospace';
    this.ctx.fillStyle = characterColor;
    this.ctx.textBaseline = 'top';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    this.ctx.shadowBlur = 2;
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;
    this.ctx.fillText(characterName, textX, textY);
    
    // Dialog text with word wrap - show full text immediately
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 1;
    
    const lines = this.wrapText(currentPage.text, textWidth);
    let lineY = textY + 24;
    for (const line of lines) {
      this.ctx.fillText(line, textX, lineY);
      lineY += TEXT_LINE_HEIGHT;
    }
    
    // "Tap to continue" hint with blinking effect
    this.ctx.shadowBlur = 0;
    
    const hintText = 'TAP to continue';
    
    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = this.cursorVisible ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)';
    this.ctx.textBaseline = 'bottom';
    
    // Hint (bottom-right of box)
    const hintWidth = this.ctx.measureText(hintText).width;
    this.ctx.fillText(hintText, boxX + boxWidth - DIALOG_BOX_PADDING - hintWidth, boxY + finalBoxHeight - 4);
    
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
   * Word wrap text to fit within a given width
   */
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
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
    
    return lines;
  }
}

/**
 * Canvas-based Dialog System
 * Renders dialog boxes and typewriter text directly to Canvas instead of React DOM
 * 
 * Matches the original ConversationDialogActivity.java layout from Replica Island
 */

import type { Dialog, DialogPage, Conversation, Character } from '../data/dialogs';
import { getCharacterName } from '../data/dialogs';
import type { MenuCommand } from './CanvasMenuInput';
import { attachModalKeyboard, detachModalKeyboard, claimModalPointer, ModalPriority } from './ModalKeyboard';

// Character name colors
const CHARACTER_COLORS: Record<Character, string> = {
  Wanda: '#ff88cc',
  Kyle: '#88ccff',
  Kabocha: '#88ff88',
  Rokudou: '#ffcc88',
};

// Layout constants
const DIALOG_BOX_MARGIN = 12;
const DIALOG_BOX_PADDING = 10;
const PORTRAIT_SIZE = 64;
const TEXT_GAP = 10;
const TEXT_LINE_HEIGHT = 16;
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
  // A source page may need several screens. Track words, not wrapped lines,
  // so resizing between presses cannot skip unread text.
  private wordOffset: number = 0;
  
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
    this.wordOffset = 0;
    
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

  handleMenuCommand(command: MenuCommand): void {
    if (!this.isActive()) return;
    if (command === 'confirm') this.advance();
    else if (command === 'back' && this.onSkip) {
      const skip = this.onSkip;
      this.hide();
      skip();
    }
  }
  
  /**
   * Preload portrait images
   */
  private preloadPortraits(): void {
    if (!this.dialog) return;
    
    const portraitsToLoad = new Set<string>();
    for (const conversation of this.dialog.conversations) {
      for (const page of conversation.pages) {
        if (page.portrait) portraitsToLoad.add(page.portrait);
      }
    }
    
    for (const portraitPath of portraitsToLoad) {
      if (!this.portraits.has(portraitPath)) {
        const img = new Image();
        // portraitPath already has base URL from dialogs.ts getPortrait()
        img.src = portraitPath;
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
    // Modal dialogue gets first refusal, before the game's bubble listeners.
    attachModalKeyboard(this, ModalPriority.dialog, this.boundHandleKeyDown, this.canvas);
    this.canvas.addEventListener('click', this.boundHandleClick);
    this.canvas.addEventListener('touchstart', this.boundHandleClick);
  }
  
  /**
   * Detach event listeners
   */
  private detach(): void {
    detachModalKeyboard(this);
    this.canvas.removeEventListener('click', this.boundHandleClick);
    this.canvas.removeEventListener('touchstart', this.boundHandleClick);
  }
  
  /**
   * Handle keyboard input
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const advancing = e.key === 'Enter' || e.key === ' ' || e.key === 'x' || e.key === 'X';
    if (!advancing && e.key !== 'Escape') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (advancing) {
      this.advance();
    } else if (this.onSkip) {
      const skip = this.onSkip;
      this.hide();
      skip();
    }
  }
  
  /**
   * Handle click/tap
   */
  private handleClick(e: MouseEvent | TouchEvent): void {
    if (!claimModalPointer(this, e)) return;
    this.advance();
  }
  
  /**
   * Advance to next page or complete dialog
   */
  private advance(): void {
    if (!this.dialog) return;
    
    const currentConversation: Conversation | undefined = this.dialog.conversations[this.state.conversationIndex];
    
    if (!currentConversation) return;

    const page = currentConversation.pages[this.state.pageIndex];
    if (page) {
      const layout = this.layoutPage(page);
      if (layout.hasMore) {
        this.wordOffset += layout.visibleLines.join(' ').split(/\s+/).length;
        return;
      }
    }
    this.wordOffset = 0;
    
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

  private layoutPage(page: DialogPage): { boxHeight: number; visibleLines: string[]; hasMore: boolean } {
    const textWidth = this.width - DIALOG_BOX_MARGIN * 2 - DIALOG_BOX_PADDING * 2
      - (page.character ? PORTRAIT_SIZE + TEXT_GAP : 0);
    const oldFont = this.ctx.font;
    this.ctx.font = '11px monospace';
    const remaining = page.text.trim().split(/\s+/).slice(this.wordOffset).join(' ');
    const lines = this.wrapText(remaining, textWidth);
    this.ctx.font = oldFont;
    const overhead = DIALOG_BOX_PADDING * 2 + 24 + 16;
    const textHeight = Math.max(lines.length * TEXT_LINE_HEIGHT, PORTRAIT_SIZE - 24);
    const minBoxHeight = PORTRAIT_SIZE + DIALOG_BOX_PADDING * 2 + 20;
    const boxHeight = Math.min(Math.max(minBoxHeight, overhead + textHeight), this.height * 0.55);
    const capacity = Math.max(1, Math.floor((boxHeight - overhead) / TEXT_LINE_HEIGHT));
    // Balance continuation screens instead of leaving a lone final word.
    const screenCount = Math.max(1, Math.ceil(lines.length / capacity));
    const visibleCount = Math.ceil(lines.length / screenCount);
    return { boxHeight, visibleLines: lines.slice(0, visibleCount), hasMore: lines.length > visibleCount };
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
    // Narration pages carry no speaker or portrait - the original's XML omits
    // both - so the text runs the full width of the box.
    const isNarration = !currentPage.character;
    const layout = this.layoutPage(currentPage);
    const finalBoxHeight = layout.boxHeight;
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
    if (!isNarration) {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.strokeStyle = '#446688';
    this.ctx.lineWidth = 2;
    this.roundRect(portraitX, portraitY, PORTRAIT_SIZE, PORTRAIT_SIZE, 4);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Portrait image
    const portrait = currentPage.portrait
      ? this.portraits.get(currentPage.portrait)
      : undefined;
    if (portrait) {
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(portrait, portraitX + 4, portraitY + 4, PORTRAIT_SIZE - 8, PORTRAIT_SIZE - 8);
    }
    }
    
    // Text area
    const textX = isNarration ? portraitX : portraitX + PORTRAIT_SIZE + TEXT_GAP;
    const textY = portraitY;
    // textWidth already calculated above for box height
    
    // Character name, omitted on narration pages.
    if (currentPage.character) {
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
    }
    
    // Dialog text with word wrap - show full text immediately
    this.ctx.font = '11px monospace';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 1;
    
    let lineY = textY + 22;
    for (const line of layout.visibleLines) {
      this.ctx.fillText(line, textX, lineY);
      lineY += TEXT_LINE_HEIGHT;
    }
    
    // "Tap to continue" hint with blinking effect
    this.ctx.shadowBlur = 0;
    
    const hintText = layout.hasMore ? 'TAP for more' : 'TAP to continue';
    
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

/**
 * Canvas-based On-Screen Controls
 * Renders touch controls directly to Canvas instead of React DOM
 * 
 * Matches the original HudSystem.java control layout from Replica Island
 */

import { assetPath } from '../utils/helpers';

// Layout constants (from original HudSystem.java)
const MOVEMENT_SLIDER_BASE_X = 20;
const MOVEMENT_SLIDER_BASE_Y = 32;
const MOVEMENT_SLIDER_WIDTH = 128;
const MOVEMENT_SLIDER_HEIGHT = 32;
const SLIDER_BUTTON_WIDTH = 64;
const SLIDER_BUTTON_HEIGHT = 64;

const FLY_BUTTON_SIZE = 64;
const STOMP_BUTTON_SIZE = 48;
const BUTTON_RIGHT_MARGIN = 12;
const BUTTON_BOTTOM_MARGIN = 5;
const BUTTON_GAP = 5;

interface TouchState {
  isSliderActive: boolean;
  sliderPosition: number; // 0 to 1, 0.5 is center
  isFlyPressed: boolean;
  isStompPressed: boolean;
}

interface TouchZone {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'slider' | 'fly' | 'stomp';
}

export class CanvasControls {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  
  // Loaded sprites
  private sprites: Map<string, HTMLImageElement> = new Map();
  private spritesLoaded: boolean = false;
  
  // Touch state
  private touchState: TouchState = {
    isSliderActive: false,
    sliderPosition: 0.5,
    isFlyPressed: false,
    isStompPressed: false,
  };
  
  // Keyboard state (for visual sync)
  private keyboardLeft: boolean = false;
  private keyboardRight: boolean = false;
  private keyboardFly: boolean = false;
  private keyboardStomp: boolean = false;
  
  // Active touch tracking
  private activeTouches: Map<number, TouchZone['type']> = new Map();
  private sliderTouchId: number | null = null;
  
  // Callbacks
  private onMovementChange: ((direction: number) => void) | null = null;
  private onFlyPressed: (() => void) | null = null;
  private onFlyReleased: (() => void) | null = null;
  private onStompPressed: (() => void) | null = null;
  private onStompReleased: (() => void) | null = null;
  
  // Bound event handlers
  private boundHandleTouchStart: (e: TouchEvent) => void;
  private boundHandleTouchMove: (e: TouchEvent) => void;
  private boundHandleTouchEnd: (e: TouchEvent) => void;
  private boundHandleMouseDown: (e: MouseEvent) => void;
  private boundHandleMouseMove: (e: MouseEvent) => void;
  private boundHandleMouseUp: (e: MouseEvent) => void;
  
  constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, width: number, height: number) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    
    // Bind event handlers
    this.boundHandleTouchStart = this.handleTouchStart.bind(this);
    this.boundHandleTouchMove = this.handleTouchMove.bind(this);
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);
  }
  
  /**
   * Preload control sprites
   */
  async preload(): Promise<void> {
    const spriteNames = [
      'ui_movement_slider_base',
      'ui_movement_slider_button_on',
      'ui_movement_slider_button_off',
      'ui_button_fly_on',
      'ui_button_fly_off',
      'ui_button_stomp_on',
      'ui_button_stomp_off',
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
        console.warn(`Failed to load control sprite: ${name}`);
        resolve();
      };
      img.src = assetPath(`/assets/sprites/${name}.png`);
    });
  }
  
  /**
   * Set callbacks
   */
  setCallbacks(
    onMovementChange: (direction: number) => void,
    onFlyPressed: () => void,
    onFlyReleased: () => void,
    onStompPressed: () => void,
    onStompReleased: () => void
  ): void {
    this.onMovementChange = onMovementChange;
    this.onFlyPressed = onFlyPressed;
    this.onFlyReleased = onFlyReleased;
    this.onStompPressed = onStompPressed;
    this.onStompReleased = onStompReleased;
  }
  
  /**
   * Set keyboard state for visual sync
   */
  setKeyboardState(left: boolean, right: boolean, fly: boolean, stomp: boolean): void {
    this.keyboardLeft = left;
    this.keyboardRight = right;
    this.keyboardFly = fly;
    this.keyboardStomp = stomp;
  }
  
  /**
   * Set canvas dimensions
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
  
  /**
   * Attach event listeners
   */
  attach(): void {
    this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandleTouchEnd);
    this.canvas.addEventListener('touchcancel', this.boundHandleTouchEnd);
    this.canvas.addEventListener('mousedown', this.boundHandleMouseDown);
    window.addEventListener('mousemove', this.boundHandleMouseMove);
    window.addEventListener('mouseup', this.boundHandleMouseUp);
  }
  
  /**
   * Detach event listeners
   */
  detach(): void {
    this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart);
    this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove);
    this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.boundHandleTouchEnd);
    this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown);
    window.removeEventListener('mousemove', this.boundHandleMouseMove);
    window.removeEventListener('mouseup', this.boundHandleMouseUp);
  }
  
  /**
   * Get touch zones
   */
  private getTouchZones(): TouchZone[] {
    return [
      // Slider zone (entire slider area)
      {
        x: MOVEMENT_SLIDER_BASE_X,
        y: this.height - MOVEMENT_SLIDER_BASE_Y - SLIDER_BUTTON_HEIGHT,
        width: MOVEMENT_SLIDER_WIDTH,
        height: SLIDER_BUTTON_HEIGHT + 20,
        type: 'slider',
      },
      // Fly button
      {
        x: this.width - BUTTON_RIGHT_MARGIN - FLY_BUTTON_SIZE,
        y: this.height - BUTTON_BOTTOM_MARGIN - FLY_BUTTON_SIZE,
        width: FLY_BUTTON_SIZE,
        height: FLY_BUTTON_SIZE,
        type: 'fly',
      },
      // Stomp button (above fly)
      {
        x: this.width - BUTTON_RIGHT_MARGIN - STOMP_BUTTON_SIZE - (FLY_BUTTON_SIZE - STOMP_BUTTON_SIZE) / 2,
        y: this.height - BUTTON_BOTTOM_MARGIN - FLY_BUTTON_SIZE - BUTTON_GAP - STOMP_BUTTON_SIZE,
        width: STOMP_BUTTON_SIZE,
        height: STOMP_BUTTON_SIZE,
        type: 'stomp',
      },
    ];
  }
  
  /**
   * Check which zone a point is in
   */
  private getZoneAtPoint(x: number, y: number): TouchZone | null {
    const zones = this.getTouchZones();
    for (const zone of zones) {
      if (x >= zone.x && x <= zone.x + zone.width &&
          y >= zone.y && y <= zone.y + zone.height) {
        return zone;
      }
    }
    return null;
  }
  
  /**
   * Convert canvas coordinates to world coordinates
   */
  private canvasToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }
  
  /**
   * Update slider position from x coordinate
   */
  private updateSliderFromX(worldX: number): void {
    const sliderLeft = MOVEMENT_SLIDER_BASE_X;
    const position = Math.max(0, Math.min(1, (worldX - sliderLeft) / MOVEMENT_SLIDER_WIDTH));
    this.touchState.sliderPosition = position;
    
    const direction = (position - 0.5) * 2; // -1 to 1
    this.onMovementChange?.(direction);
  }
  
  // Touch handlers
  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pos = this.canvasToWorld(touch.clientX, touch.clientY);
      const zone = this.getZoneAtPoint(pos.x, pos.y);
      
      if (zone) {
        this.activeTouches.set(touch.identifier, zone.type);
        
        switch (zone.type) {
          case 'slider':
            this.sliderTouchId = touch.identifier;
            this.touchState.isSliderActive = true;
            this.updateSliderFromX(pos.x);
            break;
          case 'fly':
            this.touchState.isFlyPressed = true;
            this.onFlyPressed?.();
            break;
          case 'stomp':
            this.touchState.isStompPressed = true;
            this.onStompPressed?.();
            break;
        }
      }
    }
  }
  
  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      
      if (touch.identifier === this.sliderTouchId) {
        const pos = this.canvasToWorld(touch.clientX, touch.clientY);
        this.updateSliderFromX(pos.x);
      }
    }
  }
  
  private handleTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const zoneType = this.activeTouches.get(touch.identifier);
      
      if (zoneType) {
        this.activeTouches.delete(touch.identifier);
        
        switch (zoneType) {
          case 'slider':
            if (touch.identifier === this.sliderTouchId) {
              this.sliderTouchId = null;
              this.touchState.isSliderActive = false;
              this.touchState.sliderPosition = 0.5;
              this.onMovementChange?.(0);
            }
            break;
          case 'fly':
            this.touchState.isFlyPressed = false;
            this.onFlyReleased?.();
            break;
          case 'stomp':
            this.touchState.isStompPressed = false;
            this.onStompReleased?.();
            break;
        }
      }
    }
  }
  
  // Mouse handlers (for desktop testing)
  private mouseZone: TouchZone['type'] | null = null;
  
  private handleMouseDown(e: MouseEvent): void {
    const pos = this.canvasToWorld(e.clientX, e.clientY);
    const zone = this.getZoneAtPoint(pos.x, pos.y);
    
    if (zone) {
      this.mouseZone = zone.type;
      
      switch (zone.type) {
        case 'slider':
          this.touchState.isSliderActive = true;
          this.updateSliderFromX(pos.x);
          break;
        case 'fly':
          this.touchState.isFlyPressed = true;
          this.onFlyPressed?.();
          break;
        case 'stomp':
          this.touchState.isStompPressed = true;
          this.onStompPressed?.();
          break;
      }
    }
  }
  
  private handleMouseMove(e: MouseEvent): void {
    if (this.mouseZone === 'slider' && this.touchState.isSliderActive) {
      const pos = this.canvasToWorld(e.clientX, e.clientY);
      this.updateSliderFromX(pos.x);
    }
  }
  
  private handleMouseUp(): void {
    if (this.mouseZone) {
      switch (this.mouseZone) {
        case 'slider':
          this.touchState.isSliderActive = false;
          this.touchState.sliderPosition = 0.5;
          this.onMovementChange?.(0);
          break;
        case 'fly':
          this.touchState.isFlyPressed = false;
          this.onFlyReleased?.();
          break;
        case 'stomp':
          this.touchState.isStompPressed = false;
          this.onStompReleased?.();
          break;
      }
      this.mouseZone = null;
    }
  }
  
  /**
   * Render controls to canvas
   */
  render(): void {
    if (!this.spritesLoaded) return;
    
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false;
    
    // Draw movement slider
    this.drawSlider();
    
    // Draw action buttons
    this.drawButtons();
    
    this.ctx.restore();
  }
  
  private drawSlider(): void {
    const baseSprite = this.sprites.get('ui_movement_slider_base');
    const isActive = this.touchState.isSliderActive || this.keyboardLeft || this.keyboardRight;
    const buttonSprite = this.sprites.get(isActive ? 'ui_movement_slider_button_on' : 'ui_movement_slider_button_off');
    
    if (!baseSprite || !buttonSprite) return;
    
    const baseX = MOVEMENT_SLIDER_BASE_X;
    const baseY = this.height - MOVEMENT_SLIDER_BASE_Y - MOVEMENT_SLIDER_HEIGHT;
    
    // Draw base
    this.ctx.drawImage(baseSprite, baseX, baseY, MOVEMENT_SLIDER_WIDTH, MOVEMENT_SLIDER_HEIGHT);
    
    // Calculate button position
    let position = this.touchState.sliderPosition;
    if (!this.touchState.isSliderActive) {
      if (this.keyboardLeft) position = 0.1;
      else if (this.keyboardRight) position = 0.9;
      else position = 0.5;
    }
    
    const buttonX = baseX + position * (MOVEMENT_SLIDER_WIDTH - SLIDER_BUTTON_WIDTH);
    const buttonY = baseY - (SLIDER_BUTTON_HEIGHT - MOVEMENT_SLIDER_HEIGHT) / 2 - 8;
    
    // Draw button
    this.ctx.drawImage(buttonSprite, buttonX, buttonY, SLIDER_BUTTON_WIDTH, SLIDER_BUTTON_HEIGHT);
  }
  
  private drawButtons(): void {
    const flyPressed = this.touchState.isFlyPressed || this.keyboardFly;
    const stompPressed = this.touchState.isStompPressed || this.keyboardStomp;
    
    const flySprite = this.sprites.get(flyPressed ? 'ui_button_fly_on' : 'ui_button_fly_off');
    const stompSprite = this.sprites.get(stompPressed ? 'ui_button_stomp_on' : 'ui_button_stomp_off');
    
    // Fly button (bottom-right)
    if (flySprite) {
      const x = this.width - BUTTON_RIGHT_MARGIN - FLY_BUTTON_SIZE;
      const y = this.height - BUTTON_BOTTOM_MARGIN - FLY_BUTTON_SIZE;
      this.ctx.globalAlpha = flyPressed ? 1 : 0.8;
      this.ctx.drawImage(flySprite, x, y, FLY_BUTTON_SIZE, FLY_BUTTON_SIZE);
    }
    
    // Stomp button (above fly)
    if (stompSprite) {
      const x = this.width - BUTTON_RIGHT_MARGIN - STOMP_BUTTON_SIZE - (FLY_BUTTON_SIZE - STOMP_BUTTON_SIZE) / 2;
      const y = this.height - BUTTON_BOTTOM_MARGIN - FLY_BUTTON_SIZE - BUTTON_GAP - STOMP_BUTTON_SIZE;
      this.ctx.globalAlpha = stompPressed ? 1 : 0.8;
      this.ctx.drawImage(stompSprite, x, y, STOMP_BUTTON_SIZE, STOMP_BUTTON_SIZE);
    }
    
    this.ctx.globalAlpha = 1;
  }
}

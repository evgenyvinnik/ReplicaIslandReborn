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
  private interactionAllowed: () => boolean = () => true;
  private boundRelease: () => void;
  private orbControlMode = false;
  private orbVertical = 0;
  
  // Callbacks
  private onMovementChange: ((direction: number, vertical: number) => void) | null = null;
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
    this.boundRelease = this.releaseAll.bind(this);
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
        // console.log(`Failed to load control sprite: ${name}`);
        resolve();
      };
      img.src = assetPath(`/assets/sprites/${name}.png`);
    });
  }
  
  /**
   * Set callbacks
   */
  setCallbacks(
    onMovementChange: (direction: number, vertical: number) => void,
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

  setInteractionAllowed(check: () => boolean): void {
    this.interactionAllowed = check;
  }

  /** The original orb uses two-axis tilt; the web touch equivalent is a visible pad. */
  setOrbControlMode(enabled: boolean): void {
    if (this.orbControlMode === enabled) return;
    this.orbControlMode = enabled;
    // Do not carry a held movement direction across a control handoff.
    for (const [id, zone] of this.activeTouches) {
      if (zone === 'slider') this.activeTouches.delete(id);
    }
    this.sliderTouchId = null;
    if (this.mouseZone === 'slider') this.mouseZone = null;
    this.releaseMovement();
  }

  private releaseMovement(): void {
    this.touchState.isSliderActive = false;
    this.touchState.sliderPosition = 0.5;
    this.orbVertical = 0;
    this.onMovementChange?.(0, 0);
  }

  /** Cancel held controls when gameplay is suspended, focus is lost, or listeners detach. */
  releaseAll(): void {
    this.activeTouches.clear();
    this.sliderTouchId = null;
    this.mouseZone = null;
    if (this.touchState.isSliderActive) this.releaseMovement();
    if (this.touchState.isFlyPressed) this.onFlyReleased?.();
    if (this.touchState.isStompPressed) this.onStompReleased?.();
    this.touchState = { isSliderActive: false, sliderPosition: 0.5, isFlyPressed: false, isStompPressed: false };
  }

  private canInteract(): boolean {
    if (this.interactionAllowed()) return true;
    this.releaseAll();
    return false;
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
    window.addEventListener('blur', this.boundRelease);
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
    window.removeEventListener('blur', this.boundRelease);
    this.releaseAll();
  }
  
  /**
   * Get touch zones
   */
  private getTouchZones(): TouchZone[] {
    return [
      // Slider zone (entire slider area)
      {
        x: MOVEMENT_SLIDER_BASE_X,
        y: this.orbControlMode ? this.height - 132 : this.height - MOVEMENT_SLIDER_BASE_Y - SLIDER_BUTTON_HEIGHT,
        width: MOVEMENT_SLIDER_WIDTH,
        height: this.orbControlMode ? 128 : SLIDER_BUTTON_HEIGHT + 20,
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
  private updateSlider(worldX: number, worldY: number): void {
    const sliderLeft = MOVEMENT_SLIDER_BASE_X;
    const position = Math.max(0, Math.min(1, (worldX - sliderLeft) / MOVEMENT_SLIDER_WIDTH));
    this.touchState.sliderPosition = position;
    
    const direction = (position - 0.5) * 2; // -1 to 1
    this.orbVertical = this.orbControlMode ? Math.max(-1, Math.min(1, (worldY - (this.height - 68)) / 64)) : 0;
    this.onMovementChange?.(direction, this.orbVertical);
  }
  
  // Touch handlers
  private handleTouchStart(e: TouchEvent): void {
    if (!this.canInteract()) return;
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pos = this.canvasToWorld(touch.clientX, touch.clientY);
      const zone = this.getZoneAtPoint(pos.x, pos.y);
      
      if (zone) {
        // A second finger must not steal the slider from its current owner.
        if (zone.type === 'slider' && (this.sliderTouchId !== null || this.mouseZone === 'slider')) continue;
        this.activeTouches.set(touch.identifier, zone.type);
        
        switch (zone.type) {
          case 'slider':
            this.sliderTouchId = touch.identifier;
            this.touchState.isSliderActive = true;
            this.updateSlider(pos.x, pos.y);
            break;
          case 'fly':
            if (this.touchState.isFlyPressed) break;
            this.touchState.isFlyPressed = true;
            this.onFlyPressed?.();
            break;
          case 'stomp':
            if (this.touchState.isStompPressed) break;
            this.touchState.isStompPressed = true;
            this.onStompPressed?.();
            break;
        }
      }
    }
  }
  
  private handleTouchMove(e: TouchEvent): void {
    if (!this.canInteract()) return;
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      
      if (touch.identifier === this.sliderTouchId) {
        const pos = this.canvasToWorld(touch.clientX, touch.clientY);
        this.updateSlider(pos.x, pos.y);
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
              this.releaseMovement();
            }
            break;
          case 'fly':
            if (this.mouseZone === 'fly' || [...this.activeTouches.values()].includes('fly')) break;
            this.touchState.isFlyPressed = false;
            this.onFlyReleased?.();
            break;
          case 'stomp':
            if (this.mouseZone === 'stomp' || [...this.activeTouches.values()].includes('stomp')) break;
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
    if (e.button !== 0 || !this.canInteract() || this.mouseZone) return;
    const pos = this.canvasToWorld(e.clientX, e.clientY);
    const zone = this.getZoneAtPoint(pos.x, pos.y);
    
    if (zone) {
      if (zone.type === 'slider' && this.sliderTouchId !== null) return;
      this.mouseZone = zone.type;
      
      switch (zone.type) {
        case 'slider':
          this.touchState.isSliderActive = true;
          this.updateSlider(pos.x, pos.y);
          break;
        case 'fly':
          if (this.touchState.isFlyPressed) break;
          this.touchState.isFlyPressed = true;
          this.onFlyPressed?.();
          break;
        case 'stomp':
          if (this.touchState.isStompPressed) break;
          this.touchState.isStompPressed = true;
          this.onStompPressed?.();
          break;
      }
    }
  }
  
  private handleMouseMove(e: MouseEvent): void {
    if (!this.canInteract()) return;
    if (this.mouseZone === 'slider' && this.touchState.isSliderActive) {
      const pos = this.canvasToWorld(e.clientX, e.clientY);
      this.updateSlider(pos.x, pos.y);
    }
  }
  
  private handleMouseUp(): void {
    if (this.mouseZone) {
      switch (this.mouseZone) {
        case 'slider':
          this.releaseMovement();
          break;
        case 'fly':
          if ([...this.activeTouches.values()].includes('fly')) break;
          this.touchState.isFlyPressed = false;
          this.onFlyReleased?.();
          break;
        case 'stomp':
          if ([...this.activeTouches.values()].includes('stomp')) break;
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

    if (this.orbControlMode) {
      const centerX = MOVEMENT_SLIDER_BASE_X + MOVEMENT_SLIDER_WIDTH / 2;
      const centerY = this.height - 68;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, 62, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - 48, centerY);
      this.ctx.lineTo(centerX + 48, centerY);
      this.ctx.moveTo(centerX, centerY - 48);
      this.ctx.lineTo(centerX, centerY + 48);
      this.ctx.stroke();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('ORB · DRAG TO STEER', centerX, centerY - 70);
      const x = (this.touchState.sliderPosition - 0.5) * 2;
      this.ctx.drawImage(buttonSprite, centerX + x * 32 - 32, centerY + this.orbVertical * 32 - 32, 64, 64);
      return;
    }
    
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

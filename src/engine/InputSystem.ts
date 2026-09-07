/**
 * Input System - Handles keyboard, touch, and gamepad input
 * Ported from: Original/src/com/replica/replicaisland/InputSystem.java
 */

import type { InputState } from '../types';

export interface InputConfig {
  /** Disable legacy window-wide gestures when canvas controls own touch input. */
  touchGestures: boolean;
  keyBindings: {
    left: string[];
    right: string[];
    up: string[];
    down: string[];
    jump: string[];
    attack: string[];
    pause: string[];
  };
}

const DEFAULT_KEY_BINDINGS: InputConfig['keyBindings'] = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ', 'KeyK'],
  attack: ['KeyX', 'KeyJ', 'ControlLeft'],
  pause: ['Escape', 'KeyP'],
};

const GAMEPAD_BINDINGS = {
  left: 'GamepadLeft', right: 'GamepadRight', up: 'GamepadUp', down: 'GamepadDown',
  jump: 'GamepadA', attack: 'GamepadB', pause: 'GamepadStart',
} as const;

export class InputSystem {
  private keys: Set<string> = new Set();
  private keysPressedThisFrame: Set<string> = new Set();
  private keysReleasedThisFrame: Set<string> = new Set();
  private pendingKeyPresses: Set<string> = new Set();
  private pendingKeyReleases: Set<string> = new Set();
  private keyBindings: InputConfig['keyBindings'];

  // Touch state
  private touchActive: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchCurrentX: number = 0;
  private touchCurrentY: number = 0;
  private touchJump: boolean = false;

  // Virtual joystick state for mobile
  private virtualJoystickX: number = 0;
  private virtualJoystickY: number = 0;

  // Gamepad state
  private gamepadIndex: number = -1;
  private gamepadHorizontal = 0;
  private readonly touchGestures: boolean;

  // Listeners bound for cleanup
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundGamepadConnected: (e: GamepadEvent) => void;
  private boundGamepadDisconnected: (e: GamepadEvent) => void;
  private boundBlur: () => void;

  constructor(config?: Partial<InputConfig>) {
    this.touchGestures = config?.touchGestures ?? true;
    this.keyBindings = { ...DEFAULT_KEY_BINDINGS, ...config?.keyBindings };

    // Bind event handlers
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
    this.boundGamepadConnected = this.handleGamepadConnected.bind(this);
    this.boundGamepadDisconnected = this.handleGamepadDisconnected.bind(this);
    this.boundBlur = this.releaseAllKeys.bind(this);
  }

  /**
   * Initialize input listeners
   */
  initialize(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    if (this.touchGestures) {
      window.addEventListener('touchstart', this.boundTouchStart, { passive: false });
      window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
      window.addEventListener('touchend', this.boundTouchEnd);
      window.addEventListener('touchcancel', this.boundTouchEnd);
    }
    window.addEventListener('gamepadconnected', this.boundGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.boundGamepadDisconnected);
    window.addEventListener('blur', this.boundBlur);
  }

  /**
   * Cleanup input listeners
   */
  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
    window.removeEventListener('touchcancel', this.boundTouchEnd);
    window.removeEventListener('gamepadconnected', this.boundGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.boundGamepadDisconnected);
    window.removeEventListener('blur', this.boundBlur);
  }

  /**
   * Update input state (call at start of each frame)
   */
  update(): void {
    // Browser events arrive between simulation steps. Publish them for one
    // step before clearing, including taps pressed and released between ticks.
    const previousPresses = this.keysPressedThisFrame;
    const previousReleases = this.keysReleasedThisFrame;
    this.keysPressedThisFrame = this.pendingKeyPresses;
    this.keysReleasedThisFrame = this.pendingKeyReleases;
    this.pendingKeyPresses = previousPresses;
    this.pendingKeyReleases = previousReleases;
    this.pendingKeyPresses.clear();
    this.pendingKeyReleases.clear();

    // Update gamepad state
    this.updateGamepad();
  }

  /**
   * Get the current input state
   */
  getInputState(): InputState {
    const state: InputState = {
      left: this.isActionActive('left'),
      right: this.isActionActive('right'),
      up: this.isActionActive('up'),
      down: this.isActionActive('down'),
      jump: this.isActionActive('jump') || this.touchJump,
      attack: this.isActionActive('attack'),
      pause: this.isActionPressed('pause'),
      horizontal: 0,
    };

    // Apply virtual joystick (always check, not just when touchActive)
    // This allows the on-screen slider to work
    if (this.virtualJoystickX < -0.3) state.left = true;
    if (this.virtualJoystickX > 0.3) state.right = true;
    if (this.virtualJoystickY < -0.3) state.up = true;
    if (this.virtualJoystickY > 0.3) state.down = true;

    // The analogue value the original's d-pad reports. The on-screen slider
    // produces a proportion, and the original scales the movement impulse by
    // it rather than treating anything past a threshold as a full push. Keys
    // report a whole -1 or 1, as a d-pad does.
    if (Math.abs(this.virtualJoystickX) > 0.001) {
      state.horizontal = Math.max(-1, Math.min(1, this.virtualJoystickX));
    } else if (this.gamepadHorizontal !== 0 &&
      ![...this.keyBindings.left, ...this.keyBindings.right].some(key => this.keys.has(key))) {
      state.horizontal = this.gamepadHorizontal;
    } else {
      state.horizontal = (state.right ? 1 : 0) - (state.left ? 1 : 0);
    }

    return state;
  }

  /**
   * Check if an action is currently active (held)
   */
  isActionActive(action: keyof typeof DEFAULT_KEY_BINDINGS): boolean {
    const keys = this.keyBindings[action];
    const keyActive = keys.some((key) => this.keys.has(key));
    
    // Also check virtual attack button
    if (action === 'attack' && this.keys.has('VirtualAttack')) {
      return true;
    }
    if (action === 'jump' && this.keys.has('VirtualJump')) return true;
    
    return keyActive || this.keys.has(GAMEPAD_BINDINGS[action]);
  }

  /**
   * Check if an action was just pressed this frame
   */
  isActionPressed(action: keyof typeof DEFAULT_KEY_BINDINGS): boolean {
    const keys = this.keyBindings[action];
    return keys.some((key) => this.keysPressedThisFrame.has(key)) ||
      this.keysPressedThisFrame.has(GAMEPAD_BINDINGS[action]) ||
      (action === 'jump' && this.keysPressedThisFrame.has('VirtualJump')) ||
      (action === 'attack' && this.keysPressedThisFrame.has('VirtualAttack'));
  }

  /**
   * Check if an action was just released this frame
   */
  isActionReleased(action: keyof typeof DEFAULT_KEY_BINDINGS): boolean {
    const keys = this.keyBindings[action];
    return keys.some((key) => this.keysReleasedThisFrame.has(key)) ||
      this.keysReleasedThisFrame.has(GAMEPAD_BINDINGS[action]) ||
      (action === 'jump' && this.keysReleasedThisFrame.has('VirtualJump')) ||
      (action === 'attack' && this.keysReleasedThisFrame.has('VirtualAttack'));
  }

  isGamepadPausePressed(): boolean {
    return this.keysPressedThisFrame.has(GAMEPAD_BINDINGS.pause);
  }

  /**
   * Release all keys (called on window blur, pause, etc.)
   */
  releaseAllKeys(): void {
    this.keys.clear();
    this.keysPressedThisFrame.clear();
    this.keysReleasedThisFrame.clear();
    this.pendingKeyPresses.clear();
    this.pendingKeyReleases.clear();
    this.touchActive = false;
    this.touchJump = false;
    this.virtualJoystickX = 0;
    this.virtualJoystickY = 0;
    this.gamepadHorizontal = 0;
  }

  /**
   * Get touch/joystick position for UI rendering
   */
  getTouchState(): {
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    joystickX: number;
    joystickY: number;
  } {
    return {
      active: this.touchActive,
      startX: this.touchStartX,
      startY: this.touchStartY,
      currentX: this.touchCurrentX,
      currentY: this.touchCurrentY,
      joystickX: this.virtualJoystickX,
      joystickY: this.virtualJoystickY,
    };
  }

  /**
   * Set virtual joystick position (for on-screen controls)
   */
  setVirtualJoystick(x: number, y: number): void {
    this.virtualJoystickX = Math.max(-1, Math.min(1, x));
    this.virtualJoystickY = Math.max(-1, Math.min(1, y));
  }

  /**
   * Set virtual axis value (for on-screen slider controls)
   * Maps to the virtual joystick internally
   */
  setVirtualAxis(axis: 'horizontal' | 'vertical', value: number): void {
    if (axis === 'horizontal') {
      this.virtualJoystickX = Math.max(-1, Math.min(1, value));
    } else {
      this.virtualJoystickY = Math.max(-1, Math.min(1, value));
    }
  }

  /**
   * Set virtual button state (for on-screen buttons)
   * Supports both original names and Replica Island specific names
   */
  setVirtualButton(button: 'jump' | 'attack' | 'fly' | 'stomp', pressed: boolean): void {
    // 'fly' maps to jump, 'stomp' maps to attack
    this.queueKey(button === 'jump' || button === 'fly' ? 'VirtualJump' : 'VirtualAttack', pressed);
  }

  private queueKey(key: string, pressed: boolean): void {
    if (pressed && !this.keys.has(key)) {
      this.keys.add(key);
      this.pendingKeyPresses.add(key);
    } else if (!pressed && this.keys.delete(key)) {
      this.pendingKeyReleases.add(key);
    }
  }

  // Private event handlers

  private handleKeyDown(e: KeyboardEvent): void {
    // Prevent default for game keys
    if (this.isGameKey(e.code)) {
      e.preventDefault();
    }

    this.queueKey(e.code, true);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.queueKey(e.code, false);
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      this.touchActive = true;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchCurrentX = touch.clientX;
      this.touchCurrentY = touch.clientY;

      // Check if touch is on right side of screen (jump button area)
      const screenWidth = window.innerWidth;
      if (touch.clientX > screenWidth * 0.7) {
        this.touchJump = true;
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch && this.touchActive) {
      this.touchCurrentX = touch.clientX;
      this.touchCurrentY = touch.clientY;

      // Calculate virtual joystick from touch delta
      const deltaX = this.touchCurrentX - this.touchStartX;
      const deltaY = this.touchCurrentY - this.touchStartY;
      const maxDelta = 50; // pixels

      this.virtualJoystickX = Math.max(-1, Math.min(1, deltaX / maxDelta));
      this.virtualJoystickY = Math.max(-1, Math.min(1, deltaY / maxDelta));
    }
  }

  private handleTouchEnd(_e: TouchEvent): void {
    this.touchActive = false;
    this.touchJump = false;
    this.virtualJoystickX = 0;
    this.virtualJoystickY = 0;
  }

  private handleGamepadConnected(e: GamepadEvent): void {
    this.gamepadIndex = e.gamepad.index;
  }

  private handleGamepadDisconnected(e: GamepadEvent): void {
    if (this.gamepadIndex === e.gamepad.index) {
      this.gamepadIndex = -1;
      this.clearGamepad();
    }
  }

  private updateGamepad(): void {
    let gamepads: (globalThis.Gamepad | null)[] = [];
    try {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) gamepads = navigator.getGamepads();
    } catch {
      // Browsers can deny controller access; keyboard and touch must keep working.
    }
    const selected = gamepads[this.gamepadIndex];
    const gamepad = selected?.connected ? selected : gamepads.find(pad => pad?.connected);
    if (!gamepad) {
      this.gamepadIndex = -1;
      this.clearGamepad();
      return;
    }
    // Polling also discovers a controller connected before this game mounted.
    this.gamepadIndex = gamepad.index;
    const axis = (value: number | undefined): number =>
      value !== undefined && Number.isFinite(value) && Math.abs(value) > 0.2 ? Math.max(-1, Math.min(1, value)) : 0;
    const pressed = (index: number): boolean => gamepad.buttons[index]?.pressed ?? false;
    const dpadX = Number(pressed(15)) - Number(pressed(14));
    const dpadY = Number(pressed(13)) - Number(pressed(12));
    const x = pressed(14) || pressed(15) ? dpadX : axis(gamepad.axes[0]);
    const y = pressed(12) || pressed(13) ? dpadY : axis(gamepad.axes[1]);
    this.gamepadHorizontal = x;
    this.setGamepadKey('left', x < 0);
    this.setGamepadKey('right', x > 0);
    this.setGamepadKey('up', y < 0);
    this.setGamepadKey('down', y > 0);
    this.setGamepadKey('jump', pressed(0));
    this.setGamepadKey('attack', pressed(1) || pressed(2));
    this.setGamepadKey('pause', pressed(9));
  }

  private setGamepadKey(action: keyof typeof GAMEPAD_BINDINGS, held: boolean): void {
    const key = GAMEPAD_BINDINGS[action];
    if (held && !this.keys.has(key)) {
      this.keys.add(key);
      this.keysPressedThisFrame.add(key);
    } else if (!held && this.keys.delete(key)) {
      this.keysReleasedThisFrame.add(key);
    }
  }

  private clearGamepad(): void {
    this.gamepadHorizontal = 0;
    for (const action of Object.keys(GAMEPAD_BINDINGS) as (keyof typeof GAMEPAD_BINDINGS)[]) {
      this.setGamepadKey(action, false);
    }
  }

  private isGameKey(code: string): boolean {
    for (const keys of Object.values(this.keyBindings)) {
      if (keys.includes(code)) return true;
    }
    return false;
  }

  /**
   * Update key bindings
   */
  setKeyBindings(bindings: Partial<InputConfig['keyBindings']>): void {
    this.keyBindings = { ...this.keyBindings, ...bindings };
  }

  /**
   * Get whether the jump/fly action is active (for UI animation)
   * This includes keyboard, gamepad, and virtual button state
   */
  isJumpActive(): boolean {
    return this.isActionActive('jump') || this.touchJump;
  }

  /**
   * Get whether the attack/stomp action is active (for UI animation)
   * This includes keyboard, gamepad, and virtual button state
   */
  isAttackActive(): boolean {
    return this.isActionActive('attack') || this.keys.has('VirtualAttack');
  }

  /**
   * Get the current virtual joystick X position (-1 to 1)
   * Used by on-screen controls to show movement state
   */
  getVirtualJoystickX(): number {
    return this.virtualJoystickX;
  }

  /**
   * Get whether any left movement input is active (keyboard/gamepad)
   * Used by on-screen controls to sync visual state
   */
  isMovingLeft(): boolean {
    return this.isActionActive('left');
  }

  /**
   * Get whether any right movement input is active (keyboard/gamepad)
   * Used by on-screen controls to sync visual state
   */
  isMovingRight(): boolean {
    return this.isActionActive('right');
  }
}

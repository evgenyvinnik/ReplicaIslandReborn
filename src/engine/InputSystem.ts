/**
 * Input System - Handles keyboard, touch, and gamepad input
 * Ported from: Original/src/com/replica/replicaisland/InputSystem.java
 */

import type { InputState } from '../types';

export interface InputConfig {
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

export class InputSystem {
  private keys: Set<string> = new Set();
  private keysPressedThisFrame: Set<string> = new Set();
  private keysReleasedThisFrame: Set<string> = new Set();
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
    window.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd);
    window.addEventListener('touchcancel', this.boundTouchEnd);
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
    // Clear per-frame state
    this.keysPressedThisFrame.clear();
    this.keysReleasedThisFrame.clear();

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
    };

    // Apply virtual joystick
    if (this.touchActive) {
      if (this.virtualJoystickX < -0.3) state.left = true;
      if (this.virtualJoystickX > 0.3) state.right = true;
      if (this.virtualJoystickY < -0.3) state.up = true;
      if (this.virtualJoystickY > 0.3) state.down = true;
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
    
    return keyActive;
  }

  /**
   * Check if an action was just pressed this frame
   */
  isActionPressed(action: keyof typeof DEFAULT_KEY_BINDINGS): boolean {
    const keys = this.keyBindings[action];
    return keys.some((key) => this.keysPressedThisFrame.has(key));
  }

  /**
   * Check if an action was just released this frame
   */
  isActionReleased(action: keyof typeof DEFAULT_KEY_BINDINGS): boolean {
    const keys = this.keyBindings[action];
    return keys.some((key) => this.keysReleasedThisFrame.has(key));
  }

  /**
   * Release all keys (called on window blur, pause, etc.)
   */
  releaseAllKeys(): void {
    this.keys.clear();
    this.keysPressedThisFrame.clear();
    this.keysReleasedThisFrame.clear();
    this.touchActive = false;
    this.touchJump = false;
    this.virtualJoystickX = 0;
    this.virtualJoystickY = 0;
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
    if (button === 'jump' || button === 'fly') {
      this.touchJump = pressed;
    }
    // For stomp/attack, we simulate key press
    if (button === 'attack' || button === 'stomp') {
      if (pressed) {
        if (!this.keys.has('VirtualAttack')) {
          this.keys.add('VirtualAttack');
          this.keysPressedThisFrame.add('VirtualAttack');
        }
      } else {
        if (this.keys.has('VirtualAttack')) {
          this.keys.delete('VirtualAttack');
          this.keysReleasedThisFrame.add('VirtualAttack');
        }
      }
    }
  }

  // Private event handlers

  private handleKeyDown(e: KeyboardEvent): void {
    // Prevent default for game keys
    if (this.isGameKey(e.code)) {
      e.preventDefault();
    }

    if (!this.keys.has(e.code)) {
      this.keys.add(e.code);
      this.keysPressedThisFrame.add(e.code);
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (this.keys.has(e.code)) {
      this.keys.delete(e.code);
      this.keysReleasedThisFrame.add(e.code);
    }
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
    }
  }

  private updateGamepad(): void {
    if (this.gamepadIndex < 0) return;

    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[this.gamepadIndex];
    if (!gamepad) return;

    // D-pad or left stick for movement
    const deadzone = 0.2;

    // Left stick
    if (Math.abs(gamepad.axes[0]) > deadzone) {
      if (gamepad.axes[0] < 0) {
        this.keys.add('GamepadLeft');
      } else {
        this.keys.add('GamepadRight');
      }
    } else {
      this.keys.delete('GamepadLeft');
      this.keys.delete('GamepadRight');
    }

    if (Math.abs(gamepad.axes[1]) > deadzone) {
      if (gamepad.axes[1] < 0) {
        this.keys.add('GamepadUp');
      } else {
        this.keys.add('GamepadDown');
      }
    } else {
      this.keys.delete('GamepadUp');
      this.keys.delete('GamepadDown');
    }

    // A button for jump (usually index 0)
    if (gamepad.buttons[0]?.pressed) {
      this.keys.add('GamepadA');
    } else {
      this.keys.delete('GamepadA');
    }

    // B/X button for attack (usually index 1 or 2)
    if (gamepad.buttons[1]?.pressed || gamepad.buttons[2]?.pressed) {
      this.keys.add('GamepadB');
    } else {
      this.keys.delete('GamepadB');
    }

    // Start button for pause (usually index 9)
    if (gamepad.buttons[9]?.pressed) {
      this.keys.add('GamepadStart');
    } else {
      this.keys.delete('GamepadStart');
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
}

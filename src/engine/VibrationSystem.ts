/**
 * Vibration System - Haptic feedback for supported devices
 * Ported from: Original/src/com/replica/replicaisland/VibrationSystem.java
 * 
 * Uses the Web Vibration API for mobile browsers and Gamepad haptic API
 * for controllers that support it.
 * 
 * Note: Vibration is not supported on all browsers/devices:
 * - Mobile Chrome/Firefox: Supported
 * - iOS Safari: NOT supported (Apple restriction)
 * - Desktop browsers: Usually not supported
 */

export interface VibrationPattern {
  /** Duration in milliseconds */
  duration: number;
  /** Pause after vibration (for patterns) */
  pause?: number;
}

export class VibrationSystem {
  /** Whether vibration is enabled by user */
  private enabled: boolean = true;
  
  /** Whether the browser supports vibration */
  private supported: boolean = false;

  constructor() {
    this.checkSupport();
  }

  /**
   * Check if vibration is supported
   */
  private checkSupport(): void {
    // Check for standard Vibration API
    this.supported = 'vibrate' in navigator;
  }

  /**
   * Reset the system
   */
  reset(): void {
    this.stopVibration();
  }

  /**
   * Enable or disable vibration
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopVibration();
    }
  }

  /**
   * Check if vibration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if vibration is supported
   */
  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Vibrate for a specified duration
   * @param seconds Duration in seconds
   */
  vibrate(seconds: number): void {
    if (!this.enabled) return;

    const ms = Math.round(seconds * 1000);
    
    // Try standard Vibration API
    if (this.supported) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Vibration failed, ignore
      }
    }
    
    // Try Gamepad haptic feedback
    this.tryGamepadHaptic(ms / 1000, 1.0);
  }

  /**
   * Vibrate with a pattern
   * @param pattern Array of vibration/pause durations
   */
  vibratePattern(pattern: VibrationPattern[]): void {
    if (!this.enabled || pattern.length === 0) return;

    // Convert pattern to Web API format (alternating vibrate/pause)
    const webPattern: number[] = [];
    for (const step of pattern) {
      webPattern.push(step.duration);
      if (step.pause !== undefined && step.pause > 0) {
        webPattern.push(step.pause);
      }
    }

    if (this.supported) {
      try {
        navigator.vibrate(webPattern);
      } catch {
        // Vibration pattern failed, ignore
      }
    }
  }

  /**
   * Stop any ongoing vibration
   */
  stopVibration(): void {
    if (this.supported) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Short impact vibration (for button presses, hits)
   */
  impact(): void {
    this.vibrate(0.05);
  }

  /**
   * Medium vibration (for damage, stomps)
   */
  hit(): void {
    this.vibrate(0.1);
  }

  /**
   * Long vibration (for death, explosions)
   */
  explosion(): void {
    this.vibrate(0.25);
  }

  /**
   * Double tap vibration (for double jump, special moves)
   */
  doubleTap(): void {
    this.vibratePattern([
      { duration: 30, pause: 50 },
      { duration: 30 },
    ]);
  }

  /**
   * Success vibration (for level complete, collecting key items)
   */
  success(): void {
    this.vibratePattern([
      { duration: 50, pause: 50 },
      { duration: 100 },
    ]);
  }

  /**
   * Try to use gamepad haptic feedback
   * @param duration Duration in seconds
   * @param intensity 0.0 to 1.0
   */
  private tryGamepadHaptic(duration: number, intensity: number): void {
    // Get connected gamepads
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    for (const gamepad of gamepads) {
      if (gamepad) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hapticGamepad = gamepad as any;
        if (hapticGamepad.vibrationActuator) {
          try {
            // Standard Gamepad Haptic API
            hapticGamepad.vibrationActuator.playEffect('dual-rumble', {
              duration: duration * 1000,
              strongMagnitude: intensity,
              weakMagnitude: intensity * 0.5,
            });
            return;
          } catch {
            // Haptic not supported on this gamepad
          }
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopVibration();
  }
}

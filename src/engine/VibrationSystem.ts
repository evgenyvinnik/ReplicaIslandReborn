/**
 * Vibration System - Haptic feedback for supported devices
 * Ported from: Original/src/com/replica/replicaisland/VibrationSystem.java
 * 
 * Uses the Web Vibration API for mobile browsers and Gamepad haptic API
 * for controllers that support it.
 * 
 * Device support and permission vary. All haptics are best-effort and must
 * never interrupt gameplay, including asynchronous controller failures.
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
  
  private activeActuators = new Set<globalThis.GamepadHapticActuator>();
  private deviceActive = false;

  private getActuators(): globalThis.GamepadHapticActuator[] {
    try {
      if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
      return [...navigator.getGamepads()].flatMap(gamepad => {
        const actuator = gamepad?.connected ? gamepad.vibrationActuator : undefined;
        return actuator && typeof actuator.playEffect === 'function' ? [actuator] : [];
      });
    } catch {
      // Gamepad access can be denied by the embedding browser's policy.
      return [];
    }
  }

  private vibrateDevice(pattern: number | number[]): void {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        this.deviceActive = pattern !== 0;
        navigator.vibrate(pattern);
      }
    } catch { /* Optional hardware/permission must not break the game. */ }
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
    return (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') ||
      this.getActuators().length > 0;
  }

  /**
   * Vibrate for a specified duration
   * @param seconds Duration in seconds
   */
  vibrate(seconds: number): void {
    if (!this.enabled || !Number.isFinite(seconds) || seconds < 0) return;
    if (seconds === 0) { this.stopVibration(); return; }

    const ms = Math.round(seconds * 1000);
    
    // Try standard Vibration API
    this.vibrateDevice(ms);
    
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

    this.vibrateDevice(webPattern);
  }

  /**
   * Stop any ongoing vibration
   */
  stopVibration(): void {
    if (this.deviceActive) this.vibrateDevice(0);
    this.deviceActive = false;
    for (const actuator of this.activeActuators) {
      try {
        void Promise.resolve(actuator.reset?.()).catch(() => {});
      } catch { /* A disconnected controller may reject cancellation. */ }
    }
    this.activeActuators.clear();
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
    for (const actuator of this.getActuators()) {
      try {
        const effect = actuator.playEffect('dual-rumble', {
          duration: duration * 1000,
          strongMagnitude: intensity,
          weakMagnitude: intensity * 0.5,
        });
        this.activeActuators.add(actuator);
        void Promise.resolve(effect).catch(() => {});
        return;
      } catch { /* Try another available actuator after a synchronous failure. */ }
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.enabled = false;
    this.stopVibration();
  }
}

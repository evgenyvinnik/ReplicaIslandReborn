/**
 * Game Settings Manager - Compatibility Layer
 * 
 * This file provides backward compatibility for existing code that uses
 * the old gameSettings singleton. It wraps the new Zustand store.
 * 
 * NEW CODE SHOULD USE:
 *   import { useGameStore, useSettings, useSetting } from '../stores/useGameStore';
 * 
 * LEGACY CODE CAN CONTINUE USING:
 *   import { gameSettings } from '../utils/GameSettings';
 */

import {
  useGameStore,
  getSettings,
  getSetting,
  type GameSettings,
  type KeyBindings,
  DEFAULT_SETTINGS,
  DEFAULT_KEY_BINDINGS,
  DifficultySettings,
  type DifficultyConstants,
} from '../stores/useGameStore';

// Re-export types for backward compatibility
export type { GameSettings, KeyBindings, DifficultyConstants };
export { DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS, DifficultySettings };

/**
 * Settings manager singleton - wraps Zustand store for backward compatibility
 */
class SettingsManager {
  private listeners: Set<(settings: GameSettings) => void> = new Set();
  private unsubscribeStore: (() => void) | null = null;

  constructor() {
    // Subscribe to Zustand store changes and forward to legacy listeners
    this.unsubscribeStore = useGameStore.subscribe((state, prevState) => {
      if (state.settings !== prevState.settings) {
        this.notifyListeners();
      }
    });
  }

  /** Get all settings */
  getAll(): GameSettings {
    return getSettings();
  }

  /** Get a specific setting */
  get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return getSetting(key);
  }

  /** Set a specific setting */
  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    useGameStore.getState().setSetting(key, value);
  }

  /** Update multiple settings at once */
  update(updates: Partial<GameSettings>): void {
    useGameStore.getState().updateSettings(updates);
  }

  /** Reset to defaults */
  reset(): void {
    useGameStore.getState().resetSettings();
  }

  /** Reset key bindings to defaults */
  resetKeyBindings(): void {
    useGameStore.getState().resetKeyBindings();
  }

  /** Set a key binding */
  setKeyBinding(action: keyof KeyBindings, keys: string[]): void {
    useGameStore.getState().setKeyBinding(action, keys);
  }

  /** Check if a key is bound to an action */
  isKeyBound(action: keyof KeyBindings, key: string): boolean {
    return this.get('keyBindings')[action].includes(key);
  }

  /** Get the key bound to an action (first one) */
  getKeyForAction(action: keyof KeyBindings): string {
    return this.get('keyBindings')[action][0] || '';
  }

  /** Subscribe to settings changes */
  subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /** Notify all legacy listeners */
  private notifyListeners(): void {
    const settings = this.getAll();
    this.listeners.forEach(listener => listener(settings));
  }

  /** Cleanup */
  destroy(): void {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    this.listeners.clear();
  }
}

/** Export singleton instance for backward compatibility */
export const gameSettings = new SettingsManager();

/** Get current difficulty settings */
export function getDifficultySettings(): DifficultyConstants {
  return DifficultySettings[gameSettings.get('difficulty')];
}

/**
 * Game Settings Manager
 * Handles persistent settings storage using localStorage
 * Ported from: Original/res/xml/preferences.xml
 */

// Settings interface
export interface GameSettings {
  // Sound settings
  soundEnabled: boolean;
  soundVolume: number;
  
  // Control settings
  clickAttackEnabled: boolean;
  onScreenControlsEnabled: boolean;
  tiltControlsEnabled: boolean;
  movementSensitivity: number;
  tiltSensitivity: number;
  
  // Keyboard bindings
  keyBindings: KeyBindings;
  
  // Display settings
  showFPS: boolean;
  pixelPerfect: boolean;
  
  // Game settings
  difficulty: 'baby' | 'kids' | 'adults';
  
  // Debug settings
  debugMode: boolean;
}

// Key binding configuration
export interface KeyBindings {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  jump: string[];
  attack: string[];
  pause: string[];
}

// Default key bindings
const DEFAULT_KEY_BINDINGS: KeyBindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space'],
  attack: ['KeyX', 'KeyZ'],
  pause: ['Escape', 'KeyP'],
};

// Default settings
const DEFAULT_SETTINGS: GameSettings = {
  // Sound
  soundEnabled: true,
  soundVolume: 80,
  
  // Controls
  clickAttackEnabled: true,
  onScreenControlsEnabled: true,
  tiltControlsEnabled: false,
  movementSensitivity: 100,
  tiltSensitivity: 50,
  
  // Keyboard
  keyBindings: DEFAULT_KEY_BINDINGS,
  
  // Display
  showFPS: false,
  pixelPerfect: true,
  
  // Game
  difficulty: 'kids',
  
  // Debug
  debugMode: false,
};

// Storage key
const STORAGE_KEY = 'replica_island_settings';

// Helper to safely access localStorage
function getStorage(): typeof globalThis.localStorage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  } catch {
    return null;
  }
}

// Settings singleton class
class SettingsManager {
  private settings: GameSettings;
  private listeners: Set<(settings: GameSettings) => void> = new Set();
  
  constructor() {
    this.settings = this.load();
  }
  
  // Load settings from localStorage
  private load(): GameSettings {
    try {
      const storage = getStorage();
      if (storage) {
        const stored = storage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<GameSettings>;
          // Merge with defaults to ensure all properties exist
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }
  
  // Save settings to localStorage
  private save(): void {
    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
    // Notify listeners
    this.notifyListeners();
  }
  
  // Get all settings
  getAll(): GameSettings {
    return { ...this.settings };
  }
  
  // Get a specific setting
  get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return this.settings[key];
  }
  
  // Set a specific setting
  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }
  
  // Update multiple settings at once
  update(updates: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.save();
  }
  
  // Reset to defaults
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
  }
  
  // Reset key bindings to defaults
  resetKeyBindings(): void {
    this.settings.keyBindings = { ...DEFAULT_KEY_BINDINGS };
    this.save();
  }
  
  // Set a key binding
  setKeyBinding(action: keyof KeyBindings, keys: string[]): void {
    this.settings.keyBindings[action] = keys;
    this.save();
  }
  
  // Check if a key is bound to an action
  isKeyBound(action: keyof KeyBindings, key: string): boolean {
    return this.settings.keyBindings[action].includes(key);
  }
  
  // Get the key bound to an action (first one)
  getKeyForAction(action: keyof KeyBindings): string {
    return this.settings.keyBindings[action][0] || '';
  }
  
  // Subscribe to settings changes
  subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  // Notify all listeners
  private notifyListeners(): void {
    const settings = this.getAll();
    this.listeners.forEach(listener => listener(settings));
  }
}

// Export singleton instance
export const gameSettings = new SettingsManager();

// Export default settings for reference
export { DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS };

// Difficulty constants (ported from DifficultyConstants.java)
export interface DifficultyConstants {
  playerMaxLife: number;
  playerHitPoints: number;
  coinValue: number;
  rubyValue: number;
  playerInvincibleTime: number;
  enemyDamage: number;
}

export const DifficultySettings: Record<GameSettings['difficulty'], DifficultyConstants> = {
  baby: {
    playerMaxLife: 5,
    playerHitPoints: 3,
    coinValue: 2,
    rubyValue: 5,
    playerInvincibleTime: 3.0,
    enemyDamage: 1,
  },
  kids: {
    playerMaxLife: 3,
    playerHitPoints: 2,
    coinValue: 1,
    rubyValue: 3,
    playerInvincibleTime: 2.0,
    enemyDamage: 1,
  },
  adults: {
    playerMaxLife: 2,
    playerHitPoints: 1,
    coinValue: 1,
    rubyValue: 2,
    playerInvincibleTime: 1.5,
    enemyDamage: 2,
  },
};

// Get current difficulty settings
export function getDifficultySettings(): DifficultyConstants {
  return DifficultySettings[gameSettings.get('difficulty')];
}

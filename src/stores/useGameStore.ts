/**
 * Game Store - Centralized state management using Zustand
 * Handles all persistent game data: settings, progress, and high scores
 * 
 * Storage key: 'replica-island-save-data'
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/** Key binding configuration */
export interface KeyBindings {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  jump: string[];
  attack: string[];
  pause: string[];
}

/** Game settings/options */
export interface GameSettings {
  // Sound
  soundEnabled: boolean;
  soundVolume: number; // 0-100
  musicEnabled: boolean;
  musicVolume: number; // 0-100
  
  // Controls
  clickAttackEnabled: boolean;
  onScreenControlsEnabled: boolean;
  tiltControlsEnabled: boolean;
  movementSensitivity: number; // 0-100
  tiltSensitivity: number; // 0-100
  
  // Keyboard
  keyBindings: KeyBindings;
  
  // Display
  showFPS: boolean;
  pixelPerfect: boolean;
  
  // Game
  difficulty: 'baby' | 'kids' | 'adults';
  
  // Debug
  debugMode: boolean;
}

/** Progress data for a single level */
export interface LevelProgress {
  unlocked: boolean;
  completed: boolean;
  bestTime: number | null; // In seconds, null if never completed
  bestScore: number;
  diariesCollected: number[];  // Array of diary IDs collected in this level
  timesPlayed: number;
  timesCompleted: number;
  firstCompletedAt: number | null; // Timestamp
  lastPlayedAt: number | null; // Timestamp
}

/** Overall game progress */
export interface GameProgress {
  /** Level ID -> Progress data */
  levels: Record<number, LevelProgress>;
  
  /** Total stats across all playthroughs */
  totalStats: {
    totalPlayTime: number; // In seconds
    totalDeaths: number;
    totalCoinsCollected: number;
    totalRubiesCollected: number;
    totalEnemiesDefeated: number;
    gamesStarted: number;
    gamesCompleted: number;
  };
  
  /** Diary entries collected (global IDs) */
  diariesCollected: number[];
  
  /** Achievements/extras unlocked */
  extrasUnlocked: {
    linearMode: boolean;
    levelSelect: boolean;
    soundTest: boolean;
  };
}

/** High score entry */
export interface HighScoreEntry {
  score: number;
  levelId: number;
  timestamp: number;
  difficulty: 'baby' | 'kids' | 'adults';
}

/** Combined store state */
export interface GameStoreState {
  // Settings slice
  settings: GameSettings;
  
  // Progress slice
  progress: GameProgress;
  
  // High scores slice
  highScores: HighScoreEntry[];
  
  // Version for migrations
  version: number;
}

/** Store actions */
export interface GameStoreActions {
  // Settings actions
  setSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  updateSettings: (updates: Partial<GameSettings>) => void;
  resetSettings: () => void;
  setKeyBinding: (action: keyof KeyBindings, keys: string[]) => void;
  resetKeyBindings: () => void;
  
  // Progress actions
  unlockLevel: (levelId: number) => void;
  completeLevel: (levelId: number, score: number, time: number) => void;
  recordLevelAttempt: (levelId: number) => void;
  collectDiary: (levelId: number, diaryId: number) => void;
  addToTotalStats: (stats: Partial<GameProgress['totalStats']>) => void;
  unlockExtra: (extra: keyof GameProgress['extrasUnlocked']) => void;
  
  // High score actions
  addHighScore: (entry: Omit<HighScoreEntry, 'timestamp'>) => void;
  getTopScores: (count?: number) => HighScoreEntry[];
  getLevelHighScore: (levelId: number) => number;
  
  // Global actions
  resetAllProgress: () => void;
  resetEverything: () => void;
  
  // Migration
  migrateFromOldStorage: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_KEY_BINDINGS: KeyBindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space'],
  attack: ['KeyX', 'KeyZ'],
  pause: ['Escape', 'KeyP'],
};

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  soundVolume: 80,
  musicEnabled: true,
  musicVolume: 70,
  clickAttackEnabled: true,
  onScreenControlsEnabled: true,
  tiltControlsEnabled: false,
  movementSensitivity: 100,
  tiltSensitivity: 50,
  keyBindings: DEFAULT_KEY_BINDINGS,
  showFPS: false,
  pixelPerfect: true,
  difficulty: 'kids',
  debugMode: false,
};

const DEFAULT_LEVEL_PROGRESS: LevelProgress = {
  unlocked: false,
  completed: false,
  bestTime: null,
  bestScore: 0,
  diariesCollected: [],
  timesPlayed: 0,
  timesCompleted: 0,
  firstCompletedAt: null,
  lastPlayedAt: null,
};

const DEFAULT_PROGRESS: GameProgress = {
  levels: {
    // Level 1 is always unlocked by default
    1: {
      ...DEFAULT_LEVEL_PROGRESS,
      unlocked: true,
    },
  },
  totalStats: {
    totalPlayTime: 0,
    totalDeaths: 0,
    totalCoinsCollected: 0,
    totalRubiesCollected: 0,
    totalEnemiesDefeated: 0,
    gamesStarted: 0,
    gamesCompleted: 0,
  },
  diariesCollected: [],
  extrasUnlocked: {
    linearMode: false,
    levelSelect: false,
    soundTest: false,
  },
};

const CURRENT_VERSION = 1;
const MAX_HIGH_SCORES = 100;

// ============================================================================
// Helper Functions
// ============================================================================

/** Create default level progress with optional unlock state */
function createDefaultLevelProgress(unlocked = false): LevelProgress {
  return {
    ...DEFAULT_LEVEL_PROGRESS,
    unlocked,
  };
}

// ============================================================================
// Store Creation
// ============================================================================

type GameStore = GameStoreState & GameStoreActions;

// Note: Zustand infers types from the GameStore type, so we disable the explicit-return-type rule
// for the store implementation to avoid redundant type annotations
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: DEFAULT_SETTINGS,
      progress: DEFAULT_PROGRESS,
      highScores: [],
      version: CURRENT_VERSION,

      // ========================================
      // Settings Actions
      // ========================================

      setSetting: (key, value) => {
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        }));
      },

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      resetSettings: () => {
        set({ settings: DEFAULT_SETTINGS });
      },

      setKeyBinding: (action, keys) => {
        set((state) => ({
          settings: {
            ...state.settings,
            keyBindings: {
              ...state.settings.keyBindings,
              [action]: keys,
            },
          },
        }));
      },

      resetKeyBindings: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            keyBindings: DEFAULT_KEY_BINDINGS,
          },
        }));
      },

      // ========================================
      // Progress Actions
      // ========================================

      unlockLevel: (levelId) => {
        set((state) => {
          const existingProgress = state.progress.levels[levelId];
          return {
            progress: {
              ...state.progress,
              levels: {
                ...state.progress.levels,
                [levelId]: existingProgress
                  ? { ...existingProgress, unlocked: true }
                  : createDefaultLevelProgress(true),
              },
            },
          };
        });
      },

      completeLevel: (levelId, score, time) => {
        set((state) => {
          const existing = state.progress.levels[levelId] || createDefaultLevelProgress(true);
          const now = Date.now();

          return {
            progress: {
              ...state.progress,
              levels: {
                ...state.progress.levels,
                [levelId]: {
                  ...existing,
                  completed: true,
                  bestTime: existing.bestTime === null
                    ? time
                    : Math.min(existing.bestTime, time),
                  bestScore: Math.max(existing.bestScore, score),
                  timesCompleted: existing.timesCompleted + 1,
                  firstCompletedAt: existing.firstCompletedAt ?? now,
                  lastPlayedAt: now,
                },
              },
            },
          };
        });

        // Also add to high scores
        get().addHighScore({
          score,
          levelId,
          difficulty: get().settings.difficulty,
        });
      },

      recordLevelAttempt: (levelId) => {
        set((state) => {
          const existing = state.progress.levels[levelId] || createDefaultLevelProgress(true);

          return {
            progress: {
              ...state.progress,
              levels: {
                ...state.progress.levels,
                [levelId]: {
                  ...existing,
                  timesPlayed: existing.timesPlayed + 1,
                  lastPlayedAt: Date.now(),
                },
              },
            },
          };
        });
      },

      collectDiary: (levelId, diaryId) => {
        set((state) => {
          const existing = state.progress.levels[levelId];
          if (!existing) return state;

          // Check if already collected in this level
          if (existing.diariesCollected.includes(diaryId)) {
            return state;
          }

          return {
            progress: {
              ...state.progress,
              levels: {
                ...state.progress.levels,
                [levelId]: {
                  ...existing,
                  diariesCollected: [...existing.diariesCollected, diaryId],
                },
              },
              // Also add to global diary collection if not already there
              diariesCollected: state.progress.diariesCollected.includes(diaryId)
                ? state.progress.diariesCollected
                : [...state.progress.diariesCollected, diaryId],
            },
          };
        });
      },

      addToTotalStats: (stats) => {
        set((state) => ({
          progress: {
            ...state.progress,
            totalStats: {
              totalPlayTime: state.progress.totalStats.totalPlayTime + (stats.totalPlayTime ?? 0),
              totalDeaths: state.progress.totalStats.totalDeaths + (stats.totalDeaths ?? 0),
              totalCoinsCollected: state.progress.totalStats.totalCoinsCollected + (stats.totalCoinsCollected ?? 0),
              totalRubiesCollected: state.progress.totalStats.totalRubiesCollected + (stats.totalRubiesCollected ?? 0),
              totalEnemiesDefeated: state.progress.totalStats.totalEnemiesDefeated + (stats.totalEnemiesDefeated ?? 0),
              gamesStarted: state.progress.totalStats.gamesStarted + (stats.gamesStarted ?? 0),
              gamesCompleted: state.progress.totalStats.gamesCompleted + (stats.gamesCompleted ?? 0),
            },
          },
        }));
      },

      unlockExtra: (extra) => {
        set((state) => ({
          progress: {
            ...state.progress,
            extrasUnlocked: {
              ...state.progress.extrasUnlocked,
              [extra]: true,
            },
          },
        }));
      },

      // ========================================
      // High Score Actions
      // ========================================

      addHighScore: (entry) => {
        set((state) => {
          const newEntry: HighScoreEntry = {
            ...entry,
            timestamp: Date.now(),
          };

          const newScores = [...state.highScores, newEntry]
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_HIGH_SCORES);

          return { highScores: newScores };
        });
      },

      getTopScores: (count = 10) => {
        return get().highScores.slice(0, count);
      },

      getLevelHighScore: (levelId) => {
        const levelScores = get().highScores.filter((s) => s.levelId === levelId);
        return levelScores.length > 0 ? Math.max(...levelScores.map((s) => s.score)) : 0;
      },

      // ========================================
      // Global Actions
      // ========================================

      resetAllProgress: () => {
        set({
          progress: DEFAULT_PROGRESS,
          highScores: [],
        });
      },

      resetEverything: () => {
        // First, clear the persisted storage to ensure a clean slate
        localStorage.removeItem('replica-island-save-data');
        
        // Then reset all state to defaults
        set({
          settings: DEFAULT_SETTINGS,
          progress: DEFAULT_PROGRESS,
          highScores: [],
          version: CURRENT_VERSION,
        });
      },

      // ========================================
      // Migration from old storage format
      // ========================================

      migrateFromOldStorage: () => {
        try {
          // Migrate old settings
          const oldSettings = window.localStorage.getItem('replica_island_settings');
          if (oldSettings) {
            const parsed = JSON.parse(oldSettings) as Partial<GameSettings>;
            set((state) => ({
              settings: { ...state.settings, ...parsed },
            }));
            window.localStorage.removeItem('replica_island_settings');
          }

          // Migrate old level progress
          const oldLevels = window.localStorage.getItem('replicaIsland_unlockedLevels');
          if (oldLevels) {
            const unlockedIds = JSON.parse(oldLevels) as number[];
            set((state) => {
              const newLevels = { ...state.progress.levels };
              for (const id of unlockedIds) {
                if (!newLevels[id]) {
                  newLevels[id] = createDefaultLevelProgress(true);
                } else {
                  newLevels[id].unlocked = true;
                }
              }
              return {
                progress: {
                  ...state.progress,
                  levels: newLevels,
                },
              };
            });
            window.localStorage.removeItem('replicaIsland_unlockedLevels');
          }

          // Migration complete - no logging needed in production
        } catch (error) {
          console.warn('[GameStore] Migration failed:', error);
        }
      },
    }),
    {
      name: 'replica-island-save-data',
      storage: createJSONStorage(() => localStorage),
      version: CURRENT_VERSION,
      // Handle migrations between versions
      migrate: (persistedState, version) => {
        if (version === 0) {
          // Migration from version 0 to 1
          // Add any necessary transformations
        }
        return persistedState as GameStore;
      },
      // Only persist specific parts of the state
      partialize: (state) => ({
        settings: state.settings,
        progress: state.progress,
        highScores: state.highScores,
        version: state.version,
      }),
    }
  )
);

// ============================================================================
// Selectors (for optimized re-renders)
// ============================================================================

/** Get just the settings */
export const useSettings = (): GameSettings => useGameStore((state) => state.settings);

/** Get a specific setting */
export function useSetting<K extends keyof GameSettings>(key: K): GameSettings[K] {
  return useGameStore((state) => state.settings[key]);
}

/** Get progress for a specific level */
export const useLevelProgress = (levelId: number): LevelProgress | undefined =>
  useGameStore((state) => state.progress.levels[levelId]);

/** Check if a level is unlocked */
export const useIsLevelUnlocked = (levelId: number): boolean =>
  useGameStore((state) => state.progress.levels[levelId]?.unlocked ?? false);

/** Get total stats */
export const useTotalStats = (): GameProgress['totalStats'] =>
  useGameStore((state) => state.progress.totalStats);

/** Get all diaries collected */
export const useDiariesCollected = (): number[] =>
  useGameStore((state) => state.progress.diariesCollected);

/** Get high scores */
export const useHighScores = (count = 10): HighScoreEntry[] =>
  useGameStore((state) => state.highScores.slice(0, count));

// ============================================================================
// Difficulty Constants (moved from old GameSettings.ts)
// ============================================================================

export interface DifficultyConstants {
  playerMaxLife: number;
  playerHitPoints: number;
  coinValue: number;
  rubyValue: number;
  playerInvincibleTime: number;
  enemyDamage: number;
  // Glow mode / Invincibility powerup
  coinsPerPowerup: number;
  glowDuration: number;
}

export const DifficultySettings: Record<GameSettings['difficulty'], DifficultyConstants> = {
  baby: {
    playerMaxLife: 5,
    playerHitPoints: 3,
    coinValue: 2,
    rubyValue: 5,
    playerInvincibleTime: 3.0,
    enemyDamage: 1,
    coinsPerPowerup: 15,   // Easier to get powerup
    glowDuration: 20.0,    // Longer duration
  },
  kids: {
    playerMaxLife: 3,
    playerHitPoints: 2,
    coinValue: 1,
    rubyValue: 3,
    playerInvincibleTime: 2.0,
    enemyDamage: 1,
    coinsPerPowerup: 20,
    glowDuration: 15.0,
  },
  adults: {
    playerMaxLife: 2,
    playerHitPoints: 1,
    coinValue: 1,
    rubyValue: 2,
    playerInvincibleTime: 1.5,
    enemyDamage: 2,
    coinsPerPowerup: 30,   // Harder to get powerup
    glowDuration: 10.0,    // Shorter duration
  },
};

/** Get difficulty constants for current difficulty setting */
export const useDifficultyConstants = (): DifficultyConstants => {
  const difficulty = useGameStore((state) => state.settings.difficulty);
  return DifficultySettings[difficulty];
};

/** Get difficulty constants (non-hook version for use outside React) */
export const getDifficultyConstants = (): DifficultyConstants => {
  const difficulty = useGameStore.getState().settings.difficulty;
  return DifficultySettings[difficulty];
};

// ============================================================================
// Non-React access (for game engine code)
// ============================================================================

/** Get current settings without hooks (for engine code) */
export const getSettings = (): GameSettings => useGameStore.getState().settings;

/** Get specific setting without hooks */
export function getSetting<K extends keyof GameSettings>(key: K): GameSettings[K] {
  return useGameStore.getState().settings[key];
}

/** Check if level is unlocked (non-hook) */
export const isLevelUnlocked = (levelId: number): boolean =>
  useGameStore.getState().progress.levels[levelId]?.unlocked ?? false;

/** Get all unlocked level IDs (non-hook) */
export const getUnlockedLevelIds = (): number[] =>
  Object.entries(useGameStore.getState().progress.levels)
    .filter(([, progress]) => progress.unlocked)
    .map(([id]) => parseInt(id, 10));

// ============================================================================
// Initialization
// ============================================================================

/** Initialize store and run migrations */
export const initializeGameStore = (): void => {
  // Run migration from old storage format
  useGameStore.getState().migrateFromOldStorage();
};

// Export defaults for reference
export { DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS, DEFAULT_PROGRESS };

/**
 * Game Context - Global game state management
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from 'react';
import { GameState, type GameConfig, type SaveData } from '../types';
import { CutsceneType } from '../data/cutscenes';

// Game context state
interface GameContextState {
  gameState: GameState;
  config: GameConfig;
  saveData: SaveData;
  currentLevel: number;
  isPaused: boolean;
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
  /** Active cutscene type (when in CUTSCENE state) */
  activeCutscene: CutsceneType | null;
}

// Actions
type GameAction =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'SET_CONFIG'; payload: Partial<GameConfig> }
  | { type: 'SET_SAVE_DATA'; payload: Partial<SaveData> }
  | { type: 'SET_CURRENT_LEVEL'; payload: number }
  | { type: 'SET_PAUSED'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_PROGRESS'; payload: number }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_CUTSCENE'; payload: CutsceneType | null }
  | { type: 'COMPLETE_CURRENT_LEVEL' }
  | { type: 'GAME_OVER' }
  | { type: 'RESET' };

// Default config
const defaultConfig: GameConfig = {
  canvasWidth: 480,
  canvasHeight: 320,
  targetFPS: 60,
  maxDeltaTime: 0.1,
  debugMode: false,
  soundEnabled: true,

  difficulty: 'normal',
};

// Default save data
const defaultSaveData: SaveData = {
  currentLevel: 1,
  completedLevels: [],
  totalPearls: 0,
  totalDeaths: 0,
  playTime: 0,
  lastPlayed: new Date().toISOString(),
};

// Initial state
const initialState: GameContextState = {
  gameState: GameState.LOADING,
  config: defaultConfig,
  saveData: defaultSaveData,
  currentLevel: 1,
  isPaused: false,
  isLoading: true,
  loadingProgress: 0,
  error: null,
  activeCutscene: null,
};

// Reducer
function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload };
    case 'SET_CONFIG':
      return { ...state, config: { ...state.config, ...action.payload } };
    case 'SET_SAVE_DATA':
      return { ...state, saveData: { ...state.saveData, ...action.payload } };
    case 'SET_CURRENT_LEVEL':
      return { ...state, currentLevel: action.payload };
    case 'SET_PAUSED':
      return { ...state, isPaused: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LOADING_PROGRESS':
      return { ...state, loadingProgress: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_ACTIVE_CUTSCENE':
      return { ...state, activeCutscene: action.payload };
    case 'COMPLETE_CURRENT_LEVEL': {
      const newCompletedLevels = [...state.saveData.completedLevels];
      if (!newCompletedLevels.includes(state.currentLevel)) {
        newCompletedLevels.push(state.currentLevel);
      }
      return {
        ...state,
        saveData: { ...state.saveData, completedLevels: newCompletedLevels },
        gameState: GameState.LEVEL_COMPLETE,
      };
    }
    case 'GAME_OVER':
      return {
        ...state,
        saveData: { ...state.saveData, totalDeaths: state.saveData.totalDeaths + 1 },
        gameState: GameState.GAME_OVER,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// Context
interface GameContextValue {
  state: GameContextState;
  dispatch: React.Dispatch<GameAction>;
  // Helper functions
  startGame: (level?: number) => void;
  startNewGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  goToMainMenu: () => void;
  goToLevelSelect: () => void;
  goToDifficultySelect: () => void;
  goToOptions: () => void;
  setLevel: (level: number) => void;
  completeLevel: () => void;
  gameOver: () => void;
  /** Start a cutscene */
  playCutscene: (cutsceneType: CutsceneType) => void;
  /** End the current cutscene */
  endCutscene: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// Provider component
interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps): React.JSX.Element {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const startGame = useCallback((level?: number): void => {
    if (level !== undefined) {
      dispatch({ type: 'SET_CURRENT_LEVEL', payload: level });
    }
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.PLAYING });
    dispatch({ type: 'SET_PAUSED', payload: false });
  }, []);

  const startNewGame = useCallback((): void => {
    // Reset save data for a new game
    dispatch({ type: 'SET_SAVE_DATA', payload: { ...defaultSaveData } });
    dispatch({ type: 'SET_CURRENT_LEVEL', payload: 1 });
    // Go to difficulty select first (like the original game)
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.DIFFICULTY_SELECT });
  }, []);

  const pauseGame = useCallback((): void => {
    dispatch({ type: 'SET_PAUSED', payload: true });
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.PAUSED });
  }, []);

  const resumeGame = useCallback((): void => {
    dispatch({ type: 'SET_PAUSED', payload: false });
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.PLAYING });
  }, []);

  const goToMainMenu = useCallback((): void => {
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.MAIN_MENU });
    dispatch({ type: 'SET_PAUSED', payload: false });
  }, []);

  const goToLevelSelect = useCallback((): void => {
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.LEVEL_SELECT });
  }, []);

  const goToDifficultySelect = useCallback((): void => {
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.DIFFICULTY_SELECT });
  }, []);

  const goToOptions = useCallback((): void => {
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.OPTIONS });
  }, []);

  const setLevel = useCallback((level: number): void => {
    dispatch({ type: 'SET_CURRENT_LEVEL', payload: level });
  }, []);

  const completeLevel = useCallback((): void => {
    dispatch({ type: 'COMPLETE_CURRENT_LEVEL' });
  }, []);

  const gameOver = useCallback((): void => {
    dispatch({ type: 'GAME_OVER' });
  }, []);

  const playCutscene = useCallback((cutsceneType: CutsceneType): void => {
    dispatch({ type: 'SET_ACTIVE_CUTSCENE', payload: cutsceneType });
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.CUTSCENE });
  }, []);

  const endCutscene = useCallback((): void => {
    dispatch({ type: 'SET_ACTIVE_CUTSCENE', payload: null });
    // Return to playing state after cutscene
    dispatch({ type: 'SET_GAME_STATE', payload: GameState.PLAYING });
  }, []);

  const value: GameContextValue = useMemo(() => ({
    state,
    dispatch,
    startGame,
    startNewGame,
    pauseGame,
    resumeGame,
    goToMainMenu,
    goToLevelSelect,
    goToDifficultySelect,
    goToOptions,
    setLevel,
    completeLevel,
    gameOver,
    playCutscene,
    endCutscene,
  }), [
    state,
    startGame,
    startNewGame,
    pauseGame,
    resumeGame,
    goToMainMenu,
    goToLevelSelect,
    goToDifficultySelect,
    goToOptions,
    setLevel,
    completeLevel,
    gameOver,
    playCutscene,
    endCutscene,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// Hook
export function useGameContext(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}

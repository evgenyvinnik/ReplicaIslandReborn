/**
 * Main App Component
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useGameContext, GameProvider } from './context/GameContext';
import { GameState } from './types';
import { MainMenu } from './components/MainMenu';
import { DifficultyMenu } from './components/DifficultyMenu';
import { LevelSelect } from './components/LevelSelect';
import { OptionsMenu } from './components/OptionsMenu';
import { Game } from './components/Game';
import { LoadingScreen } from './components/LoadingScreen';
import { PhoneFrame } from './components/PhoneFrame';
import { AndroidHomeScreen } from './components/AndroidHomeScreen';
import { AndroidRecentsScreen } from './components/AndroidRecentsScreen';

// Original game resolution
const GAME_WIDTH = 480;
const GAME_HEIGHT = 320;

function AppContent(): React.JSX.Element {
  const { state, dispatch, goToMainMenu, pauseGame, resumeGame } = useGameContext();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [osMode, setOsMode] = useState<'app' | 'home' | 'recents'>('app');

  // Handle back button press
  const handleBack = useCallback(() => {
    if (osMode !== 'app') {
      if (osMode === 'recents') {
        setOsMode('app');
      }
      return;
    }

    switch (state.gameState) {
      case GameState.PLAYING:
      case GameState.DIALOG:
        pauseGame();
        break;
      case GameState.PAUSED:
        resumeGame();
        break;
      case GameState.LEVEL_SELECT:
      case GameState.DIFFICULTY_SELECT:
      case GameState.OPTIONS:
      case GameState.GAME_OVER:
      case GameState.LEVEL_COMPLETE:
        goToMainMenu();
        break;
      case GameState.MAIN_MENU:
        // Already at main menu
        break;
    }
  }, [state.gameState, pauseGame, resumeGame, goToMainMenu, osMode]);

  const handleHome = useCallback(() => {
    setOsMode('home');
    if (state.gameState === GameState.PLAYING || state.gameState === GameState.DIALOG) {
      pauseGame();
    }
  }, [state.gameState, pauseGame]);

  const handleRecents = useCallback(() => {
    if (osMode === 'recents') {
      setOsMode('app');
    } else {
      setOsMode('recents');
      if (state.gameState === GameState.PLAYING || state.gameState === GameState.DIALOG) {
        pauseGame();
      }
    }
  }, [osMode, state.gameState, pauseGame]);

  const handleAppLaunch = useCallback(() => {
    setOsMode('app');
  }, []);

  // Simulate initial loading
  useEffect(() => {
    const loadGame = async (): Promise<void> => {
      // Simulate loading progress
      for (let i = 0; i <= 100; i += 10) {
        setLoadingProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_GAME_STATE', payload: GameState.MAIN_MENU });
    };

    loadGame();
  }, [dispatch]);

  // Determine which screen to show
  const renderScreen = (): React.JSX.Element => {
    if (state.isLoading) {
      return <LoadingScreen progress={loadingProgress} message="Loading assets..." />;
    }

    switch (state.gameState) {
      case GameState.MAIN_MENU:
        return <MainMenu />;
      case GameState.DIFFICULTY_SELECT:
        return <DifficultyMenu />;
      case GameState.LEVEL_SELECT:
        return <LevelSelect />;
      case GameState.OPTIONS:
        return <OptionsMenu onClose={goToMainMenu} />;
      case GameState.PLAYING:
      case GameState.PAUSED:
      case GameState.GAME_OVER:
      case GameState.LEVEL_COMPLETE:
      case GameState.DIALOG:
        return <Game width={GAME_WIDTH} height={GAME_HEIGHT} />;
      default:
        return <LoadingScreen progress={0} />;
    }
  };

  return (
    <PhoneFrame 
      gameWidth={GAME_WIDTH} 
      gameHeight={GAME_HEIGHT} 
      onBack={handleBack}
      onHome={handleHome}
      onRecents={handleRecents}
    >
      <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}>
        {osMode === 'recents' && <div className="recents-background" />}
        
        <div 
           className={`app-container ${osMode === 'recents' ? 'shrunk' : ''}`}
           style={{ display: osMode === 'home' ? 'none' : 'block' }}
        >
           {renderScreen()}
        </div>

        {osMode === 'recents' && (
          <AndroidRecentsScreen 
            onResume={handleAppLaunch} 
            isOverlay={true} 
          />
        )}

        {osMode === 'home' && <AndroidHomeScreen onLaunch={handleAppLaunch} />}
      </div>
    </PhoneFrame>
  );
}

function App(): React.JSX.Element {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;

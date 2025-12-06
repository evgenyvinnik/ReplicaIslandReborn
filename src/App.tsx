/**
 * Main App Component
 */

import React, { useEffect, useState } from 'react';
import { useGameContext, GameProvider } from './context/GameContext';
import { GameState } from './types';
import { MainMenu } from './components/MainMenu';
import { LevelSelect } from './components/LevelSelect';
import { Game } from './components/Game';
import { LoadingScreen } from './components/LoadingScreen';

function AppContent(): React.JSX.Element {
  const { state, dispatch } = useGameContext();
  const [loadingProgress, setLoadingProgress] = useState(0);

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

  // Render based on game state
  if (state.isLoading) {
    return <LoadingScreen progress={loadingProgress} message="Loading assets..." />;
  }

  switch (state.gameState) {
    case GameState.MAIN_MENU:
      return <MainMenu />;
    case GameState.LEVEL_SELECT:
      return <LevelSelect />;
    case GameState.PLAYING:
    case GameState.PAUSED:
    case GameState.GAME_OVER:
    case GameState.LEVEL_COMPLETE:
      return <Game />;
    default:
      return <LoadingScreen progress={0} />;
  }
}

function App(): React.JSX.Element {
  return (
    <GameProvider>
      <div
        style={{
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: '#1a1a2e',
        }}
      >
        <AppContent />
      </div>
    </GameProvider>
  );
}

export default App;

/**
 * Game Over Screen Component
 * Shows when the player runs out of lives
 * Styled to match the original Replica Island aesthetic
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { getInventory, resetInventory } from '../entities/components/InventoryComponent';

interface GameOverScreenProps {
  onRetry?: () => void;
  onMainMenu?: () => void;
}

export function GameOverScreen({ onRetry, onMainMenu }: GameOverScreenProps): React.JSX.Element {
  const { goToMainMenu, startGame, state } = useGameContext();
  const [selectedOption, setSelectedOption] = useState(0);
  const [isFlickering, setIsFlickering] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  const inventory = getInventory();

  // Show stats after a short delay
  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), 500);
    return (): void => { clearTimeout(timer); };
  }, []);

  const options = useMemo(() => [
    { label: 'Try Again', action: 'retry' },
    { label: 'Main Menu', action: 'menu' },
  ], []);

  const handleSelect = useCallback(() => {
    setIsFlickering(true);
    
    // Flicker animation then execute action
    setTimeout(() => {
      const option = options[selectedOption];
      if (option.action === 'retry') {
        // Reset inventory for retry
        resetInventory();
        if (onRetry) {
          onRetry();
        } else {
          startGame(state.currentLevel);
        }
      } else {
        resetInventory();
        if (onMainMenu) {
          onMainMenu();
        } else {
          goToMainMenu();
        }
      }
    }, 400);
  }, [selectedOption, options, onRetry, onMainMenu, startGame, goToMainMenu, state.currentLevel]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setSelectedOption((prev) => (prev - 1 + options.length) % options.length);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          setSelectedOption((prev) => (prev + 1) % options.length);
          break;
        case 'Enter':
        case ' ':
          handleSelect();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => { window.removeEventListener('keydown', handleKeyDown); };
  }, [handleSelect, options.length]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        color: '#ff4444',
        zIndex: 100,
      }}
    >
      {/* Game Over Title */}
      <h1
        style={{
          fontSize: '32px',
          marginBottom: '20px',
          textShadow: '2px 2px 0 #880000, 4px 4px 0 #440000',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      >
        GAME OVER
      </h1>

      {/* Stats Section */}
      {showStats && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: '2px solid #666',
            borderRadius: '8px',
            padding: '16px 24px',
            marginBottom: '24px',
            minWidth: '200px',
          }}
        >
          <div style={{ color: '#aaa', fontSize: '10px', marginBottom: '8px' }}>
            Final Score
          </div>
          <div
            style={{
              color: '#ffcc00',
              fontSize: '20px',
              textAlign: 'center',
              marginBottom: '12px',
            }}
          >
            {inventory.score.toLocaleString()}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '24px',
              fontSize: '10px',
              color: '#88ff88',
            }}
          >
            <div>
              <span style={{ color: '#ffcc00' }}>💰</span> {inventory.coinCount}
            </div>
            <div>
              <span style={{ color: '#ff6699' }}>💎</span> {inventory.rubyCount}
            </div>
            <div>
              <span style={{ color: '#66ccff' }}>🔮</span> {inventory.pearls}
            </div>
          </div>
        </div>
      )}

      {/* Menu Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {options.map((option, index) => (
          <button
            key={option.action}
            onClick={() => {
              setSelectedOption(index);
              handleSelect();
            }}
            style={{
              backgroundColor: selectedOption === index ? '#333' : 'transparent',
              border: selectedOption === index ? '2px solid #ff4444' : '2px solid #666',
              borderRadius: '4px',
              padding: '12px 32px',
              color: selectedOption === index ? '#ff6666' : '#999',
              fontSize: '14px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              opacity: isFlickering && selectedOption === index ? 0.5 : 1,
              animation:
                isFlickering && selectedOption === index
                  ? 'flicker 0.1s linear infinite'
                  : 'none',
            }}
          >
            {selectedOption === index ? '▶ ' : '  '}
            {option.label}
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          fontSize: '8px',
          color: '#666',
        }}
      >
        Use ↑↓ to select, ENTER to confirm
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.02); }
          }
          @keyframes flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
}

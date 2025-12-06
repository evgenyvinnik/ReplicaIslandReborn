/**
 * Level Complete Screen Component
 * Shows when the player completes a level
 * Styled to match the original Replica Island aesthetic
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { getInventory } from '../entities/components/InventoryComponent';

interface LevelCompleteScreenProps {
  levelName?: string;
  onContinue?: () => void;
  onMainMenu?: () => void;
}

export function LevelCompleteScreen({
  levelName = 'Level',
  onContinue,
  onMainMenu,
}: LevelCompleteScreenProps): React.JSX.Element {
  const { goToMainMenu, startGame, state } = useGameContext();
  const [selectedOption, setSelectedOption] = useState(0);
  const [isFlickering, setIsFlickering] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [bonusCalculated, setBonusCalculated] = useState(false);

  const inventory = getInventory();

  // Show stats with animation
  useEffect(() => {
    const timer1 = setTimeout(() => setShowStats(true), 300);
    const timer2 = setTimeout(() => setBonusCalculated(true), 800);
    return (): void => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Calculate bonus based on remaining lives
  const lifeBonus = inventory.lives * 100;
  const totalScore = inventory.score + (bonusCalculated ? lifeBonus : 0);

  const options = useMemo(() => [
    { label: 'Continue', action: 'continue' },
    { label: 'Main Menu', action: 'menu' },
  ], []);

  const handleSelect = useCallback(() => {
    setIsFlickering(true);

    setTimeout(() => {
      const option = options[selectedOption];
      if (option.action === 'continue') {
        if (onContinue) {
          onContinue();
        } else {
          // Go to next level (handled by game logic)
          startGame(state.currentLevel + 1);
        }
      } else {
        if (onMainMenu) {
          onMainMenu();
        } else {
          goToMainMenu();
        }
      }
    }, 400);
  }, [selectedOption, options, onContinue, onMainMenu, startGame, goToMainMenu, state.currentLevel]);

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
        color: '#44ff44',
        zIndex: 100,
      }}
    >
      {/* Level Complete Title */}
      <h1
        style={{
          fontSize: '24px',
          marginBottom: '8px',
          textShadow: '2px 2px 0 #008800, 4px 4px 0 #004400',
          animation: 'celebrate 0.5s ease-out',
        }}
      >
        LEVEL COMPLETE!
      </h1>

      <div
        style={{
          fontSize: '12px',
          color: '#88ff88',
          marginBottom: '20px',
        }}
      >
        {levelName}
      </div>

      {/* Stats Section */}
      {showStats && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: '2px solid #44aa44',
            borderRadius: '8px',
            padding: '16px 24px',
            marginBottom: '24px',
            minWidth: '220px',
          }}
        >
          {/* Collectibles Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '20px',
              fontSize: '10px',
              color: '#88ff88',
              marginBottom: '12px',
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
            <div>
              <span style={{ color: '#ff4444' }}>❤️</span> ×{inventory.lives}
            </div>
          </div>

          {/* Score */}
          <div
            style={{
              borderTop: '1px solid #446644',
              paddingTop: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#aaa',
                marginBottom: '4px',
              }}
            >
              <span>Score</span>
              <span>{inventory.score.toLocaleString()}</span>
            </div>

            {bonusCalculated && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: '#ffcc00',
                  marginBottom: '4px',
                  animation: 'slideIn 0.3s ease-out',
                }}
              >
                <span>Life Bonus</span>
                <span>+{lifeBonus.toLocaleString()}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                color: '#44ff44',
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #446644',
              }}
            >
              <span>Total</span>
              <span>{totalScore.toLocaleString()}</span>
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
              backgroundColor: selectedOption === index ? '#224422' : 'transparent',
              border: selectedOption === index ? '2px solid #44ff44' : '2px solid #446644',
              borderRadius: '4px',
              padding: '12px 32px',
              color: selectedOption === index ? '#66ff66' : '#88aa88',
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
          color: '#446644',
        }}
      >
        Use ↑↓ to select, ENTER to confirm
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes celebrate {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
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

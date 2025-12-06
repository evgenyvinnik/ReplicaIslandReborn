/**
 * Difficulty Menu Component
 * 
 * Matches the original Replica Island difficulty selection:
 * - Baby (Easy) - More lives, less enemies
 * - Kids (Normal) - Standard gameplay
 * - Adults (Hard) - Fewer lives, more damage
 * 
 * Ported from: DifficultyMenuActivity.java
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState } from '../types';

export type Difficulty = 'baby' | 'kids' | 'adults';

interface DifficultyOption {
  id: Difficulty;
  label: string;
  description: string;
  value: number;
}

interface DifficultyMenuProps {
  onSelect?: (difficulty: Difficulty) => void;
}

export function DifficultyMenu({ onSelect }: DifficultyMenuProps): React.JSX.Element {
  const { dispatch, startGame, state } = useGameContext();
  const [selectedIndex, setSelectedIndex] = useState(1); // Default to Kids (Normal)
  const [fadeOut, setFadeOut] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const difficultyOptions: DifficultyOption[] = useMemo(() => [
    {
      id: 'baby',
      label: 'BABY',
      description: 'Recommended for young children. Extra lives and easier enemies.',
      value: 0,
    },
    {
      id: 'kids',
      label: 'KIDS',
      description: 'Recommended for most players. Standard difficulty.',
      value: 1,
    },
    {
      id: 'adults',
      label: 'ADULTS',
      description: 'Recommended for experienced players. Fewer lives and tougher enemies.',
      value: 2,
    },
  ], []);

  const handleSelect = useCallback((option: DifficultyOption): void => {
    // Set difficulty in config
    const difficultyMap: Record<number, 'easy' | 'normal' | 'hard'> = {
      0: 'easy',
      1: 'normal',
      2: 'hard',
    };
    
    dispatch({ 
      type: 'SET_CONFIG', 
      payload: { difficulty: difficultyMap[option.value] } 
    });
    
    // Trigger fade out animation
    setFadeOut(true);
    
    // Call the onSelect callback if provided
    if (onSelect) {
      onSelect(option.id);
    }
    
    // After fade out, start the game
    setTimeout(() => {
      startGame(state.currentLevel);
    }, 500);
  }, [dispatch, onSelect, startGame, state.currentLevel]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (fadeOut) return;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setSelectedIndex((prev) => (prev - 1 + difficultyOptions.length) % difficultyOptions.length);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          setSelectedIndex((prev) => (prev + 1) % difficultyOptions.length);
          break;
        case 'Enter':
        case ' ':
          handleSelect(difficultyOptions[selectedIndex]);
          break;
        case 'Escape':
          // Go back to main menu
          dispatch({ type: 'SET_GAME_STATE', payload: GameState.MAIN_MENU });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedIndex, fadeOut, handleSelect, difficultyOptions, dispatch]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      {/* Background Image */}
      <img
        src="/assets/sprites/title_background.png"
        alt=""
        onLoad={(): void => setImagesLoaded(true)}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
        }}
      />

      {/* Content overlay */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          opacity: imagesLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: '24px',
            color: '#ffcc00',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
            marginBottom: '30px',
            letterSpacing: '2px',
          }}
        >
          SELECT DIFFICULTY
        </div>

        {/* Difficulty Options */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {difficultyOptions.map((option, index) => (
            <DifficultyButton
              key={option.id}
              option={option}
              isSelected={index === selectedIndex}
              onClick={(): void => handleSelect(option)}
              onHover={(): void => setSelectedIndex(index)}
            />
          ))}
        </div>

        {/* Description of selected option */}
        <div
          style={{
            marginTop: '30px',
            padding: '10px 20px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '4px',
            maxWidth: '300px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: '#aaffaa',
              fontFamily: 'monospace',
              fontSize: '11px',
              margin: 0,
              lineHeight: '1.4',
            }}
          >
            {difficultyOptions[selectedIndex].description}
          </p>
        </div>

        {/* Navigation hint */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'monospace',
          }}
        >
          ↑↓ Navigate • Enter to Select • Esc to Go Back
        </div>
      </div>
    </div>
  );
}

interface DifficultyButtonProps {
  option: DifficultyOption;
  isSelected: boolean;
  onClick: () => void;
  onHover: () => void;
}

function DifficultyButton({ option, isSelected, onClick, onHover }: DifficultyButtonProps): React.JSX.Element {
  const [isPressed, setIsPressed] = useState(false);

  // Map difficulty to sprite
  const spriteMap: Record<Difficulty, string> = {
    baby: '/assets/sprites/ui_button_baby.png',
    kids: '/assets/sprites/ui_button_kids.png',
    adults: '/assets/sprites/ui_button_adults.png',
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseDown={(): void => setIsPressed(true)}
      onMouseUp={(): void => setIsPressed(false)}
      onMouseLeave={(): void => setIsPressed(false)}
      style={{
        padding: 0,
        background: 'none',
        border: isSelected ? '2px solid #ffcc00' : '2px solid transparent',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        transform: isPressed ? 'scale(0.95)' : isSelected ? 'scale(1.05)' : 'scale(1)',
        filter: isSelected ? 'brightness(1.2)' : 'brightness(0.85)',
      }}
    >
      <img
        src={spriteMap[option.id]}
        alt={option.label}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))',
        }}
        draggable={false}
      />
    </button>
  );
}

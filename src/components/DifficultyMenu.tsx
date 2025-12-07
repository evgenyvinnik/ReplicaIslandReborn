/**
 * Difficulty Menu Component
 * 
 * Matches the original Replica Island difficulty selection layout:
 * - Centered panel with semi-transparent dark background
 * - Three difficulty buttons (Baby, Kids, Adults) with descriptions below each
 * - Button flicker animation on selection
 * - Fade out animation when starting game
 * 
 * Ported from: DifficultyMenuActivity.java and difficulty_menu.xml
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState } from '../types';
import { assetPath } from '../utils/helpers';

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
  const [flickeringButton, setFlickeringButton] = useState<Difficulty | null>(null);
  const loadedCount = useRef(0);

  // Descriptions matching original strings.xml
  const difficultyOptions: DifficultyOption[] = useMemo(() => [
    {
      id: 'baby',
      label: 'BABY',
      description: 'No challenge at all.',
      value: 0,
    },
    {
      id: 'kids',
      label: 'KIDS',
      description: 'A comfortable ride to the end.',
      value: 1,
    },
    {
      id: 'adults',
      label: 'ADULTS',
      description: 'True accomplishment requires hardship.',
      value: 2,
    },
  ], []);

  const handleImageLoad = useCallback((): void => {
    loadedCount.current++;
    // 3 button images + 1 background
    if (loadedCount.current >= 4) {
      setImagesLoaded(true);
    }
  }, []);

  const handleSelect = useCallback((option: DifficultyOption): void => {
    if (fadeOut || flickeringButton) return;

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
    
    // Start button flicker animation
    setFlickeringButton(option.id);
    
    // Call the onSelect callback if provided
    if (onSelect) {
      onSelect(option.id);
    }
    
    // Trigger fade out after flicker animation
    setTimeout(() => {
      setFadeOut(true);
    }, 300);
    
    // After fade out, start the game
    // Use level 1 (intro cutscene) for new games - state.currentLevel should be 1
    // after startNewGame was called, but capture it here to be safe
    const levelToStart = state.currentLevel || 1;
    setTimeout(() => {
      startGame(levelToStart);
    }, 800);
  }, [dispatch, onSelect, startGame, state.currentLevel, fadeOut, flickeringButton]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (fadeOut || flickeringButton) return;
      
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
  }, [selectedIndex, fadeOut, flickeringButton, handleSelect, difficultyOptions, dispatch]);

  // Map difficulty to sprite
  const spriteMap: Record<Difficulty, string> = {
    baby: assetPath('/assets/sprites/ui_button_baby.png'),
    kids: assetPath('/assets/sprites/ui_button_kids.png'),
    adults: assetPath('/assets/sprites/ui_button_adults.png'),
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Image - matches original title_background */}
      <img
        src={assetPath('/assets/sprites/title_background.png')}
        alt=""
        onLoad={handleImageLoad}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
          opacity: fadeOut ? 0 : 1,
          transition: 'opacity 0.5s ease-out',
        }}
      />

      {/* Centered panel - matches original custom_toast_border style */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.6)', // #99000000 = 60% opacity black
          borderRadius: '10px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0',
          opacity: imagesLoaded && !fadeOut ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out',
        }}
      >
        {/* Difficulty Options - vertical stack matching original layout */}
        {difficultyOptions.map((option, index) => (
          <div 
            key={option.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: index > 0 ? '15px' : '0',
              opacity: fadeOut && flickeringButton !== option.id ? 0 : 1,
              transition: 'opacity 0.3s ease-out',
            }}
          >
            {/* Button image */}
            <button
              onClick={(): void => handleSelect(option)}
              onMouseEnter={(): void => setSelectedIndex(index)}
              style={{
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                animation: flickeringButton === option.id ? 'buttonFlicker 0.3s ease-in-out' : 'none',
                outline: selectedIndex === index ? '2px solid rgba(255, 204, 0, 0.5)' : 'none',
                outlineOffset: '2px',
                borderRadius: '4px',
              }}
            >
              <img
                src={spriteMap[option.id]}
                alt={option.label}
                onLoad={handleImageLoad}
                style={{
                  display: 'block',
                  imageRendering: 'pixelated',
                }}
                draggable={false}
              />
            </button>
            
            {/* Description text directly below button - matches original layout */}
            <span
              style={{
                color: '#FFFFFF',
                fontSize: '14px',
                fontFamily: 'sans-serif',
                textAlign: 'center',
                marginTop: '4px',
                opacity: fadeOut ? 0 : 1,
                transition: 'opacity 0.3s ease-out',
              }}
            >
              {option.description}
            </span>
          </div>
        ))}
      </div>

      {/* Navigation hint - for keyboard users */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.5)',
          fontFamily: 'monospace',
          opacity: imagesLoaded && !fadeOut ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out',
        }}
      >
        ↑↓ Navigate • Enter to Select • Esc to Go Back
      </div>

      {/* CSS keyframes for button flicker animation */}
      <style>
        {`
          @keyframes buttonFlicker {
            0%, 100% { opacity: 1; }
            20% { opacity: 0.3; }
            40% { opacity: 1; }
            60% { opacity: 0.3; }
            80% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}

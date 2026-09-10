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
import { useGameStore } from '../stores/useGameStore';
import { useMenuGamepad } from './useMenuGamepad';
import { isSurfaceActive } from '../engine/GameSurfaceActivity';
import { useMenuSelectionTransition } from './useMenuSelectionTransition';

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
  const { dispatch, confirmNewGame } = useGameContext();
  const [selectedIndex, setSelectedIndex] = useState(1); // Default to Kids (Normal)
  const [fadeOut, setFadeOut] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [flickeringButton, setFlickeringButton] = useState<Difficulty | null>(null);
  const loadedCount = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectionTransition = useMenuSelectionTransition();

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
    // Claim synchronously: two input sources can arrive before React rerenders.
    if (!selectionTransition.start(() => {
      useGameStore.getState().addToTotalStats({ gamesStarted: 1 });
      confirmNewGame();
    }, () => setFadeOut(true))) return;

    // Gameplay reads difficulty from the persisted store, not React config.
    useGameStore.getState().setSetting('difficulty', option.id);

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

  }, [dispatch, onSelect, confirmNewGame, fadeOut, flickeringButton, selectionTransition]);

  useMenuGamepad({ menuRef, viewKey: 'difficulty',
    onBack: (): void => {
      if (!fadeOut && !flickeringButton) dispatch({ type: 'SET_GAME_STATE', payload: GameState.MAIN_MENU });
    },
    onCommand: (command): boolean => {
      if (fadeOut || flickeringButton) return true;
      if (command === 'confirm') handleSelect(difficultyOptions[selectedIndex]);
      else if (command === 'up' || command === 'left') setSelectedIndex(index => (index + difficultyOptions.length - 1) % difficultyOptions.length);
      else if (command === 'down' || command === 'right') setSelectedIndex(index => (index + 1) % difficultyOptions.length);
      return true;
    },
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!isSurfaceActive(menuRef.current)) return;
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
      data-menu-layout="difficulty"
      ref={menuRef}
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
          // Original difficulty_menu.xml uses 10dp. The previous 40px and
          // shrink-to-fit width wrapped descriptions into the navigation hint.
          padding: '10px',
          width: '320px',
          maxWidth: 'calc(100% - 24px)',
          maxHeight: 'calc(100% - 40px)',
          overflowY: 'auto',
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
              flexShrink: 0,
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
        data-menu-hint
        style={{
          position: 'absolute',
          bottom: '6px',
          left: '8px',
          right: '8px',
          textAlign: 'center',
          fontSize: '10px',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: '3px',
          padding: '2px',
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

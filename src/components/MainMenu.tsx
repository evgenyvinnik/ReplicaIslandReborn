/**
 * Main Menu Component
 * 
 * Styled to match the original Replica Island main menu:
 * - Uses title_background.png as the background
 * - Uses title.png for the game logo
 * - Buttons styled to match the original Android UI
 */

import React, { useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { assetPath } from '../utils/helpers';

export function MainMenu(): React.JSX.Element {
  const { startNewGame, startGame, goToLevelSelect, goToOptions, state } = useGameContext();
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Determine if there's a saved game to continue
  const hasSavedProgress = state.saveData.completedLevels.length > 0 || state.currentLevel > 1;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Image */}
      <img
        src={assetPath('/assets/sprites/title_background.png')}
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
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px',
          opacity: imagesLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in',
        }}
      >
        {/* Title Logo */}
        <div style={{ marginTop: '20px' }}>
          <img
            src={assetPath('/assets/sprites/title.png')}
            alt="Replica Island"
            style={{
              maxWidth: '280px',
              imageRendering: 'pixelated',
              filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))',
            }}
          />
          <div
            style={{
              textAlign: 'center',
              color: '#FFFFFF',
              fontSize: '14px',
              fontFamily: 'sans-serif',
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
              marginTop: '4px',
              letterSpacing: '4px',
            }}
          >
            REBORN
          </div>
        </div>

        {/* Menu Buttons - Using original button sprites */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '30px',
            alignItems: 'center',
          }}
        >
          {/* Show Continue if there's saved progress, otherwise Start */}
          {hasSavedProgress ? (
            <ImageButton 
              src={assetPath('/assets/sprites/ui_button_continue.png')} 
              alt="Continue Game"
              onClick={(): void => startGame(state.currentLevel)} 
            />
          ) : (
            <ImageButton 
              src={assetPath('/assets/sprites/ui_button_start.png')} 
              alt="Start Game"
              onClick={startNewGame} 
            />
          )}
          <ImageButton 
            src={assetPath('/assets/sprites/ui_button_level_select.png')} 
            alt="Level Select"
            onClick={goToLevelSelect} 
          />
          <ImageButton 
            src={assetPath('/assets/sprites/ui_button_options.png')} 
            alt="Options"
            onClick={goToOptions} 
          />
        </div>

        {/* Footer */}
        <div
          style={{
            fontSize: '8px',
            color: 'rgba(255, 255, 255, 0.5)',
            textAlign: 'center',
            fontFamily: 'sans-serif',
          }}
        >
          <p>Original game by Chris Pruett & Genki Mine</p>
          <p>Web port - Apache 2.0 License</p>
        </div>
      </div>
    </div>
  );
}

interface ImageButtonProps {
  src: string;
  alt: string;
  onClick: () => void;
}

function ImageButton({ src, alt, onClick }: ImageButtonProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={(): void => setIsHovered(true)}
      onMouseLeave={(): void => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={(): void => setIsPressed(true)}
      onMouseUp={(): void => setIsPressed(false)}
      style={{
        padding: 0,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.1s ease',
        transform: isPressed ? 'scale(0.95)' : isHovered ? 'scale(1.05)' : 'scale(1)',
        filter: isHovered ? 'brightness(1.2)' : 'brightness(1)',
      }}
    >
      <img 
        src={src} 
        alt={alt}
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

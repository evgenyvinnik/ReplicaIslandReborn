/**
 * Pause Menu Component
 * Simple pause overlay matching the original Replica Island
 * Just shows the "PAUSED" image centered on screen
 * 
 * Original: res/layout/main.xml - ImageView with @drawable/ui_paused
 */

import React, { useEffect } from 'react';
import { useGameContext } from '../context/GameContext';
import { assetPath } from '../utils/helpers';

export function PauseMenu(): React.JSX.Element {
  const { resumeGame } = useGameContext();

  // Resume on any key press or tap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Resume on Escape, Enter, Space, or any other key
      e.preventDefault();
      resumeGame();
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => { window.removeEventListener('keydown', handleKeyDown); };
  }, [resumeGame]);

  const handleClick = (): void => {
    resumeGame();
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 1000,
      }}
    >
      <img
        src={assetPath('/assets/sprites/ui_paused.png')}
        alt="PAUSED"
        style={{
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

export default PauseMenu;

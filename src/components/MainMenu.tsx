/**
 * Main Menu Component
 */

import React from 'react';
import { useGameContext } from '../context/GameContext';

export function MainMenu(): React.JSX.Element {
  const { startGame, goToLevelSelect, state } = useGameContext();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        color: '#ffffff',
        fontFamily: 'monospace',
      }}
    >
      {/* Title */}
      <div
        style={{
          marginBottom: '48px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            marginBottom: '8px',
            color: '#4caf50',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
          }}
        >
          REPLICA ISLAND
        </h1>
        <h2
          style={{
            fontSize: '18px',
            color: '#aaa',
            fontWeight: 'normal',
          }}
        >
          REBORN
        </h2>
      </div>

      {/* Menu Buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <MenuButton onClick={(): void => startGame(state.currentLevel)}>
          Start Game
        </MenuButton>
        <MenuButton onClick={goToLevelSelect}>Level Select</MenuButton>
        <MenuButton onClick={(): void => { /* Options */ }}>Options</MenuButton>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          fontSize: '12px',
          color: '#666',
        }}
      >
        <p>Original game by Chris Pruett & Genki Mine</p>
        <p>Web port - Apache 2.0 License</p>
      </div>
    </div>
  );
}

interface MenuButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

function MenuButton({ children, onClick }: MenuButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 32px',
        fontSize: '16px',
        fontFamily: 'monospace',
        backgroundColor: 'transparent',
        border: '2px solid #4caf50',
        color: '#4caf50',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '200px',
      }}
      onMouseEnter={(e): void => {
        e.currentTarget.style.backgroundColor = '#4caf50';
        e.currentTarget.style.color = '#1a1a2e';
      }}
      onMouseLeave={(e): void => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = '#4caf50';
      }}
    >
      {children}
    </button>
  );
}

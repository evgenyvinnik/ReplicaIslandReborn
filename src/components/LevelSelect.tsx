/**
 * Level Select Component
 * Styled to fit within the phone frame at 480x320 resolution
 */

import React from 'react';
import { useGameContext } from '../context/GameContext';

export function LevelSelect(): React.JSX.Element {
  const { startGame, goToMainMenu, state } = useGameContext();

  // Demo levels
  const levels = [
    { id: 1, name: 'Tutorial 1', unlocked: true },
    { id: 2, name: 'Tutorial 2', unlocked: state.saveData.completedLevels.includes(1) },
    { id: 3, name: 'Tutorial 3', unlocked: state.saveData.completedLevels.includes(2) },
    { id: 4, name: 'Forest 1', unlocked: state.saveData.completedLevels.includes(3) },
    { id: 5, name: 'Forest 2', unlocked: state.saveData.completedLevels.includes(4) },
    { id: 6, name: 'Forest 3', unlocked: state.saveData.completedLevels.includes(5) },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #1a1a3e 0%, #0a0a1e 100%)',
        color: '#ffffff',
        fontFamily: 'monospace',
        padding: '12px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h1 style={{ fontSize: '14px', color: '#4caf50', letterSpacing: '2px' }}>SELECT LEVEL</h1>
        <button
          onClick={goToMainMenu}
          style={{
            padding: '4px 12px',
            fontSize: '10px',
            fontFamily: 'monospace',
            backgroundColor: 'rgba(0,0,0,0.3)',
            border: '1px solid #666',
            borderRadius: '4px',
            color: '#888',
            cursor: 'pointer',
          }}
        >
          BACK
        </button>
      </div>

      {/* Level Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {levels.map((level) => (
          <LevelCard
            key={level.id}
            level={level}
            completed={state.saveData.completedLevels.includes(level.id)}
            onClick={(): void => {
              if (level.unlocked) {
                startGame(level.id);
              }
            }}
          />
        ))}
      </div>

      {/* Stats */}
      <div
        style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          fontSize: '9px',
          color: '#666',
        }}
      >
        <span>Completed: {state.saveData.completedLevels.length}/{levels.length}</span>
        <span>Pearls: {state.saveData.totalPearls}</span>
        <span>Deaths: {state.saveData.totalDeaths}</span>
      </div>
    </div>
  );
}

interface LevelCardProps {
  level: { id: number; name: string; unlocked: boolean };
  completed: boolean;
  onClick: () => void;
}

function LevelCard({ level, completed, onClick }: LevelCardProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={!level.unlocked}
      style={{
        padding: '8px',
        backgroundColor: level.unlocked ? 'rgba(42, 42, 78, 0.8)' : 'rgba(26, 26, 46, 0.5)',
        border: completed
          ? '2px solid #4caf50'
          : level.unlocked
            ? '1px solid #444'
            : '1px solid #333',
        borderRadius: '4px',
        color: level.unlocked ? '#fff' : '#555',
        cursor: level.unlocked ? 'pointer' : 'not-allowed',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontSize: '8px', color: '#888', marginBottom: '2px' }}>
        {level.id}
      </div>
      <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{level.name}</div>
      {completed && (
        <div style={{ fontSize: '8px', color: '#4caf50', marginTop: '4px' }}>
          ✓
        </div>
      )}
      {!level.unlocked && (
        <div style={{ fontSize: '8px', color: '#666', marginTop: '4px' }}>
          🔒
        </div>
      )}
    </button>
  );
}

/**
 * Level Select Component
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
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a2e',
        color: '#ffffff',
        fontFamily: 'monospace',
        padding: '32px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}
      >
        <h1 style={{ fontSize: '24px', color: '#4caf50' }}>Select Level</h1>
        <button
          onClick={goToMainMenu}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontFamily: 'monospace',
            backgroundColor: 'transparent',
            border: '1px solid #666',
            color: '#666',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>

      {/* Level Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '16px',
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
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid #333',
          display: 'flex',
          gap: '32px',
          fontSize: '14px',
          color: '#888',
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
        padding: '16px',
        backgroundColor: level.unlocked ? '#2a2a4e' : '#1a1a2e',
        border: completed
          ? '2px solid #4caf50'
          : level.unlocked
            ? '2px solid #444'
            : '2px solid #333',
        borderRadius: '8px',
        color: level.unlocked ? '#fff' : '#555',
        cursor: level.unlocked ? 'pointer' : 'not-allowed',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
        Level {level.id}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{level.name}</div>
      {completed && (
        <div style={{ fontSize: '12px', color: '#4caf50', marginTop: '8px' }}>
          ✓ Completed
        </div>
      )}
      {!level.unlocked && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          🔒 Locked
        </div>
      )}
    </button>
  );
}

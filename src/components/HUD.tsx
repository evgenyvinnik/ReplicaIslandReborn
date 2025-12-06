/**
 * HUD Component - Heads-up display overlay
 */

import React from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState } from '../types';

interface HUDProps {
  fps?: number;
  showFPS?: boolean;
}

export function HUD({ fps = 0, showFPS = false }: HUDProps): React.JSX.Element {
  const { state } = useGameContext();

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        fontFamily: 'monospace',
        color: '#ffffff',
      }}
    >
      {/* FPS Counter */}
      {showFPS && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
        >
          FPS: {fps}
        </div>
      )}

      {/* Lives/Health */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          display: 'flex',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '14px' }}>
          ❤️ {state.saveData.currentLevel}
        </span>
        <span style={{ fontSize: '14px' }}>
          💎 {state.saveData.totalPearls}
        </span>
      </div>

      {/* Pause Overlay */}
      {state.gameState === GameState.PAUSED && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>PAUSED</h2>
          <p style={{ fontSize: '14px', color: '#aaa' }}>
            Press ESC or P to resume
          </p>
        </div>
      )}

      {/* Game Over Overlay */}
      {state.gameState === GameState.GAME_OVER && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          <h2 style={{ fontSize: '24px', color: '#ff4444', marginBottom: '16px' }}>
            GAME OVER
          </h2>
          <p style={{ fontSize: '14px', color: '#aaa' }}>
            Deaths: {state.saveData.totalDeaths}
          </p>
        </div>
      )}

      {/* Level Complete Overlay */}
      {state.gameState === GameState.LEVEL_COMPLETE && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          <h2 style={{ fontSize: '24px', color: '#44ff44', marginBottom: '16px' }}>
            LEVEL COMPLETE!
          </h2>
        </div>
      )}
    </div>
  );
}

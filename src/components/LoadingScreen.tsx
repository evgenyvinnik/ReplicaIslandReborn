/**
 * Loading Screen Component
 * Styled to match the original Replica Island loading experience
 */

import React from 'react';

interface LoadingScreenProps {
  progress: number;
  message?: string;
}

export function LoadingScreen({
  progress,
  message = 'Loading...',
}: LoadingScreenProps): React.JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(180deg, #000033 0%, #000011 100%)',
        color: '#ffffff',
        fontFamily: 'monospace',
      }}
    >
      {/* Android robot character */}
      <div
        style={{
          marginBottom: '24px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      >
        <img
          src="/assets/sprites/andou_stand01.png"
          alt="Android"
          style={{
            width: '64px',
            height: '64px',
            imageRendering: 'pixelated',
          }}
          onError={(e): void => {
            // Fallback if image not found
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: '16px',
          marginBottom: '24px',
          color: '#4caf50',
          letterSpacing: '4px',
          textShadow: '0 0 10px rgba(76, 175, 80, 0.5)',
        }}
      >
        REPLICA ISLAND
      </h1>

      {/* Progress bar */}
      <div
        style={{
          width: '180px',
          height: '6px',
          backgroundColor: '#222',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '12px',
          border: '1px solid #333',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #2e7d32 0%, #4caf50 50%, #66bb6a 100%)',
            transition: 'width 0.3s ease',
            boxShadow: '0 0 8px rgba(76, 175, 80, 0.5)',
          }}
        />
      </div>

      {/* Loading message */}
      <p style={{ fontSize: '10px', color: '#666' }}>{message}</p>

      {/* Progress percentage */}
      <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
        {Math.round(progress)}%
      </p>
    </div>
  );
}

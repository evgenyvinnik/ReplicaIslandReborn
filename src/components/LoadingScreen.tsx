/**
 * Loading Screen Component
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
        backgroundColor: '#1a1a2e',
        color: '#ffffff',
        fontFamily: 'monospace',
      }}
    >
      {/* Logo placeholder */}
      <div
        style={{
          width: '64px',
          height: '64px',
          marginBottom: '32px',
          backgroundColor: '#4caf50',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '32px',
        }}
      >
        🤖
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: '24px',
          marginBottom: '32px',
          color: '#4caf50',
        }}
      >
        REPLICA ISLAND
      </h1>

      {/* Progress bar */}
      <div
        style={{
          width: '200px',
          height: '8px',
          backgroundColor: '#333',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#4caf50',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Loading message */}
      <p style={{ fontSize: '14px', color: '#888' }}>{message}</p>

      {/* Progress percentage */}
      <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
        {Math.round(progress)}%
      </p>
    </div>
  );
}

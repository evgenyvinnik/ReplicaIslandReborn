/**
 * Android Recents Screen Component
 * Simulates the Android Overview/Recents screen
 */

import React from 'react';

interface AndroidRecentsScreenProps {
  onResume: () => void;
  screenshot?: string; // Optional screenshot of the game state
  isOverlay?: boolean;
}

export function AndroidRecentsScreen({ onResume }: AndroidRecentsScreenProps): React.JSX.Element {
  return (
    <div
      onClick={onResume}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        cursor: 'pointer',
        zIndex: 100,
      }}
    >
      {/* Recents Card */}
      <div
        onClick={onResume}
        style={{
          width: '70%',
          height: '60%',
          backgroundColor: '#333',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
          cursor: 'pointer',
          transform: 'scale(0.9)',
          transition: 'transform 0.2s',
          position: 'relative',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(0.9)')}
      >
        {/* App Title Bar */}
        <div
          style={{
            backgroundColor: '#444',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <img
            src="/assets/sprites/icon.png"
            alt=""
            style={{ width: '16px', height: '16px' }}
          />
          <span
            style={{
              color: '#fff',
              fontSize: '12px',
              fontFamily: 'sans-serif',
            }}
          >
            Replica Island
          </span>
        </div>

        {/* App Preview (Placeholder) */}
        <div
          style={{
            flex: 1,
            backgroundImage: 'url(/assets/sprites/title_background.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Overlay to make it look "inactive" */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          />
          {/* Replica Island Logo */}
          <img
            src="/assets/sprites/title.png"
            alt="Replica Island"
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: '80%',
              maxHeight: '60%',
              objectFit: 'contain',
            }}
          />
        </div>
      </div>
      
      <div style={{ marginTop: '20px', color: '#aaa', fontSize: '14px', fontFamily: 'sans-serif' }}>
        Tap to resume
      </div>
    </div>
  );
}

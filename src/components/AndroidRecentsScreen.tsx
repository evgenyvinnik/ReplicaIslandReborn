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
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
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
        </div>
      </div>
      
      <div style={{ marginTop: '20px', color: '#aaa', fontSize: '14px', fontFamily: 'sans-serif' }}>
        Tap to resume
      </div>
    </div>
  );
}

/**
 * Android Recents Screen Component
 * Simulates the Android Overview/Recents screen
 */

import React from 'react';

interface AndroidRecentsScreenProps {
  onResume: () => void;
  screenshot?: string; // Optional screenshot of the game state
  isOverlay?: boolean; // If true, renders as an overlay matching the shrunk app position
}

export function AndroidRecentsScreen({ onResume, screenshot, isOverlay = false }: AndroidRecentsScreenProps): React.JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: isOverlay ? 'transparent' : 'rgba(0, 0, 0, 0.8)',
        position: 'absolute',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10, // Ensure it's above the app
        pointerEvents: isOverlay ? 'none' : 'auto', 
      }}
    >
      {/* Recents Card */}
      <div
        onClick={onResume}
        style={{
          width: '100%', // Match the app container width (which is 100% of parent)
          height: '100%', // Match the app container height
          // We need to match the scale(0.7) of the app container
          transform: 'scale(0.7)',
          backgroundColor: isOverlay ? 'transparent' : '#333',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isOverlay ? 'none' : '0 10px 20px rgba(0,0,0,0.5)',
          cursor: 'pointer',
          position: 'relative',
          pointerEvents: 'auto', // Re-enable pointer events for the card
          border: isOverlay ? '2px solid #444' : 'none', // Add border in overlay mode
        }}
      >
        {/* App Title Bar */}
        <div
          style={{
            height: '30px',
            backgroundColor: '#222',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            borderBottom: '1px solid #444',
            zIndex: 2,
          }}
        >
          <img 
            src="/assets/sprites/ui_icon.png" 
            alt="Icon" 
            style={{ width: '16px', height: '16px', marginRight: '8px' }}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <span style={{ color: '#fff', fontSize: '12px', flex: 1 }}>Replica Island</span>
          <span style={{ color: '#aaa', fontSize: '16px' }}>×</span>
        </div>

        {/* App Preview / Screenshot / Transparent Area */}
        <div
          style={{
            flex: 1,
            backgroundColor: isOverlay ? 'transparent' : '#000',
            backgroundImage: !isOverlay && screenshot ? `url(${screenshot})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!isOverlay && !screenshot && (
            <div style={{ color: '#666', fontSize: '14px' }}>
              Game Paused
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

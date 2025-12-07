/**
 * Android Home Screen Component
 * Simulates an early Android 1.0/1.5 (Cupcake) home screen
 * Very simple - just wallpaper, status bar, and app icons
 */

import React, { useState, useEffect } from 'react';
import { assetPath } from '../utils/helpers';

interface AndroidHomeScreenProps {
  onLaunch: () => void;
}

export function AndroidHomeScreen({ onLaunch }: AndroidHomeScreenProps): React.JSX.Element {
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateTime = (): void => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      setTimeString(`${displayHours}:${minutes} ${ampm}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return (): void => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        // Early Android had simple gradient wallpapers
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Status Bar - Android 1.x style: black with white text */}
      <div
        style={{
          width: '100%',
          height: '20px',
          backgroundColor: '#000',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 6px',
          boxSizing: 'border-box',
        }}
      >
        {/* Signal bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', marginRight: '6px' }}>
          {[4, 6, 8, 10].map((h, i) => (
            <div key={i} style={{ width: '3px', height: `${h}px`, backgroundColor: '#8f8' }} />
          ))}
        </div>
        {/* Battery icon - simple rectangle */}
        <div style={{ display: 'flex', alignItems: 'center', marginRight: '6px' }}>
          <div style={{ 
            width: '18px', height: '9px', 
            border: '1px solid #fff', 
            borderRadius: '1px',
            position: 'relative',
          }}>
            <div style={{ 
              width: '80%', height: '100%', 
              backgroundColor: '#8f8',
            }} />
          </div>
          <div style={{ width: '2px', height: '5px', backgroundColor: '#fff', marginLeft: '1px' }} />
        </div>
        {/* Time */}
        <span style={{ color: '#fff', fontSize: '11px' }}>{timeString}</span>
      </div>

      {/* App Grid Area - centered icons */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          padding: '40px 20px',
        }}
      >
        {/* Single app icon - Replica Island */}
        <button
          onClick={onLaunch}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          {/* Icon from original game */}
          <div
            style={{
              width: '48px',
              height: '48px',
              marginBottom: '4px',
            }}
          >
            <img
              src={assetPath('/assets/sprites/icon.png')}
              alt="Replica Island"
              style={{
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
              }}
            />
          </div>
          {/* App label - Android 1.x style */}
          <span
            style={{
              color: '#fff',
              fontSize: '11px',
              textAlign: 'center',
              textShadow: '1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000',
              fontWeight: 'bold',
            }}
          >
            Replica Island
          </span>
        </button>
      </div>

      {/* Bottom dock/tray handle - Android 1.x had the app drawer handle */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* App drawer tab (non-functional, just decorative) */}
        <div
          style={{
            width: '60px',
            height: '24px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Grid icon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
            {[...Array(9)].map((_, i) => (
              <div key={i} style={{ width: '4px', height: '4px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '1px' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

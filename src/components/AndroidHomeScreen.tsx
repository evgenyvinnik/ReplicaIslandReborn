/**
 * Android Home Screen Component
 * Simulates an early Android (1.x/2.x) home screen
 */

import React, { useState, useEffect } from 'react';

interface AndroidHomeScreenProps {
  onLaunch: () => void;
}

export function AndroidHomeScreen({ onLaunch }: AndroidHomeScreenProps): React.JSX.Element {
  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setDateString(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#222',
        backgroundImage: 'linear-gradient(to bottom, #333, #000)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        fontFamily: 'Roboto, sans-serif',
      }}
    >
      {/* Status Bar */}
      <div
        style={{
          width: '100%',
          height: '24px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 8px',
          color: '#fff',
          fontSize: '12px',
        }}
      >
        <span>{timeString}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>

      {/* Clock Widget */}
      <div
        style={{
          marginTop: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: '#fff',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: '48px', fontWeight: '300', lineHeight: 1 }}>{timeString}</div>
        <div style={{ fontSize: '14px', opacity: 0.8 }}>{dateString}</div>
      </div>

      {/* App Grid */}
      <div
        style={{
          marginTop: '40px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          width: '100%',
          padding: '0 20px',
        }}
      >
        {/* Replica Island Icon */}
        <button
          onClick={onLaunch}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              marginBottom: '4px',
              position: 'relative',
            }}
          >
            <img
              src="/assets/icon.png"
              alt="Replica Island"
              style={{
                width: '100%',
                height: '100%',
                filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.5))',
              }}
            />
          </div>
          <span
            style={{
              color: '#fff',
              fontSize: '12px',
              textAlign: 'center',
              textShadow: '1px 1px 2px #000',
            }}
          >
            Replica Island
          </span>
        </button>
      </div>

      {/* Bottom Dock */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '60px',
          backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0 20px',
        }}
      >
        <div style={{ fontSize: '24px', cursor: 'pointer' }}>📞</div>
        <div
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '50%',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '2px',
            padding: '8px',
            cursor: 'pointer',
          }}
        >
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ backgroundColor: '#fff', borderRadius: '1px' }}></div>
          ))}
        </div>
        <div style={{ fontSize: '24px', cursor: 'pointer' }}>🌐</div>
      </div>
    </div>
  );
}

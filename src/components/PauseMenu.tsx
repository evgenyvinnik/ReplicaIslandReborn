/**
 * Pause Menu Component
 * In-game pause overlay with options to resume, restart, or quit
 * Styled to match the original Replica Island aesthetic
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { gameSettings } from '../utils/GameSettings';

interface PauseMenuProps {
  onResume?: () => void;
  onRestart?: () => void;
  onMainMenu?: () => void;
}

export function PauseMenu({
  onResume,
  onRestart,
  onMainMenu,
}: PauseMenuProps): React.JSX.Element {
  const { resumeGame, goToMainMenu, startGame, state } = useGameContext();
  const [selectedOption, setSelectedOption] = useState(0);
  const [isFlickering, setIsFlickering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Get current settings
  const [settings, setSettings] = useState(gameSettings.getAll());
  
  // Settings submenu
  const settingsOptions = useMemo(() => [
    { label: 'Sound', key: 'soundEnabled' as const, type: 'toggle' },
    { label: 'Sound Volume', key: 'soundVolume' as const, type: 'slider' },
    { label: 'Music', key: 'musicEnabled' as const, type: 'toggle' },
    { label: 'Music Volume', key: 'musicVolume' as const, type: 'slider' },
  ], []);
  const [settingsSelectedOption, setSettingsSelectedOption] = useState(0);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = gameSettings.subscribe(setSettings);
    return unsubscribe;
  }, []);

  const options = useMemo(() => [
    { label: 'Resume', action: 'resume' },
    { label: 'Restart Level', action: 'restart' },
    { label: 'Settings', action: 'settings' },
    { label: 'Main Menu', action: 'menu' },
  ], []);

  const handleSelect = useCallback(() => {
    const option = options[selectedOption];
    
    if (option.action === 'settings') {
      setShowSettings(!showSettings);
      return;
    }
    setIsFlickering(true);

    setTimeout(() => {
      switch (option.action) {
        case 'resume':
          if (onResume) {
            onResume();
          } else {
            resumeGame();
          }
          break;
        case 'restart':
          if (onRestart) {
            onRestart();
          } else {
            startGame(state.currentLevel);
          }
          break;
        case 'menu':
          if (onMainMenu) {
            onMainMenu();
          } else {
            goToMainMenu();
          }
          break;
      }
      setIsFlickering(false);
    }, 300);
  }, [
    selectedOption,
    options,
    showSettings,
    onResume,
    onRestart,
    onMainMenu,
    resumeGame,
    startGame,
    goToMainMenu,
    state.currentLevel,
  ]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // If in settings submenu, handle differently
      if (showSettings) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          setShowSettings(false);
          return;
        }
        // Handle volume adjustments
        const setting = settingsOptions[settingsSelectedOption];
        if (setting) {
          if (e.key === 'ArrowLeft') {
            if (setting.key === 'soundVolume' || setting.key === 'musicVolume') {
              const current = settings[setting.key] as number;
              gameSettings.set(setting.key, Math.max(0, current - 10));
            }
          } else if (e.key === 'ArrowRight') {
            if (setting.key === 'soundVolume' || setting.key === 'musicVolume') {
              const current = settings[setting.key] as number;
              gameSettings.set(setting.key, Math.min(100, current + 10));
            }
          } else if (e.key === 'Enter' || e.key === ' ') {
            if (setting.key === 'soundEnabled' || setting.key === 'musicEnabled') {
              gameSettings.set(setting.key, !settings[setting.key]);
            }
          }
        }
        if (e.key === 'ArrowUp') {
          setSettingsSelectedOption((prev) => (prev - 1 + settingsOptions.length) % settingsOptions.length);
        } else if (e.key === 'ArrowDown') {
          setSettingsSelectedOption((prev) => (prev + 1) % settingsOptions.length);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setSelectedOption((prev) => (prev - 1 + options.length) % options.length);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          setSelectedOption((prev) => (prev + 1) % options.length);
          break;
        case 'Enter':
        case ' ':
          handleSelect();
          break;
        case 'Escape':
          // Resume on Escape
          if (onResume) {
            onResume();
          } else {
            resumeGame();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => { window.removeEventListener('keydown', handleKeyDown); };
  }, [handleSelect, options.length, showSettings, resumeGame, onResume, settings, settingsOptions, settingsSelectedOption]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.80)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        color: '#ffffff',
        zIndex: 100,
      }}
    >
      {/* Pause Title */}
      <h1
        style={{
          fontSize: '28px',
          marginBottom: '24px',
          textShadow: '2px 2px 0 #333, 4px 4px 0 #111',
          color: '#ffcc00',
        }}
      >
        PAUSED
      </h1>

      {/* Main Menu or Settings */}
      {!showSettings ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {options.map((option, index) => (
            <button
              key={option.action}
              onClick={() => {
                setSelectedOption(index);
                handleSelect();
              }}
              style={{
                backgroundColor: selectedOption === index ? '#333' : 'transparent',
                border: selectedOption === index ? '2px solid #ffcc00' : '2px solid #666',
                borderRadius: '4px',
                padding: '10px 40px',
                color: selectedOption === index ? '#ffcc00' : '#999',
                fontSize: '12px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                opacity: isFlickering && selectedOption === index ? 0.5 : 1,
                animation:
                  isFlickering && selectedOption === index
                    ? 'flicker 0.1s linear infinite'
                    : 'none',
                minWidth: '200px',
                textAlign: 'left',
              }}
            >
              {selectedOption === index ? '▶ ' : '  '}
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '250px' }}>
          <div
            style={{
              fontSize: '12px',
              color: '#888',
              marginBottom: '10px',
              textAlign: 'center',
            }}
          >
            ← Back (Esc)
          </div>
          {settingsOptions.map((option, index) => (
            <div
              key={option.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: settingsSelectedOption === index ? '#333' : 'transparent',
                border: settingsSelectedOption === index ? '2px solid #ffcc00' : '2px solid #444',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
              onClick={() => setSettingsSelectedOption(index)}
            >
              <span
                style={{
                  color: settingsSelectedOption === index ? '#ffcc00' : '#999',
                  fontSize: '10px',
                }}
              >
                {option.label}
              </span>
              {option.type === 'toggle' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    gameSettings.set(option.key, !settings[option.key]);
                  }}
                  style={{
                    backgroundColor: settings[option.key] ? '#44aa44' : '#aa4444',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    color: '#fff',
                    fontSize: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {settings[option.key] ? 'ON' : 'OFF'}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const current = settings[option.key] as number;
                      gameSettings.set(option.key, Math.max(0, current - 10));
                    }}
                    style={{
                      backgroundColor: '#444',
                      border: 'none',
                      borderRadius: '2px',
                      padding: '2px 8px',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    ◀
                  </button>
                  <span style={{ fontSize: '10px', minWidth: '30px', textAlign: 'center' }}>
                    {settings[option.key] as number}%
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const current = settings[option.key] as number;
                      gameSettings.set(option.key, Math.min(100, current + 10));
                    }}
                    style={{
                      backgroundColor: '#444',
                      border: 'none',
                      borderRadius: '2px',
                      padding: '2px 8px',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          fontSize: '8px',
          color: '#555',
        }}
      >
        {showSettings
          ? '←→ adjust, ENTER toggle, ESC back'
          : 'Use ↑↓ to select, ENTER to confirm, ESC to resume'}
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
}

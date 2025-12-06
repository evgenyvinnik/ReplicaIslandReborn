/**
 * SoundControls Component - Sound toggle controls near the phone frame
 * 
 * Provides quick access buttons to toggle sound effects and music on/off.
 * Positioned near the upper-left corner of the phone frame.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { gameSettings, type GameSettings } from '../utils/GameSettings';

interface SoundControlsProps {
  className?: string;
}

export function SoundControls({ className = '' }: SoundControlsProps): React.JSX.Element {
  const [settings, setSettings] = useState<GameSettings>(() => gameSettings.getAll());

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = gameSettings.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    return unsubscribe;
  }, []);

  // Toggle all sounds (SFX + Music)
  const toggleAllSounds = useCallback(() => {
    const newEnabled = !settings.soundEnabled || !settings.musicEnabled;
    gameSettings.update({
      soundEnabled: newEnabled,
      musicEnabled: newEnabled,
    });
  }, [settings.soundEnabled, settings.musicEnabled]);

  // Toggle sound effects only
  const toggleSfx = useCallback(() => {
    gameSettings.set('soundEnabled', !settings.soundEnabled);
  }, [settings.soundEnabled]);

  // Toggle music only
  const toggleMusic = useCallback(() => {
    gameSettings.set('musicEnabled', !settings.musicEnabled);
  }, [settings.musicEnabled]);

  const allSoundsMuted = !settings.soundEnabled && !settings.musicEnabled;
  const sfxEnabled = settings.soundEnabled;
  const musicEnabled = settings.musicEnabled;

  return (
    <div className={`sound-controls ${className}`}>
      {/* Master sound toggle */}
      <button
        className={`sound-control-btn sound-master ${allSoundsMuted ? 'muted' : ''}`}
        onClick={toggleAllSounds}
        title={allSoundsMuted ? 'Unmute All' : 'Mute All'}
        aria-label={allSoundsMuted ? 'Unmute all sounds' : 'Mute all sounds'}
      >
        {allSoundsMuted ? (
          // Muted icon
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        ) : (
          // Sound on icon
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        )}
      </button>

      {/* SFX toggle */}
      <button
        className={`sound-control-btn sound-sfx ${!sfxEnabled ? 'muted' : ''}`}
        onClick={toggleSfx}
        title={sfxEnabled ? 'Mute SFX' : 'Unmute SFX'}
        aria-label={sfxEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
      >
        <span className="sound-label">SFX</span>
        {!sfxEnabled && <span className="mute-slash">/</span>}
      </button>

      {/* Music toggle */}
      <button
        className={`sound-control-btn sound-music ${!musicEnabled ? 'muted' : ''}`}
        onClick={toggleMusic}
        title={musicEnabled ? 'Mute Music' : 'Unmute Music'}
        aria-label={musicEnabled ? 'Mute music' : 'Unmute music'}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        {!musicEnabled && <span className="mute-slash">/</span>}
      </button>
    </div>
  );
}

export default SoundControls;

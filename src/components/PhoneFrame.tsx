/**
 * PhoneFrame Component - Wraps the game in an Android phone-style bezel
 * 
 * This creates the aesthetic of playing on a horizontal Android phone
 * reminiscent of the original Replica Island experience.
 */

import React from 'react';
import { SoundControls } from './SoundControls';

interface PhoneFrameProps {
  children: React.ReactNode;
  gameWidth: number;
  gameHeight: number;
}

export function PhoneFrame({ children, gameWidth, gameHeight }: PhoneFrameProps): React.JSX.Element {
  return (
    <div className="phone-frame-container">
      <div className="phone-frame-outer-wrapper">
        {/* Row with phone frame and sound controls */}
        <div className="phone-frame-row">
          <div className="phone-frame">
            {/* Left bezel with speaker grille */}
            <div className="phone-bezel phone-bezel-left">
              <div className="speaker-grille">
                <div className="speaker-hole"></div>
                <div className="speaker-hole"></div>
                <div className="speaker-hole"></div>
                <div className="speaker-hole"></div>
                <div className="speaker-hole"></div>
              </div>
            </div>
            
            {/* Screen area */}
            <div className="phone-screen" style={{ width: gameWidth, height: gameHeight }}>
              {children}
            </div>
            
            {/* Right bezel with Android navigation buttons */}
            <div className="phone-bezel phone-bezel-right">
              <div className="android-nav-buttons">
                <div className="nav-button nav-button-back">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#555" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                </div>
                <div className="nav-button nav-button-home">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <circle fill="#555" cx="12" cy="12" r="8"/>
                  </svg>
                </div>
                <div className="nav-button nav-button-recent">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <rect fill="#555" x="4" y="4" width="16" height="16" rx="2"/>
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Volume buttons on side */}
            <div className="volume-buttons">
              <div className="volume-button volume-up"></div>
              <div className="volume-button volume-down"></div>
            </div>
            
            {/* Power button on side */}
            <div className="power-button"></div>
          </div>
          
          {/* Sound controls - positioned to the right of the phone frame */}
          <SoundControls className="phone-sound-controls" />
        </div>
        
        {/* Keyboard hint below phone frame */}
        <div className="keyboard-hint-below">
          WASD/Arrows to move | Space to fly | X to stomp
        </div>
      </div>
    </div>
  );
}

export default PhoneFrame;

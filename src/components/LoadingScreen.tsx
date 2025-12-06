/**
 * Loading Screen Component
 * Matches the original Replica Island's minimal "PLEASE WAIT" overlay
 * Original: Small text in bottom-left corner with pulsing fade animation
 */

import React from 'react';

interface LoadingScreenProps {
  /** Whether to show the loading overlay (ignored - always shows when rendered) */
  progress?: number;
  /** Custom message (defaults to "PLEASE WAIT" like original) */
  message?: string;
  /** Whether this is an overlay on game canvas (true) or full screen (false) */
  overlay?: boolean;
}

export function LoadingScreen({
  message = 'PLEASE WAIT',
  overlay = false,
}: LoadingScreenProps): React.JSX.Element {
  return (
    <div
      style={{
        position: overlay ? 'absolute' : 'relative',
        width: '100%',
        height: '100%',
        // Transparent background for overlay mode, black for full screen
        backgroundColor: overlay ? 'transparent' : '#000000',
        pointerEvents: overlay ? 'none' : 'auto',
      }}
    >
      {/* Bottom-left "PLEASE WAIT" message - matches original layout */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          padding: '5px 10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid #333',
          borderRadius: '3px',
          // Pulsing animation matching original wait_message_fade.xml
          // Original: fromAlpha=1.0, toAlpha=0.0, duration=1000ms, repeatMode=reverse
          animation: 'pleaseWaitPulse 1s ease-in-out infinite alternate',
        }}
      >
        <span
          style={{
            // Original: textColor="#65ff99", textSize="20sp", textStyle="bold"
            // Android default typeface is sans-serif (Roboto on modern Android)
            color: '#65ff99',
            fontSize: '20px',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
          }}
        >
          {message}
        </span>
      </div>

      {/* CSS keyframes for the pulsing animation */}
      <style>
        {`
          @keyframes pleaseWaitPulse {
            0% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
        `}
      </style>
    </div>
  );
}

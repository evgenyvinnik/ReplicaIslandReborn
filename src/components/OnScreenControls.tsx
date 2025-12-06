/**
 * OnScreenControls Component - Twin-stick style controls from the original game
 * 
 * Replicates the original Replica Island control scheme from HudSystem.java:
 * - Left side: Movement slider at (20, 32) from bottom-left
 * - Right side: Fly button at (gameWidth - 128 + 12, 5) and Stomp button
 * 
 * Original constants from HudSystem.java:
 * - MOVEMENT_SLIDER_BASE_X = 20.0f
 * - MOVEMENT_SLIDER_BASE_Y = 32.0f (from bottom)
 * - MOVEMENT_SLIDER_BUTTON_X = MOVEMENT_SLIDER_BASE_X + 32.0f = 52
 * - FLY_BUTTON_X = -12.0f (when slider mode: gameWidth - 128 - FLY_BUTTON_X)
 * - FLY_BUTTON_Y = -5.0f (from bottom)
 * - STOMP_BUTTON_X = 85.0f (when slider mode: gameWidth - 83.2 - STOMP_BUTTON_X)
 * - STOMP_BUTTON_SCALE = 0.65f
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';

interface OnScreenControlsProps {
  onMovementChange: (direction: number) => void; // -1 to 1, 0 is center
  onFlyPressed: () => void;
  onFlyReleased: () => void;
  onStompPressed: () => void;
  onStompReleased: () => void;
  // Keyboard/gamepad state for syncing visual feedback
  keyboardFlyActive?: boolean;
  keyboardStompActive?: boolean;
  keyboardLeftActive?: boolean;
  keyboardRightActive?: boolean;
}

// Original game layout constants (from HudSystem.java)
// Slider mode positions - slider on left, buttons on right
const MOVEMENT_SLIDER_BASE_X = 20;  // From left edge
const MOVEMENT_SLIDER_BASE_Y = 32;  // From bottom edge
const MOVEMENT_SLIDER_WIDTH = 128;
const SLIDER_BUTTON_WIDTH = 64;     // Slider button sprite is 64x64

// Actual sprite sizes (checked via file command):
// - ui_button_fly_*.png: 128x128
// - ui_button_stomp_*.png: 128x128
// - ui_movement_slider_base.png: 128x32
// - ui_movement_slider_button_*.png: 64x64

// Display sizes for 480x320 game screen
// Original uses FLY_BUTTON_WIDTH = 128, STOMP_BUTTON_SCALE = 0.65
// But for web, scale down to fit better
const FLY_BUTTON_DISPLAY_SIZE = 64;   // 128 / 2 for better fit
const STOMP_BUTTON_DISPLAY_SIZE = 48; // Scaled down further

export function OnScreenControls({
  onMovementChange,
  onFlyPressed,
  onFlyReleased,
  onStompPressed,
  onStompReleased,
  keyboardFlyActive = false,
  keyboardStompActive = false,
  keyboardLeftActive = false,
  keyboardRightActive = false,
}: OnScreenControlsProps): React.JSX.Element {
  const [sliderPosition, setSliderPosition] = useState(0.5); // 0-1, 0.5 is center
  const [touchFlyPressed, setTouchFlyPressed] = useState(false);
  const [touchStompPressed, setTouchStompPressed] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Combined button states (touch OR keyboard)
  const flyPressed = touchFlyPressed || keyboardFlyActive;
  const stompPressed = touchStompPressed || keyboardStompActive;

  // Calculate slider position based on keyboard input when not dragging
  const effectiveSliderPosition = isDraggingRef.current 
    ? sliderPosition 
    : keyboardLeftActive 
      ? 0.1  // Show button on left when left key pressed
      : keyboardRightActive 
        ? 0.9  // Show button on right when right key pressed
        : 0.5; // Center when no input

  // Handle slider drag
  const updateSliderPosition = useCallback((clientX: number): void => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(1, x / rect.width));
    setSliderPosition(position);
    
    // Convert to -1 to 1 range
    const direction = (position - 0.5) * 2;
    onMovementChange(direction);
  }, [onMovementChange]);

  const handleSliderStart = useCallback((clientX: number): void => {
    isDraggingRef.current = true;
    updateSliderPosition(clientX);
  }, [updateSliderPosition]);

  const handleSliderEnd = useCallback(() => {
    isDraggingRef.current = false;
    setSliderPosition(0.5);
    onMovementChange(0);
  }, [onMovementChange]);

  // Mouse events for slider
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleSliderStart(e.clientX);
  }, [handleSliderStart]);

  // Touch events for slider
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleSliderStart(e.touches[0].clientX);
    }
  }, [handleSliderStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDraggingRef.current && e.touches.length > 0) {
      updateSliderPosition(e.touches[0].clientX);
    }
  }, [updateSliderPosition]);

  // Global mouse/touch move and end handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent): void => {
      if (isDraggingRef.current) {
        updateSliderPosition(e.clientX);
      }
    };

    const handleGlobalMouseUp = (): void => {
      if (isDraggingRef.current) {
        handleSliderEnd();
      }
    };

    const handleGlobalTouchEnd = (): void => {
      if (isDraggingRef.current) {
        handleSliderEnd();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return (): void => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [handleSliderEnd, updateSliderPosition]);

  // Fly button handlers
  const handleFlyDown = useCallback(() => {
    setTouchFlyPressed(true);
    onFlyPressed();
  }, [onFlyPressed]);

  const handleFlyUp = useCallback(() => {
    setTouchFlyPressed(false);
    onFlyReleased();
  }, [onFlyReleased]);

  // Stomp button handlers
  const handleStompDown = useCallback(() => {
    setTouchStompPressed(true);
    onStompPressed();
  }, [onStompPressed]);

  const handleStompUp = useCallback(() => {
    setTouchStompPressed(false);
    onStompReleased();
  }, [onStompReleased]);

  // Calculate slider button position - use effective position that accounts for keyboard input
  const sliderButtonX = effectiveSliderPosition * (MOVEMENT_SLIDER_WIDTH - SLIDER_BUTTON_WIDTH);

  // Show active state when dragging OR keyboard is active
  const isSliderActive = isDraggingRef.current || keyboardLeftActive || keyboardRightActive;

  return (
    <div className="game-controls-overlay">
      {/* Left side - Movement slider (original: X=20, Y=32 from bottom) */}
      <div 
        className="controls-left"
        style={{
          position: 'absolute',
          left: MOVEMENT_SLIDER_BASE_X,
          bottom: MOVEMENT_SLIDER_BASE_Y,
        }}
      >
        <div 
          ref={sliderRef}
          className="movement-slider-container"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          style={{
            position: 'relative',
            width: MOVEMENT_SLIDER_WIDTH,
            height: 64,
          }}
        >
          <img 
            src="/assets/sprites/ui_movement_slider_base.png" 
            alt="Movement base"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              imageRendering: 'pixelated',
            }}
            draggable={false}
          />
          <img 
            src={isSliderActive
              ? '/assets/sprites/ui_movement_slider_button_on.png'
              : '/assets/sprites/ui_movement_slider_button_off.png'
            }
            alt="Movement button"
            style={{
              position: 'absolute',
              bottom: 8,
              left: sliderButtonX,
              imageRendering: 'pixelated',
              cursor: 'pointer',
              transition: 'left 0.05s ease-out',
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* Right side - Action buttons
          Original layout from HudSystem.java:
          - In slider mode: Fly at (gameWidth - 128 - (-12), -5) = (364, 5) from bottom-right
          - Stomp at (gameWidth - 83.2 - 85, -10) = above and left of fly
          Using column-reverse to put Fly at bottom, Stomp above */}
      <div 
        className="controls-right"
        style={{
          position: 'absolute',
          right: 12,
          bottom: 5,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 5,
          alignItems: 'flex-end',
        }}
      >
        {/* Fly button (at bottom, larger) - rendered first due to column-reverse */}
        <div 
          className={`action-button ${flyPressed ? 'pressed' : ''}`}
          onMouseDown={handleFlyDown}
          onMouseUp={handleFlyUp}
          onMouseLeave={handleFlyUp}
          onTouchStart={handleFlyDown}
          onTouchEnd={handleFlyUp}
          style={{
            cursor: 'pointer',
            opacity: flyPressed ? 1 : 0.8,
            transform: flyPressed ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.1s ease',
          }}
        >
          <img 
            src={flyPressed ? '/assets/sprites/ui_button_fly_on.png' : '/assets/sprites/ui_button_fly_off.png'}
            alt="Fly"
            style={{ 
              width: FLY_BUTTON_DISPLAY_SIZE, 
              height: FLY_BUTTON_DISPLAY_SIZE,
              imageRendering: 'pixelated',
            }}
            draggable={false}
          />
        </div>
        {/* Stomp button (above fly, smaller) */}
        <div 
          className={`action-button ${stompPressed ? 'pressed' : ''}`}
          onMouseDown={handleStompDown}
          onMouseUp={handleStompUp}
          onMouseLeave={handleStompUp}
          onTouchStart={handleStompDown}
          onTouchEnd={handleStompUp}
          style={{ 
            cursor: 'pointer',
            opacity: stompPressed ? 1 : 0.8,
            transform: stompPressed ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.1s ease',
          }}
        >
          <img 
            src={stompPressed ? '/assets/sprites/ui_button_stomp_on.png' : '/assets/sprites/ui_button_stomp_off.png'}
            alt="Stomp"
            style={{ 
              width: STOMP_BUTTON_DISPLAY_SIZE, 
              height: STOMP_BUTTON_DISPLAY_SIZE,
              imageRendering: 'pixelated',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

export default OnScreenControls;

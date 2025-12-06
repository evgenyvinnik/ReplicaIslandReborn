/**
 * OnScreenControls Component - Twin-stick style controls from the original game
 * 
 * Replicates the original Replica Island control scheme:
 * - Left side: Movement slider (horizontal movement)
 * - Right side: Fly button (jump/fly) and Stomp button (attack)
 * 
 * Based on HudSystem.java and ButtonConstants.java from the original game.
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

// Original game button dimensions (from ButtonConstants.java)
const MOVEMENT_SLIDER_WIDTH = 128;
const SLIDER_BUTTON_WIDTH = 32;

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
      {/* Left side - Movement slider */}
      <div className="controls-left">
        <div 
          ref={sliderRef}
          className="movement-slider-container"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          <img 
            src="/assets/sprites/ui_movement_slider_base.png" 
            alt="Movement base"
            className="movement-slider-base"
            draggable={false}
          />
          <img 
            src={isSliderActive
              ? '/assets/sprites/ui_movement_slider_button_on.png'
              : '/assets/sprites/ui_movement_slider_button_off.png'
            }
            alt="Movement button"
            className="movement-slider-button"
            style={{ left: sliderButtonX }}
            draggable={false}
          />
        </div>
      </div>

      {/* Right side - Action buttons */}
      <div className="controls-right">
        <div 
          className={`action-button ${stompPressed ? 'pressed' : ''}`}
          onMouseDown={handleStompDown}
          onMouseUp={handleStompUp}
          onMouseLeave={handleStompUp}
          onTouchStart={handleStompDown}
          onTouchEnd={handleStompUp}
        >
          <img 
            src={stompPressed ? '/assets/sprites/ui_button_stomp_on.png' : '/assets/sprites/ui_button_stomp_off.png'}
            alt="Stomp"
            style={{ width: 48, height: 48 }}
            draggable={false}
          />
        </div>
        <div 
          className={`action-button ${flyPressed ? 'pressed' : ''}`}
          onMouseDown={handleFlyDown}
          onMouseUp={handleFlyUp}
          onMouseLeave={handleFlyUp}
          onTouchStart={handleFlyDown}
          onTouchEnd={handleFlyUp}
        >
          <img 
            src={flyPressed ? '/assets/sprites/ui_button_fly_on.png' : '/assets/sprites/ui_button_fly_off.png'}
            alt="Fly"
            style={{ width: 64, height: 64 }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

export default OnScreenControls;

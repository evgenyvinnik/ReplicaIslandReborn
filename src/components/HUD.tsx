/**
 * HUD Component - Heads-up display overlay
 * Matches the original HudSystem.java layout from Replica Island
 * 
 * Original coordinate system uses bottom-left origin (OpenGL style).
 * Web uses top-left origin, so Y positions are converted:
 *   webY = gameHeight - originalY - elementHeight
 * 
 * Original HudSystem.java layout (when player exists):
 * - Fuel bar: near top-left (15px padding, Y = gameHeight - height - 15 in OpenGL)
 * - Coins: center horizontally, near top (Y = gameHeight - height - 8 in OpenGL)
 * - Rubies: center + 100px horizontally, near top (same Y as coins)
 * - FPS: bottom-right corner (Y = 10 in OpenGL, so bottom in web)
 * 
 * Actual sprite dimensions (from PNG files):
 * - ui_bar_bg.png: 128x16
 * - ui_bar.png: 8x8 (stretched to fill)
 * - ui_0..9.png: 32x32
 * - ui_x.png: 32x32
 * - object_coin01.png: 16x16
 * - object_ruby01.png: 32x32
 * 
 * Note: Lives and pearls are NOT part of original HudSystem.
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState } from '../types';
import { getInventory, addInventoryListener, type InventoryRecord } from '../entities/components/InventoryComponent';

// ============================================================================
// HUD Layout Constants (from original HudSystem.java)
// ============================================================================

// Fuel bar positioning (from original HudSystem.java)
const FUEL_BAR_EDGE_PADDING = 15;

// Fuel bar animation speeds (per second)
const FUEL_DECREASE_BAR_SPEED = 0.75;
const FUEL_INCREASE_BAR_SPEED = 2.0;

// Collectables positioning
const COLLECTABLE_EDGE_PADDING = 8;
const RUBY_OFFSET_FROM_CENTER = 100; // Rubies are 100px right of center

// Sprite dimensions - ui_bar_bg.png is 128x16, but original uses 100-pixel effective width
// Original: barWidth = (int)((100 - 4) * mFuelPercent)
const FUEL_BAR_BG_WIDTH = 128;
const FUEL_BAR_BG_HEIGHT = 16;
const FUEL_BAR_INNER_OFFSET = 2;
const FUEL_BAR_INNER_MAX_WIDTH = 96; // Original uses (100-4)=96 pixels for the bar

const COIN_SPRITE_SIZE = 16;  // object_coin01.png is 16x16
const RUBY_SPRITE_SIZE = 32;  // object_ruby01.png is 32x32

const DIGIT_SPRITE_WIDTH = 32;  // ui_0.png etc are 32x32
const DIGIT_SPRITE_HEIGHT = 32;
const DIGIT_CHARACTER_WIDTH = DIGIT_SPRITE_WIDTH / 2; // Original uses half-width spacing (16px)

const X_MARK_SIZE = 32;  // ui_x.png is 32x32

// FPS display
const FPS_EDGE_PADDING = 10;

// ============================================================================
// Digit Sprites
// ============================================================================

const DIGIT_SPRITES = [
  '/assets/sprites/ui_0.png',
  '/assets/sprites/ui_1.png',
  '/assets/sprites/ui_2.png',
  '/assets/sprites/ui_3.png',
  '/assets/sprites/ui_4.png',
  '/assets/sprites/ui_5.png',
  '/assets/sprites/ui_6.png',
  '/assets/sprites/ui_7.png',
  '/assets/sprites/ui_8.png',
  '/assets/sprites/ui_9.png',
];

// ============================================================================
// Types
// ============================================================================

interface HUDProps {
  fps?: number;
  showFPS?: boolean;
  fuel?: number;  // Fuel percentage (0-1)
  gameWidth?: number;
  gameHeight?: number;
}

// ============================================================================
// Helper Functions (matching original HudSystem.java)
// ============================================================================

/**
 * Converts an integer to a digit array (matching original intToDigitArray)
 */
function intToDigitArray(value: number): number[] {
  const digits: number[] = [];
  const v = Math.max(0, Math.floor(value));
  
  // Determine character count (original logic)
  let characterCount = 1;
  if (v >= 1000) characterCount = 4;
  else if (v >= 100) characterCount = 3;
  else if (v >= 10) characterCount = 2;
  
  let remainingValue = v;
  for (let i = characterCount - 1; i >= 0; i--) {
    digits[i] = remainingValue % 10;
    remainingValue = Math.floor(remainingValue / 10);
  }
  
  return digits;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Renders a number using digit sprites (matching original drawNumber)
 * @param drawX - Whether to draw the "x" mark before the number (like "x42")
 */
function DigitDisplay({ 
  value, 
  drawX = false,
  style,
}: { 
  value: number; 
  drawX?: boolean;
  style?: React.CSSProperties;
}): React.JSX.Element {
  const digits = useMemo(() => intToDigitArray(value), [value]);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
      {drawX && (
        <img
          src="/assets/sprites/ui_x.png"
          alt="x"
          style={{
            width: X_MARK_SIZE,
            height: X_MARK_SIZE,
            imageRendering: 'pixelated',
          }}
        />
      )}
      {digits.map((digit, i) => (
        <img
          key={i}
          src={DIGIT_SPRITES[digit]}
          alt={digit.toString()}
          style={{
            width: DIGIT_SPRITE_WIDTH,
            height: DIGIT_SPRITE_HEIGHT,
            marginLeft: i > 0 || drawX ? -DIGIT_CHARACTER_WIDTH : 0, // Overlap like original
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </span>
  );
}

/**
 * Hook for animated fuel bar (smoothly transitions to target value)
 * Matches original HudSystem update behavior
 */
function useFuelAnimation(targetFuel: number): number {
  const [displayFuel, setDisplayFuel] = useState(targetFuel);
  const lastTimeRef = useRef(performance.now());
  
  useEffect(() => {
    let animationFrame: number;
    
    const animate = (currentTime: number): void => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      
      setDisplayFuel(current => {
        if (Math.abs(current - targetFuel) < 0.001) {
          return targetFuel;
        }
        
        if (current < targetFuel) {
          // Fuel increasing
          const newValue = current + FUEL_INCREASE_BAR_SPEED * deltaTime;
          return Math.min(newValue, targetFuel);
        } else {
          // Fuel decreasing
          const newValue = current - FUEL_DECREASE_BAR_SPEED * deltaTime;
          return Math.max(newValue, targetFuel);
        }
      });
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    animationFrame = requestAnimationFrame(animate);
    return (): void => { cancelAnimationFrame(animationFrame); };
  }, [targetFuel]);
  
  return displayFuel;
}

/**
 * Pause menu button component with consistent styling
 */
interface PauseMenuButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}

function PauseMenuButton({ children, onClick, primary = false }: PauseMenuButtonProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const baseStyle: React.CSSProperties = {
    padding: '10px 32px',
    fontSize: 16,
    fontFamily: 'sans-serif',
    fontWeight: 'bold',
    border: '2px solid',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    minWidth: 140,
    textAlign: 'center',
    letterSpacing: 1,
  };

  const primaryStyle: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: isPressed ? '#339933' : isHovered ? '#55bb55' : '#44aa44',
    color: '#fff',
    borderColor: '#66cc66',
    textShadow: '1px 1px 0 #228822',
  };

  const secondaryStyle: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: isPressed ? '#333' : isHovered ? '#555' : '#444',
    color: '#ccc',
    borderColor: '#666',
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={(): void => setIsHovered(true)}
      onMouseLeave={(): void => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={(): void => setIsPressed(true)}
      onMouseUp={(): void => setIsPressed(false)}
      style={primary ? primaryStyle : secondaryStyle}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Main HUD Component
// ============================================================================

export function HUD({ 
  fps = 0, 
  showFPS = false, 
  fuel = 1,
  gameWidth = 480,
  gameHeight = 320,
}: HUDProps): React.JSX.Element {
  const { state, goToMainMenu, resumeGame, startGame } = useGameContext();
  const [inventory, setInventory] = useState<InventoryRecord>(getInventory());

  // Callback to retry the current level
  const retryLevel = useCallback((): void => {
    startGame(state.currentLevel);
  }, [startGame, state.currentLevel]);

  // Callback to continue to next level
  const continueToNextLevel = useCallback((): void => {
    startGame(state.currentLevel + 1);
  }, [startGame, state.currentLevel]);
  
  // Animated fuel display (matching original HudSystem behavior)
  const displayFuel = useFuelAnimation(fuel);

  // Subscribe to inventory changes
  useEffect(() => {
    const unsubscribe = addInventoryListener((inv) => {
      setInventory(inv);
    });
    return unsubscribe;
  }, []);

  // ========================================================================
  // Position Calculations (converting from original bottom-left origin)
  // ========================================================================
  
  // Fuel bar: original position is (PADDING, gameHeight - height - PADDING)
  // In web coords (top-left origin): top = PADDING
  const fuelBarTop = FUEL_BAR_EDGE_PADDING;
  const fuelBarLeft = FUEL_BAR_EDGE_PADDING;
  
  // Coins: original position is (gameWidth/2 - width/2, gameHeight - height - PADDING)
  // In web coords: near top of screen
  const coinLeft = (gameWidth / 2) - (COIN_SPRITE_SIZE / 2);
  const coinTop = COLLECTABLE_EDGE_PADDING;
  
  // Rubies: 100px to the right of coins (from original)
  const rubyLeft = (gameWidth / 2) + RUBY_OFFSET_FROM_CENTER;
  const rubyTop = COLLECTABLE_EDGE_PADDING;
  
  // FPS: original is bottom-right, web coords: bottom-right
  // Original: (gameWidth - 10 - digitsWidth, 10) from bottom
  // In web coords: bottom = gameHeight - 10 - height
  const fpsRight = FPS_EDGE_PADDING;
  const fpsBottom = FPS_EDGE_PADDING;

  // Calculate fuel bar width based on percentage
  const fuelBarWidth = Math.max(0, Math.floor(FUEL_BAR_INNER_MAX_WIDTH * displayFuel));

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: gameWidth,
        height: gameHeight,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* ================================================================== */}
      {/* FUEL BAR - Top Left (original: bottom-left in OpenGL coords) */}
      {/* ================================================================== */}
      <div
        style={{
          position: 'absolute',
          left: fuelBarLeft,
          top: fuelBarTop,
        }}
      >
        {/* Fuel background - 128x16 sprite */}
        <img
          src="/assets/sprites/ui_bar_bg.png"
          alt="fuel bg"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: FUEL_BAR_BG_WIDTH,
            height: FUEL_BAR_BG_HEIGHT,
            imageRendering: 'pixelated',
          }}
        />
        {/* Fuel bar fill - stretch the 8x8 ui_bar.png sprite to fill (matching original) */}
        {fuelBarWidth >= 1 && (
          <img
            src="/assets/sprites/ui_bar.png"
            alt="fuel"
            style={{
              position: 'absolute',
              left: FUEL_BAR_INNER_OFFSET,
              top: FUEL_BAR_INNER_OFFSET,
              width: fuelBarWidth,
              height: FUEL_BAR_BG_HEIGHT - (FUEL_BAR_INNER_OFFSET * 2),
              imageRendering: 'pixelated',
            }}
          />
        )}
      </div>

      {/* ================================================================== */}
      {/* COIN COUNT - Top Center (original: near top, center-left) */}
      {/* ================================================================== */}
      <div
        style={{
          position: 'absolute',
          left: coinLeft,
          top: coinTop,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <img
          src="/assets/sprites/object_coin01.png"
          alt="coin"
          style={{
            width: COIN_SPRITE_SIZE,
            height: COIN_SPRITE_SIZE,
            imageRendering: 'pixelated',
          }}
        />
        <DigitDisplay 
          value={inventory.coinCount} 
          drawX={true}
          style={{ marginLeft: COIN_SPRITE_SIZE * 0.75 - COIN_SPRITE_SIZE }}
        />
      </div>

      {/* ================================================================== */}
      {/* RUBY COUNT - Top Center-Right (original: center + 100px) */}
      {/* ================================================================== */}
      <div
        style={{
          position: 'absolute',
          left: rubyLeft,
          top: rubyTop,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <img
          src="/assets/sprites/object_ruby01.png"
          alt="ruby"
          style={{
            width: RUBY_SPRITE_SIZE,
            height: RUBY_SPRITE_SIZE,
            imageRendering: 'pixelated',
          }}
        />
        <DigitDisplay 
          value={inventory.rubyCount} 
          drawX={true}
          style={{ marginLeft: RUBY_SPRITE_SIZE * 0.75 - RUBY_SPRITE_SIZE }}
        />
      </div>

      {/* ================================================================== */}
      {/* FPS COUNTER - Bottom Right (matching original position) */}
      {/* ================================================================== */}
      {showFPS && (
        <div
          style={{
            position: 'absolute',
            right: fpsRight,
            bottom: fpsBottom,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <DigitDisplay value={fps} />
        </div>
      )}

      {/* ================================================================== */}
      {/* PAUSE OVERLAY */}
      {/* ================================================================== */}
      {state.gameState === GameState.PAUSED && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          <img
            src="/assets/sprites/ui_paused.png"
            alt="PAUSED"
            style={{
              width: 200,
              imageRendering: 'pixelated',
              marginBottom: 24,
            }}
          />
          
          {/* Pause Menu Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <PauseMenuButton onClick={resumeGame} primary>
              Resume
            </PauseMenuButton>
            <PauseMenuButton onClick={goToMainMenu}>
              Main Menu
            </PauseMenuButton>
          </div>
          
          <p style={{ 
            fontSize: 12, 
            color: '#666', 
            fontFamily: 'sans-serif',
            marginTop: 24,
          }}>
            Press ESC or P to resume
          </p>
        </div>
      )}

      {/* ================================================================== */}
      {/* GAME OVER OVERLAY */}
      {/* ================================================================== */}
      {state.gameState === GameState.GAME_OVER && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#FFFFFF',
            backgroundImage: 'url(/assets/sprites/title_background.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          {/* White tint overlay like original game_over.xml: tint="#88FFFFFF" */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.53)',
          }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <h2 style={{ 
              fontSize: 40, 
              color: '#000000', 
              marginBottom: 16,
              fontFamily: 'serif',
              fontWeight: 'bold',
            }}>
              GAME OVER
            </h2>
            <p style={{ fontSize: 20, color: '#000000', fontFamily: 'serif', fontWeight: 'bold', marginBottom: 24 }}>
              Deaths: {state.saveData.totalDeaths}
            </p>
          
            {/* Game Over Menu Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', marginTop: 16 }}>
              <PauseMenuButton onClick={retryLevel} primary>
                Retry Level
              </PauseMenuButton>
              <PauseMenuButton onClick={goToMainMenu}>
                Main Menu
              </PauseMenuButton>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* LEVEL COMPLETE OVERLAY */}
      {/* ================================================================== */}
      {state.gameState === GameState.LEVEL_COMPLETE && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#FFFFFF',
            backgroundImage: 'url(/assets/sprites/title_background.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          {/* White tint overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.53)',
          }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <h2 style={{ 
              fontSize: 40, 
              color: '#000000', 
              marginBottom: 16,
              fontFamily: 'serif',
              fontWeight: 'bold',
            }}>
              LEVEL COMPLETE!
            </h2>
          
            {/* Collectables Summary */}
            <div style={{ display: 'flex', gap: 32, marginTop: 16, marginBottom: 24 }}>
              <div style={{ textAlign: 'center', color: '#000000', fontFamily: 'serif' }}>
                <img 
                  src="/assets/sprites/object_coin01.png" 
                  alt="coins" 
                  style={{ width: 32, imageRendering: 'pixelated' }} 
                />
                <div style={{ marginTop: 8 }}>
                  <DigitDisplay value={inventory.coinCount} />
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#000000', fontFamily: 'serif' }}>
                <img 
                  src="/assets/sprites/object_ruby01.png" 
                  alt="rubies" 
                  style={{ width: 32, imageRendering: 'pixelated' }} 
                />
                <div style={{ marginTop: 8 }}>
                  <DigitDisplay value={inventory.rubyCount} />
                </div>
              </div>
            </div>
          
            {/* Level Complete Menu Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <PauseMenuButton onClick={continueToNextLevel} primary>
                Continue
              </PauseMenuButton>
              <PauseMenuButton onClick={goToMainMenu}>
                Main Menu
              </PauseMenuButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * HUD Component - Heads-up display overlay
 * Uses original game sprites for authentic look
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState } from '../types';
import { getInventory, addInventoryListener, type InventoryRecord } from '../entities/components/InventoryComponent';

// HUD layout constants (from original HudSystem.java)
const FUEL_BAR_EDGE_PADDING = 15;
const COLLECTABLE_EDGE_PADDING = 8;
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

interface HUDProps {
  fps?: number;
  showFPS?: boolean;
  fuel?: number;  // Fuel percentage (0-1)
  gameWidth?: number;
  gameHeight?: number;
}

/**
 * Renders a number using digit sprites
 */
function DigitDisplay({ value, style }: { value: number; style?: React.CSSProperties }): React.JSX.Element {
  const digits = useMemo(() => {
    const str = Math.max(0, Math.floor(value)).toString();
    return str.split('').map((d) => parseInt(d, 10));
  }, [value]);

  return (
    <span style={{ display: 'inline-flex', ...style }}>
      {digits.map((digit, i) => (
        <img
          key={i}
          src={DIGIT_SPRITES[digit]}
          alt={digit.toString()}
          style={{
            width: '16px',
            height: '16px',
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </span>
  );
}

export function HUD({ 
  fps = 0, 
  showFPS = false, 
  fuel = 1,
  gameWidth = 480,
  gameHeight = 320,
}: HUDProps): React.JSX.Element {
  const { state, goToMainMenu } = useGameContext();
  const [inventory, setInventory] = useState<InventoryRecord>(getInventory());

  // Subscribe to inventory changes
  useEffect(() => {
    const unsubscribe = addInventoryListener((inv) => {
      setInventory(inv);
    });
    return unsubscribe;
  }, []);

  // Calculate positions based on game dimensions
  const coinX = gameWidth / 2 - 60;
  const coinY = gameHeight - 40 - COLLECTABLE_EDGE_PADDING;
  const rubyX = gameWidth / 2 + 40;
  const rubyY = coinY;

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
      {/* === TOP LEFT: Fuel Bar === */}
      <div
        style={{
          position: 'absolute',
          left: FUEL_BAR_EDGE_PADDING,
          top: FUEL_BAR_EDGE_PADDING,
        }}
      >
        {/* Fuel background */}
        <img
          src="/assets/sprites/ui_bar_bg.png"
          alt="fuel bg"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100px',
            height: '12px',
            imageRendering: 'pixelated',
          }}
        />
        {/* Fuel bar (clipped to show percentage) */}
        <div
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            width: `${Math.max(0, fuel * 96)}px`,
            height: '8px',
            overflow: 'hidden',
          }}
        >
          <img
            src="/assets/sprites/ui_bar.png"
            alt="fuel"
            style={{
              width: '96px',
              height: '8px',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      </div>

      {/* === TOP LEFT: Lives (below fuel bar) === */}
      <div
        style={{
          position: 'absolute',
          left: FUEL_BAR_EDGE_PADDING,
          top: FUEL_BAR_EDGE_PADDING + 20,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <img
          src="/assets/sprites/andou_stand.png"
          alt="life"
          style={{
            width: '24px',
            height: '24px',
            imageRendering: 'pixelated',
          }}
        />
        <img
          src="/assets/sprites/ui_x.png"
          alt="x"
          style={{
            width: '12px',
            height: '12px',
            imageRendering: 'pixelated',
          }}
        />
        <DigitDisplay value={inventory.lives} />
      </div>

      {/* === BOTTOM CENTER: Coin count === */}
      <div
        style={{
          position: 'absolute',
          left: coinX,
          top: coinY,
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
        }}
      >
        <img
          src="/assets/sprites/object_coin01.png"
          alt="coin"
          style={{
            width: '32px',
            height: '32px',
            imageRendering: 'pixelated',
          }}
        />
        <img
          src="/assets/sprites/ui_x.png"
          alt="x"
          style={{
            width: '12px',
            height: '12px',
            imageRendering: 'pixelated',
          }}
        />
        <DigitDisplay value={inventory.coinCount} />
      </div>

      {/* === BOTTOM CENTER-RIGHT: Ruby count === */}
      <div
        style={{
          position: 'absolute',
          left: rubyX,
          top: rubyY,
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
        }}
      >
        <img
          src="/assets/sprites/object_ruby01.png"
          alt="ruby"
          style={{
            width: '32px',
            height: '32px',
            imageRendering: 'pixelated',
          }}
        />
        <img
          src="/assets/sprites/ui_x.png"
          alt="x"
          style={{
            width: '12px',
            height: '12px',
            imageRendering: 'pixelated',
          }}
        />
        <DigitDisplay value={inventory.rubyCount} />
      </div>

      {/* === TOP CENTER: Pearls/Gems collected === */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          top: COLLECTABLE_EDGE_PADDING,
          display: 'flex',
          gap: '4px',
        }}
      >
        {Array.from({ length: inventory.totalPearls }).map((_, i) => (
          <img
            key={i}
            src="/assets/sprites/ui_gem.png"
            alt="gem"
            style={{
              width: '24px',
              height: '24px',
              imageRendering: 'pixelated',
              opacity: i < inventory.pearls ? 1 : 0.3,
              filter: i < inventory.pearls ? 'none' : 'grayscale(100%)',
            }}
          />
        ))}
      </div>

      {/* === TOP RIGHT: FPS counter === */}
      {showFPS && (
        <div
          style={{
            position: 'absolute',
            right: COLLECTABLE_EDGE_PADDING,
            top: COLLECTABLE_EDGE_PADDING,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <DigitDisplay value={fps} />
        </div>
      )}

      {/* === Pause Overlay === */}
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
              width: '200px',
              imageRendering: 'pixelated',
              marginBottom: '16px',
            }}
          />
          <p style={{ fontSize: '14px', color: '#aaa', fontFamily: 'monospace' }}>
            Press ESC or P to resume
          </p>
        </div>
      )}

      {/* === Game Over Overlay === */}
      {state.gameState === GameState.GAME_OVER && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          <h2 style={{ 
            fontSize: '32px', 
            color: '#ff4444', 
            marginBottom: '16px',
            fontFamily: 'monospace',
            textShadow: '2px 2px 0 #000',
          }}>
            GAME OVER
          </h2>
          <p style={{ fontSize: '14px', color: '#aaa', fontFamily: 'monospace' }}>
            Deaths: {state.saveData.totalDeaths}
          </p>
          <button
            onClick={goToMainMenu}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              fontSize: '16px',
              fontFamily: 'monospace',
              backgroundColor: '#444',
              color: '#fff',
              border: '2px solid #888',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Return to Menu
          </button>
        </div>
      )}

      {/* === Level Complete Overlay === */}
      {state.gameState === GameState.LEVEL_COMPLETE && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          <h2 style={{ 
            fontSize: '32px', 
            color: '#44ff44', 
            marginBottom: '16px',
            fontFamily: 'monospace',
            textShadow: '2px 2px 0 #000',
          }}>
            LEVEL COMPLETE!
          </h2>
          <div style={{ display: 'flex', gap: '32px', marginTop: '16px' }}>
            <div style={{ textAlign: 'center', color: '#fff', fontFamily: 'monospace' }}>
              <img src="/assets/sprites/object_coin01.png" alt="coins" style={{ width: '32px', imageRendering: 'pixelated' }} />
              <div style={{ marginTop: '8px' }}>
                <DigitDisplay value={inventory.coinCount} />
              </div>
            </div>
            <div style={{ textAlign: 'center', color: '#fff', fontFamily: 'monospace' }}>
              <img src="/assets/sprites/object_ruby01.png" alt="rubies" style={{ width: '32px', imageRendering: 'pixelated' }} />
              <div style={{ marginTop: '8px' }}>
                <DigitDisplay value={inventory.rubyCount} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

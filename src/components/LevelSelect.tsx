/**
 * Level Select Component
 * Styled to match the original Replica Island Android UI exactly
 * 
 * Original UI uses:
 * - ListView with custom row layouts
 * - ui_rack_green.png for enabled levels (green rack background)
 * - ui_rack_gray.png for completed levels (gray rack background)
 * - ui_rack_red.png for disabled/locked levels (red rack background)
 * - Each row is 70dp tall with level name and timestamp
 * - Text color: #65ff99 for enabled, #066659 for disabled/completed
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameContext } from '../context/GameContext';
import {
  generateLevelList,
  sortLevelsByTime,
  resourceToLevelId,
  type LevelMetaData,
} from '../data/levelTree';

// Row height in pixels (original: 70dp)
// Scaled down slightly to fit more levels in the 320px view
const ROW_HEIGHT = 48;

// Text colors from original
const TEXT_COLOR_ENABLED = '#65ff99';
const TEXT_COLOR_DISABLED = '#066659';

// Level row state types
type RowState = 'enabled' | 'disabled' | 'completed';

interface LevelRowProps {
  levelData: LevelMetaData;
  onClick: () => void;
  isSelected: boolean;
  isFlickering: boolean;
}

/**
 * Single level row matching the original Android layout
 */
function LevelRow({
  levelData,
  onClick,
  isSelected,
  isFlickering,
}: LevelRowProps): React.JSX.Element {
  const { level, enabled } = levelData;

  // Determine row state
  let state: RowState = 'disabled';
  if (enabled) {
    state = 'enabled';
  } else if (level.completed) {
    state = 'completed';
  }

  // Get appropriate rack background
  const getRackImage = (): string => {
    switch (state) {
      case 'enabled':
        return '/assets/sprites/ui_rack_green.png';
      case 'completed':
        return '/assets/sprites/ui_rack_gray.png';
      case 'disabled':
      default:
        return '/assets/sprites/ui_rack_red.png';
    }
  };

  // Get text color based on state
  const getTextColor = (): string => {
    return state === 'enabled' ? TEXT_COLOR_ENABLED : TEXT_COLOR_DISABLED;
  };

  // Flickering animation for selection
  const flickerOpacity = isFlickering ? 'animate-flicker' : '';

  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        width: '100%',
        height: `${ROW_HEIGHT}px`,
        position: 'relative',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: enabled ? 'pointer' : 'default',
        background: 'transparent',
        display: 'block',
        outline: isSelected ? '2px solid #65ff99' : 'none',
        outlineOffset: '-2px',
      }}
      className={flickerOpacity}
    >
      {/* Rack background image */}
      <img
        src={getRackImage()}
        alt=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          imageRendering: 'pixelated',
        }}
      />

      {/* Level title - positioned like original (x=20dp, y=5dp, scaled) */}
      <div
        style={{
          position: 'absolute',
          left: '15px',
          top: '4px',
          width: '200px',
          height: '28px',
          fontSize: '18px',
          fontWeight: 'bold',
          color: getTextColor(),
          fontFamily: 'monospace',
          textAlign: 'left',
          lineHeight: '28px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {level.name}
      </div>

      {/* Timestamp - positioned like original (x=290dp, y=25dp, scaled) */}
      <div
        style={{
          position: 'absolute',
          right: '15px',
          top: '18px',
          width: 'auto',
          height: '12px',
          fontSize: '10px',
          color: getTextColor(),
          fontFamily: 'monospace',
          textAlign: 'right',
        }}
      >
        {level.timeStamp}
      </div>
    </button>
  );
}

export function LevelSelect(): React.JSX.Element {
  const { startGame, goToMainMenu, state } = useGameContext();
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [flickeringIndex, setFlickeringIndex] = useState<number>(-1);
  const [levelList, setLevelList] = useState<LevelMetaData[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Generate level list based on completed levels
  useEffect(() => {
    const completedSet = new Set(
      state.saveData.completedLevels.map((id) => {
        // Convert numeric IDs to resource names if needed
        // For now, assume completedLevels contains resource strings
        return typeof id === 'number' ? `level_${id}` : String(id);
      })
    );

    // Generate and sort the level list
    const list = generateLevelList(completedSet, true);
    const sorted = sortLevelsByTime(list);
    setLevelList(sorted);

    // Auto-select first enabled level
    const firstEnabledIndex = sorted.findIndex((l) => l.enabled);
    if (firstEnabledIndex >= 0) {
      setSelectedIndex(firstEnabledIndex);
    }
  }, [state.saveData.completedLevels]);

  // Handle level selection with flicker animation
  const handleLevelClick = useCallback(
    (index: number, levelData: LevelMetaData) => {
      if (!levelData.enabled) return;

      setSelectedIndex(index);
      setFlickeringIndex(index);

      // Start flicker animation, then start game (800ms total animation)
      setTimeout(() => {
        setFlickeringIndex(-1);
        // Get the numeric level ID from the resource mapping
        const levelId = resourceToLevelId[levelData.level.resource] || 1;
        startGame(levelId);
      }, 800);
    },
    [startGame]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (flickeringIndex !== -1) return; // Don't navigate during animation

      const enabledIndices = levelList
        .map((l, i) => (l.enabled ? i : -1))
        .filter((i) => i !== -1);

      if (enabledIndices.length === 0) return;

      let currentEnabledIndex = enabledIndices.indexOf(selectedIndex);
      if (currentEnabledIndex === -1) {
        currentEnabledIndex = 0;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentEnabledIndex > 0) {
            const newIndex = enabledIndices[currentEnabledIndex - 1];
            setSelectedIndex(newIndex);
            scrollToIndex(newIndex);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentEnabledIndex < enabledIndices.length - 1) {
            const newIndex = enabledIndices[currentEnabledIndex + 1];
            setSelectedIndex(newIndex);
            scrollToIndex(newIndex);
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (selectedIndex >= 0 && levelList[selectedIndex]?.enabled) {
            handleLevelClick(selectedIndex, levelList[selectedIndex]);
          } else if (enabledIndices.length > 0) {
            const firstEnabled = enabledIndices[0];
            setSelectedIndex(firstEnabled);
            handleLevelClick(firstEnabled, levelList[firstEnabled]);
          }
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          goToMainMenu();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    levelList,
    selectedIndex,
    flickeringIndex,
    handleLevelClick,
    goToMainMenu,
  ]);

  // Scroll to a specific index
  const scrollToIndex = (index: number): void => {
    if (listRef.current) {
      const scrollTop = index * ROW_HEIGHT;
      listRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  };

  // Count completed and total levels
  const completedCount = levelList.filter((l) => l.level.completed).length;
  const totalCount = levelList.length;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#000000',
        overflow: 'hidden',
      }}
    >
      {/* CSS for flicker animation - matches original button_flicker.xml */}
      <style>
        {`
          @keyframes flicker {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
          .animate-flicker {
            animation: flicker 100ms ease-in-out 0s 8 alternate;
          }
        `}
      </style>

      {/* Level list - scrollable ListView style (matches original full-screen list) */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: '#000000',
        }}
      >
        {levelList.map((levelData, index) => (
          <LevelRow
            key={`${levelData.row}-${levelData.index}`}
            levelData={levelData}
            onClick={() => handleLevelClick(index, levelData)}
            isSelected={selectedIndex === index}
            isFlickering={flickeringIndex === index}
          />
        ))}
      </div>

      {/* Minimal footer with back hint - since web doesn't have device back button */}
      <div
        style={{
          padding: '4px 8px',
          backgroundColor: '#000000',
          borderTop: '1px solid #111',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#444',
          flexShrink: 0,
        }}
      >
        <button
          onClick={goToMainMenu}
          style={{
            padding: '2px 8px',
            fontSize: '10px',
            fontFamily: 'monospace',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#555',
            cursor: 'pointer',
          }}
          onMouseEnter={(e): void => {
            e.currentTarget.style.color = TEXT_COLOR_ENABLED;
          }}
          onMouseLeave={(e): void => {
            e.currentTarget.style.color = '#555';
          }}
        >
          ← Back (Esc)
        </button>
        <span style={{ color: '#333' }}>
          {completedCount}/{totalCount}
        </span>
      </div>
    </div>
  );
}

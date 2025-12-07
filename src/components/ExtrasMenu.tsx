/**
 * Extras Menu Component
 * Ported from: Original/src/com/replica/replicaisland/ExtrasMenuActivity.java
 * 
 * Unlockable extras menu that appears after completing the game:
 * - Linear Mode: Play all levels in sequence
 * - Level Select: Jump to any level directly  
 * - Sound Test: Listen to game sounds (bonus feature)
 * - Controls: Configure control settings
 */

import React, { useState, useEffect } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { assetPath } from '../utils/helpers';

interface ExtrasMenuProps {
  onBack: () => void;
  onStartLinearMode: () => void;
  onGoToLevelSelect: () => void;
  onGoToOptions: () => void;
}

export function ExtrasMenu({ 
  onBack, 
  onStartLinearMode, 
  onGoToLevelSelect, 
  onGoToOptions 
}: ExtrasMenuProps): React.JSX.Element {
  const [showLockedDialog, setShowLockedDialog] = useState(false);
  const [showNewGameDialog, setShowNewGameDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'linear' | 'levelSelect' | null>(null);
  
  // Get extras unlock status from store
  const extrasUnlocked = useGameStore(state => state.progress.extrasUnlocked);
  const levelProgress = useGameStore(state => state.progress.levels);
  
  // Check if any levels have been completed (for new game warning)
  const hasProgress = Object.values(levelProgress).some(level => level.completed);
  
  // Check if all extras are unlocked (game completed)
  const allExtrasUnlocked = extrasUnlocked.linearMode && extrasUnlocked.levelSelect;

  const handleLinearModeClick = (): void => {
    if (!extrasUnlocked.linearMode) {
      setShowLockedDialog(true);
      return;
    }
    
    if (hasProgress) {
      setPendingAction('linear');
      setShowNewGameDialog(true);
    } else {
      onStartLinearMode();
    }
  };

  const handleLevelSelectClick = (): void => {
    if (!extrasUnlocked.levelSelect) {
      setShowLockedDialog(true);
      return;
    }
    
    if (hasProgress) {
      setPendingAction('levelSelect');
      setShowNewGameDialog(true);
    } else {
      onGoToLevelSelect();
    }
  };

  const confirmNewGame = (): void => {
    setShowNewGameDialog(false);
    if (pendingAction === 'linear') {
      onStartLinearMode();
    } else if (pendingAction === 'levelSelect') {
      onGoToLevelSelect();
    }
    setPendingAction(null);
  };

  const cancelNewGame = (): void => {
    setShowNewGameDialog(false);
    setPendingAction(null);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background */}
      <img
        src={assetPath('/assets/sprites/title_background.png')}
        alt=""
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
        }}
      />

      {/* Content */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
      }}>
        {/* Title */}
        <h1 style={{
          color: '#FFFFFF',
          fontSize: '24px',
          fontFamily: 'sans-serif',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
          marginBottom: '30px',
          letterSpacing: '2px',
        }}>
          EXTRAS
        </h1>

        {/* Menu Options */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'center',
        }}>
          {/* Linear Mode */}
          <MenuButton
            label="Linear Mode"
            locked={!extrasUnlocked.linearMode}
            onClick={handleLinearModeClick}
          />

          {/* Level Select */}
          <MenuButton
            label="Level Select"
            locked={!extrasUnlocked.levelSelect}
            onClick={handleLevelSelectClick}
          />

          {/* Controls */}
          <MenuButton
            label="Controls"
            locked={false}
            onClick={onGoToOptions}
          />

          {/* Back Button */}
          <button
            onClick={onBack}
            style={{
              marginTop: '20px',
              padding: '8px 24px',
              backgroundColor: 'rgba(100, 100, 100, 0.8)',
              border: '2px solid #888',
              borderRadius: '4px',
              color: '#FFF',
              fontSize: '14px',
              fontFamily: 'sans-serif',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e): void => {
              e.currentTarget.style.backgroundColor = 'rgba(120, 120, 120, 0.9)';
            }}
            onMouseLeave={(e): void => {
              e.currentTarget.style.backgroundColor = 'rgba(100, 100, 100, 0.8)';
            }}
          >
            Back
          </button>
        </div>

        {/* Unlock Hint */}
        {!allExtrasUnlocked && (
          <p style={{
            marginTop: '30px',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '10px',
            fontFamily: 'sans-serif',
            textAlign: 'center',
          }}>
            Complete the game to unlock all extras!
          </p>
        )}
      </div>

      {/* Locked Dialog */}
      {showLockedDialog && (
        <DialogOverlay onClose={(): void => setShowLockedDialog(false)}>
          <div style={{
            backgroundColor: 'rgba(40, 40, 60, 0.95)',
            border: '2px solid #666',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '280px',
            textAlign: 'center',
          }}>
            <h2 style={{ color: '#FFF', fontSize: '18px', marginBottom: '12px' }}>
              Locked
            </h2>
            <p style={{ color: '#CCC', fontSize: '14px', marginBottom: '16px' }}>
              This extra content is locked. Complete the game to unlock it!
            </p>
            <button
              onClick={(): void => setShowLockedDialog(false)}
              style={{
                padding: '8px 20px',
                backgroundColor: '#557',
                border: 'none',
                borderRadius: '4px',
                color: '#FFF',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        </DialogOverlay>
      )}

      {/* New Game Warning Dialog */}
      {showNewGameDialog && (
        <DialogOverlay onClose={cancelNewGame}>
          <div style={{
            backgroundColor: 'rgba(40, 40, 60, 0.95)',
            border: '2px solid #666',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '280px',
            textAlign: 'center',
          }}>
            <h2 style={{ color: '#FFF', fontSize: '18px', marginBottom: '12px' }}>
              Start New Game?
            </h2>
            <p style={{ color: '#CCC', fontSize: '14px', marginBottom: '16px' }}>
              This will start a new game. Your level progress will be saved, but you&apos;ll begin from the start.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={cancelNewGame}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#555',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#FFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmNewGame}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#557',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#FFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface MenuButtonProps {
  label: string;
  locked: boolean;
  onClick: () => void;
}

function MenuButton({ label, locked, onClick }: MenuButtonProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={(): void => setIsHovered(true)}
        onMouseLeave={(): void => setIsHovered(false)}
        style={{
          minWidth: '180px',
          padding: '10px 24px',
          backgroundColor: locked 
            ? 'rgba(60, 60, 80, 0.7)' 
            : isHovered 
              ? 'rgba(80, 80, 120, 0.9)' 
              : 'rgba(70, 70, 100, 0.8)',
          border: `2px solid ${locked ? '#555' : '#888'}`,
          borderRadius: '4px',
          color: locked ? '#888' : '#FFF',
          fontSize: '16px',
          fontFamily: 'sans-serif',
          cursor: locked ? 'default' : 'pointer',
          transition: 'all 0.2s',
          textShadow: locked ? 'none' : '1px 1px 2px rgba(0, 0, 0, 0.5)',
        }}
      >
        {label}
      </button>
      
      {/* Lock indicator */}
      {locked && (
        <div style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '16px',
          opacity: 0.8,
          animation: 'pulse 2s infinite',
        }}>
          🔒
        </div>
      )}
    </div>
  );
}

interface DialogOverlayProps {
  children: React.ReactNode;
  onClose: () => void;
}

function DialogOverlay({ children, onClose }: DialogOverlayProps): React.JSX.Element {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return (): void => { window.removeEventListener('keydown', handleKeyDown); };
  }, [onClose]);

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
      }}
    >
      <div onClick={(e): void => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

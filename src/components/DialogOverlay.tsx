/**
 * Dialog Overlay Component
 * Displays character conversations with portraits and typewriter text effect
 * Ported from: Original ConversationDialogActivity.java
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Dialog, DialogPage, Conversation, Character } from '../data/dialogs';
import { getCharacterName } from '../data/dialogs';

interface DialogOverlayProps {
  dialog: Dialog;
  onComplete: () => void;
  onSkip?: () => void;
}

// Typewriter speed (characters per second)
const TYPEWRITER_SPEED = 40;

// Character name colors
const CHARACTER_COLORS: Record<Character, string> = {
  Wanda: '#ff88cc',
  Kyle: '#88ccff',
  Kabocha: '#88ff88',
  Rokudou: '#ffcc88',
};

export function DialogOverlay({ dialog, onComplete, onSkip }: DialogOverlayProps): React.JSX.Element {
  const [conversationIndex, setConversationIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const typewriterRef = useRef<number | null>(null);

  // Get current page
  const currentConversation: Conversation | undefined = dialog.conversations[conversationIndex];
  const currentPage: DialogPage | undefined = currentConversation?.pages[pageIndex];

  // Typewriter effect
  useEffect(() => {
    if (!currentPage) return;

    const fullText = currentPage.text;
    let charIndex = 0;
    setDisplayedText('');
    setIsTyping(true);

    const interval = window.setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));

      if (charIndex >= fullText.length) {
        window.clearInterval(interval);
        setIsTyping(false);
      }
    }, 1000 / TYPEWRITER_SPEED);

    typewriterRef.current = interval;

    return (): void => {
      if (typewriterRef.current) {
        window.clearInterval(typewriterRef.current);
      }
    };
  }, [currentPage, conversationIndex, pageIndex]);

  // Skip typewriter or advance to next page/conversation
  const handleAdvance = useCallback(() => {
    if (!currentPage) return;

    if (isTyping) {
      // Skip typewriter effect
      if (typewriterRef.current) {
        window.clearInterval(typewriterRef.current);
      }
      setDisplayedText(currentPage.text);
      setIsTyping(false);
      return;
    }

    // Advance to next page
    if (pageIndex < (currentConversation?.pages.length ?? 0) - 1) {
      setPageIndex(pageIndex + 1);
      return;
    }

    // Advance to next conversation
    if (conversationIndex < dialog.conversations.length - 1) {
      setConversationIndex(conversationIndex + 1);
      setPageIndex(0);
      return;
    }

    // Dialog complete
    onComplete();
  }, [isTyping, pageIndex, currentConversation, conversationIndex, dialog.conversations.length, onComplete, currentPage]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        handleAdvance();
      } else if (e.key === 'Escape' && onSkip) {
        e.preventDefault();
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAdvance, onSkip]);

  if (!currentPage) {
    return <></>;
  }

  const characterColor = CHARACTER_COLORS[currentPage.character] || '#ffffff';
  const characterName = getCharacterName(currentPage.character);

  // Calculate progress
  const totalPages = dialog.conversations.reduce((sum, conv) => sum + conv.pages.length, 0);
  let currentPageNum = 0;
  for (let i = 0; i < conversationIndex; i++) {
    currentPageNum += dialog.conversations[i].pages.length;
  }
  currentPageNum += pageIndex + 1;

  return (
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
        justifyContent: 'flex-end',
        padding: '16px',
        zIndex: 1000,
      }}
      onClick={handleAdvance}
    >
      {/* Dialog box */}
      <div
        style={{
          backgroundColor: 'rgba(0, 20, 40, 0.95)',
          border: '3px solid #446688',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          gap: '12px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Character portrait */}
        <div
          style={{
            width: '80px',
            height: '80px',
            flexShrink: 0,
            border: '2px solid #446688',
            borderRadius: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={currentPage.portrait}
            alt={characterName}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              imageRendering: 'pixelated',
              transform: 'scale(2)',
            }}
            onError={(e) => {
              // Fallback if image doesn't load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Character name */}
          <div
            style={{
              color: characterColor,
              fontSize: '14px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              marginBottom: '8px',
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
            }}
          >
            {characterName}
          </div>

          {/* Dialog text */}
          <div
            style={{
              color: '#ffffff',
              fontSize: '12px',
              fontFamily: 'monospace',
              lineHeight: '1.5',
              textShadow: '1px 1px 1px rgba(0, 0, 0, 0.5)',
              minHeight: '60px',
            }}
          >
            {displayedText}
            {isTyping && (
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '12px',
                  backgroundColor: '#ffffff',
                  marginLeft: '2px',
                  animation: 'blink 0.5s infinite',
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Progress and hint */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}
        >
          {currentPageNum} / {totalPages}
        </span>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}
        >
          {isTyping ? 'TAP to skip' : 'TAP to continue'}
        </span>
      </div>

      {/* CSS for cursor blink animation */}
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
}

export default DialogOverlay;

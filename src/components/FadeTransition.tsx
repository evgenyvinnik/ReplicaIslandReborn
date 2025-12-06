/**
 * FadeTransition Component - Screen fade effects for transitions
 * Handles fade in/out effects for level changes, game over, etc.
 */

import React, { useEffect, useState } from 'react';

export type FadeState = 'none' | 'fade-out' | 'fade-in' | 'black';

interface FadeTransitionProps {
  state: FadeState;
  duration?: number;
  color?: string;
  onComplete?: () => void;
  children?: React.ReactNode;
}

export function FadeTransition({
  state,
  duration = 500,
  color = '#000000',
  onComplete,
  children,
}: FadeTransitionProps): React.JSX.Element {
  const [opacity, setOpacity] = useState(state === 'black' || state === 'fade-out' ? 1 : 0);
  const [isVisible, setIsVisible] = useState(state !== 'none');

  useEffect(() => {
    if (state === 'none') {
      setIsVisible(false);
      setOpacity(0);
      return;
    }

    setIsVisible(true);

    if (state === 'black') {
      setOpacity(1);
      return;
    }

    if (state === 'fade-out') {
      // Start transparent, end opaque
      setOpacity(0);
      const timeout = setTimeout(() => {
        setOpacity(1);
      }, 50); // Small delay to allow transition to start

      const completeTimeout = setTimeout(() => {
        onComplete?.();
      }, duration + 50);

      return (): void => {
        clearTimeout(timeout);
        clearTimeout(completeTimeout);
      };
    }

    if (state === 'fade-in') {
      // Start opaque, end transparent
      setOpacity(1);
      const timeout = setTimeout(() => {
        setOpacity(0);
      }, 50);

      const completeTimeout = setTimeout(() => {
        onComplete?.();
        setIsVisible(false);
      }, duration + 50);

      return (): void => {
        clearTimeout(timeout);
        clearTimeout(completeTimeout);
      };
    }
  }, [state, duration, onComplete]);

  if (!isVisible && state === 'none') {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: color,
          opacity,
          transition: `opacity ${duration}ms ease-in-out`,
          pointerEvents: state === 'black' ? 'all' : 'none',
          zIndex: 1000,
        }}
      />
    </>
  );
}

/**
 * Hook for managing fade transitions
 */
interface FadeTransitionHook {
  fadeState: FadeState;
  setFadeState: React.Dispatch<React.SetStateAction<FadeState>>;
  fadeOut: (callback?: () => void, fadeDuration?: number) => void;
  fadeIn: (callback?: () => void, fadeDuration?: number) => void;
  fadeOutThenIn: (middleCallback?: () => void, finalCallback?: () => void, fadeDuration?: number) => void;
  duration: number;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
}

export function useFadeTransition(initialDuration = 500): FadeTransitionHook {
  const [fadeState, setFadeState] = useState<FadeState>('none');
  const [duration, setDuration] = useState(initialDuration);

  const fadeOut = (callback?: () => void, fadeDuration?: number): void => {
    if (fadeDuration !== undefined) setDuration(fadeDuration);
    setFadeState('fade-out');
    
    if (callback) {
      setTimeout(() => {
        setFadeState('black');
        callback();
      }, fadeDuration ?? duration);
    }
  };

  const fadeIn = (callback?: () => void, fadeDuration?: number): void => {
    if (fadeDuration !== undefined) setDuration(fadeDuration);
    setFadeState('fade-in');
    
    if (callback) {
      setTimeout(() => {
        setFadeState('none');
        callback();
      }, fadeDuration ?? duration);
    }
  };

  const fadeOutThenIn = (middleCallback?: () => void, finalCallback?: () => void, fadeDuration?: number): void => {
    const dur = fadeDuration ?? duration;
    if (fadeDuration !== undefined) setDuration(fadeDuration);
    
    setFadeState('fade-out');
    
    setTimeout(() => {
      setFadeState('black');
      middleCallback?.();
      
      setTimeout(() => {
        setFadeState('fade-in');
        
        setTimeout(() => {
          setFadeState('none');
          finalCallback?.();
        }, dur);
      }, 100); // Brief pause at black
    }, dur);
  };

  return {
    fadeState,
    setFadeState,
    fadeOut,
    fadeIn,
    fadeOutThenIn,
    duration,
    setDuration,
  };
}

export default FadeTransition;

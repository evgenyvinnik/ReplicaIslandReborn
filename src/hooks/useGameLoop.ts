/**
 * useGameLoop - Custom hook for the game loop
 */

import { useEffect, useRef, useCallback } from 'react';
import { GameLoop } from '../engine/GameLoop';
import { SystemRegistry } from '../engine/SystemRegistry';

interface UseGameLoopOptions {
  onUpdate?: (deltaTime: number) => void;
  onRender?: (interpolation: number) => void;
  autoStart?: boolean;
}

interface UseGameLoopReturn {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isRunning: boolean;
  isPaused: boolean;
  fps: number;
  gameLoop: GameLoop;
  systemRegistry: SystemRegistry;
}

export function useGameLoop(options: UseGameLoopOptions = {}): UseGameLoopReturn {
  const { onUpdate, onRender, autoStart = false } = options;
  
  const gameLoopRef = useRef<GameLoop>(new GameLoop());
  const systemRegistryRef = useRef<SystemRegistry>(new SystemRegistry());
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const fpsRef = useRef(0);

  // Set up callbacks
  useEffect(() => {
    const gameLoop = gameLoopRef.current;
    
    if (onUpdate) {
      gameLoop.setUpdateCallback(onUpdate);
    }
    
    if (onRender) {
      gameLoop.setRenderCallback(onRender);
    }
    
    gameLoop.setSystemRegistry(systemRegistryRef.current);
  }, [onUpdate, onRender]);

  // Auto start if enabled
  useEffect(() => {
    const gameLoop = gameLoopRef.current;
    
    if (autoStart) {
      gameLoop.start();
      isRunningRef.current = true;
    }

    return (): void => {
      gameLoop.stop();
    };
  }, [autoStart]);

  // Update FPS periodically
  useEffect(() => {
    const interval = setInterval(() => {
      fpsRef.current = gameLoopRef.current.getFPS();
    }, 500);

    return (): void => clearInterval(interval);
  }, []);

  const start = useCallback((): void => {
    gameLoopRef.current.start();
    isRunningRef.current = true;
    isPausedRef.current = false;
  }, []);

  const stop = useCallback((): void => {
    gameLoopRef.current.stop();
    isRunningRef.current = false;
    isPausedRef.current = false;
  }, []);

  const pause = useCallback((): void => {
    gameLoopRef.current.pause();
    isPausedRef.current = true;
  }, []);

  const resume = useCallback((): void => {
    gameLoopRef.current.resume();
    isPausedRef.current = false;
  }, []);

  return {
    start,
    stop,
    pause,
    resume,
    isRunning: isRunningRef.current,
    isPaused: isPausedRef.current,
    fps: fpsRef.current,
    gameLoop: gameLoopRef.current,
    systemRegistry: systemRegistryRef.current,
  };
}

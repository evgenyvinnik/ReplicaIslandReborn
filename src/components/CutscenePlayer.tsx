/**
 * CutscenePlayer Component
 * Ported from: Original/src/com/replica/replicaisland/AnimationPlayerActivity.java
 *
 * Handles playing game cutscenes including:
 * - Kyle death animation (frame-by-frame)
 * - Ending cutscenes (parallax scrolling layers)
 * - Touch/click to skip functionality
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CutsceneType,
  getCutscene,
  type CutsceneDefinition,
  type AnimationLayer,
} from '../data/cutscenes';

interface CutscenePlayerProps {
  /** Type of cutscene to play */
  cutsceneType: CutsceneType;
  /** Called when cutscene finishes or is skipped */
  onComplete: () => void;
  /** Canvas width */
  width?: number;
  /** Canvas height */
  height?: number;
}

/**
 * Accelerate-decelerate interpolation function
 * Matches Android's AccelerateDecelerateInterpolator
 */
function accelerateDecelerateInterpolation(t: number): number {
  return (Math.cos((t + 1) * Math.PI) / 2.0) + 0.5;
}

/**
 * Calculate animated value for a layer at current time
 */
function getAnimatedPosition(
  layer: AnimationLayer,
  elapsedTime: number
): { x: number; y: number } {
  // Not started yet
  if (elapsedTime < layer.startOffset) {
    return { x: layer.fromX, y: layer.fromY };
  }

  // Animation complete
  if (elapsedTime >= layer.startOffset + layer.duration) {
    return { x: layer.toX, y: layer.toY };
  }

  // Calculate progress with interpolation
  const progress = (elapsedTime - layer.startOffset) / layer.duration;
  const interpolated = accelerateDecelerateInterpolation(progress);

  return {
    x: layer.fromX + (layer.toX - layer.fromX) * interpolated,
    y: layer.fromY + (layer.toY - layer.fromY) * interpolated,
  };
}

export function CutscenePlayer({
  cutsceneType,
  onComplete,
  width = 480,
  height = 320,
}: CutscenePlayerProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cutscene] = useState<CutsceneDefinition>(() => getCutscene(cutsceneType));
  const [currentFrame, setCurrentFrame] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const frameTimerRef = useRef<number>(0);

  // Preload all images needed for the cutscene
  useEffect(() => {
    const imagesToLoad: string[] = [];

    if (cutscene.frameAnimation) {
      imagesToLoad.push(...cutscene.frameAnimation.frames);
    }

    if (cutscene.layers) {
      cutscene.layers.forEach(layer => {
        if (!imagesToLoad.includes(layer.sprite)) {
          imagesToLoad.push(layer.sprite);
        }
      });
    }

    if (imagesToLoad.length === 0) {
      setIsLoading(false);
      return;
    }

    const loaded = new Map<string, HTMLImageElement>();
    let loadedCount = 0;

    imagesToLoad.forEach(src => {
      const img = new Image();
      img.onload = (): void => {
        loaded.set(src, img);
        loadedCount++;
        if (loadedCount === imagesToLoad.length) {
          setLoadedImages(loaded);
          setIsLoading(false);
        }
      };
      img.onerror = (): void => {
        console.warn(`Failed to load cutscene image: ${src}`);
        loadedCount++;
        if (loadedCount === imagesToLoad.length) {
          setLoadedImages(loaded);
          setIsLoading(false);
        }
      };
      img.src = src;
    });
  }, [cutscene]);

  // Frame animation loop for KYLE_DEATH
  useEffect(() => {
    if (isLoading || !cutscene.frameAnimation) return;

    const { frames, frameDuration, loop } = cutscene.frameAnimation;

    const advanceFrame = (): void => {
      setCurrentFrame(prev => {
        const next = prev + 1;
        if (next >= frames.length) {
          if (loop) {
            return 0;
          }
          // Animation complete
          return frames.length - 1;
        }
        return next;
      });
    };

    frameTimerRef.current = window.setInterval(advanceFrame, frameDuration);

    return (): void => {
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
      }
    };
  }, [isLoading, cutscene.frameAnimation]);

  // Parallax animation loop for ending cutscenes
  useEffect(() => {
    if (isLoading || !cutscene.layers) return;

    startTimeRef.current = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (): void => {
      const elapsedTime = performance.now() - startTimeRef.current;

      // Clear canvas
      ctx.fillStyle = cutscene.backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Sort layers by z-order
      const sortedLayers = [...cutscene.layers!].sort((a, b) => a.zOrder - b.zOrder);

      // Render each layer
      for (const layer of sortedLayers) {
        const img = loadedImages.get(layer.sprite);
        if (!img) continue;

        const pos = getAnimatedPosition(layer, elapsedTime);
        
        // Center the image in the canvas
        const x = (width - img.width) / 2 + pos.x;
        const y = (height - img.height) / 2 + pos.y;

        ctx.drawImage(img, x, y);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return (): void => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading, cutscene.layers, cutscene.backgroundColor, loadedImages, width, height]);

  // Render frame animation to canvas
  useEffect(() => {
    if (isLoading || !cutscene.frameAnimation) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameSrc = cutscene.frameAnimation.frames[currentFrame];
    const img = loadedImages.get(frameSrc);

    // Clear canvas
    ctx.fillStyle = cutscene.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (img) {
      // Center the image
      const x = (width - img.width) / 2;
      const y = (height - img.height) / 2;
      ctx.drawImage(img, x, y);
    }
  }, [isLoading, cutscene.frameAnimation, cutscene.backgroundColor, currentFrame, loadedImages, width, height]);

  // Enable skip after total duration
  useEffect(() => {
    if (isLoading) return;

    const skipTimer = setTimeout(() => {
      setCanSkip(true);
      setShowSkipHint(true);
    }, cutscene.totalDuration);

    return (): void => {
      clearTimeout(skipTimer);
    };
  }, [isLoading, cutscene.totalDuration]);

  // Handle skip input
  const handleSkip = useCallback(() => {
    if (canSkip) {
      onComplete();
    }
  }, [canSkip, onComplete]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSkip]);

  // Auto-complete for frame animation when done
  useEffect(() => {
    if (!cutscene.frameAnimation) return;

    const { frames } = cutscene.frameAnimation;
    if (currentFrame >= frames.length - 1 && canSkip) {
      // Give a brief pause before auto-completing
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return (): void => { clearTimeout(timer); };
    }
  }, [currentFrame, cutscene.frameAnimation, canSkip, onComplete]);

  if (isLoading) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '12px',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        cursor: canSkip ? 'pointer' : 'default',
      }}
      onClick={handleSkip}
      onTouchEnd={handleSkip}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
        }}
      />

      {/* Skip hint */}
      {showSkipHint && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255, 255, 255, 0.6)',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            textAlign: 'center',
            pointerEvents: 'none',
            animation: 'fadeInOut 2s infinite',
          }}
        >
          TAP TO CONTINUE
        </div>
      )}

      {/* CSS animations */}
      <style>
        {`
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.8; }
          }
        `}
      </style>
    </div>
  );
}

export default CutscenePlayer;

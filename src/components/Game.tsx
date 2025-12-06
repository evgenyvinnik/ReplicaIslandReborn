/**
 * Game Component - Main game canvas and loop
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState } from '../types';
import { GameLoop } from '../engine/GameLoop';
import { SystemRegistry } from '../engine/SystemRegistry';
import { RenderSystem } from '../engine/RenderSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem } from '../engine/SoundSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { CollisionSystem } from '../engine/CollisionSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { HotSpotSystem } from '../engine/HotSpotSystem';
import { AnimationSystem } from '../engine/AnimationSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { LevelSystem } from '../levels/LevelSystemNew';
import { TileMapRenderer } from '../levels/TileMapRenderer';
import { HUD } from './HUD';
import { OnScreenControls } from './OnScreenControls';
import { generatePlaceholderTileset } from '../utils/PlaceholderSprites';

interface GameProps {
  width?: number;
  height?: number;
}

export function Game({ width = 480, height = 320 }: GameProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, pauseGame, resumeGame } = useGameContext();
  
  // Systems refs
  const gameLoopRef = useRef<GameLoop | null>(null);
  const systemRegistryRef = useRef<SystemRegistry | null>(null);
  const renderSystemRef = useRef<RenderSystem | null>(null);
  const tileMapRendererRef = useRef<TileMapRenderer | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [fps, setFps] = useState(0);
  const [scale, setScale] = useState(1);
  const [levelLoading, setLevelLoading] = useState(true);

  // Initialize game systems
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create systems
    const systemRegistry = new SystemRegistry();
    systemRegistryRef.current = systemRegistry;

    // Render system
    const renderSystem = new RenderSystem(canvas);
    renderSystem.setSize(width, height);
    renderSystemRef.current = renderSystem;
    systemRegistry.register(renderSystem, 'render');

    // Input system
    const inputSystem = new InputSystem();
    inputSystem.initialize();
    systemRegistry.register(inputSystem, 'input');

    // Sound system
    const soundSystem = new SoundSystem();
    systemRegistry.register(soundSystem, 'sound');

    // Camera system
    const cameraSystem = new CameraSystem(width, height);
    systemRegistry.register(cameraSystem, 'camera');

    // Collision system
    const collisionSystem = new CollisionSystem();
    systemRegistry.register(collisionSystem, 'collision');

    // Time system
    const timeSystem = new TimeSystem();
    systemRegistry.register(timeSystem, 'time');

    // Hot spot system
    const hotSpotSystem = new HotSpotSystem();
    systemRegistry.register(hotSpotSystem, 'hotSpot');

    // Animation system
    const animationSystem = new AnimationSystem();
    animationSystem.registerPlayerAnimations();
    systemRegistry.register(animationSystem, 'animation');

    // Game object manager
    const gameObjectManager = new GameObjectManager();
    gameObjectManager.setCamera(cameraSystem);
    systemRegistry.register(gameObjectManager, 'gameObject');

    // Game object factory
    const factory = new GameObjectFactory(gameObjectManager);
    factory.setRenderSystem(renderSystem);
    factory.setCollisionSystem(collisionSystem);
    factory.setInputSystem(inputSystem);
    systemRegistry.register(factory, 'factory');

    // Level system
    const levelSystem = new LevelSystem();
    levelSystem.setSystems(collisionSystem, gameObjectManager, hotSpotSystem);
    systemRegistry.register(levelSystem, 'level');

    // Tile map renderer
    const tileMapRenderer = new TileMapRenderer();
    tileMapRenderer.setViewport(width, height);
    tileMapRendererRef.current = tileMapRenderer;

    // Placeholder tileset for fallback
    const placeholderTileset = generatePlaceholderTileset(32);
    renderSystem.registerCanvasSprite('tileset', placeholderTileset, 32, 32);

    // Load assets and level
    const initializeGame = async (): Promise<void> => {
      setLevelLoading(true);
      
      try {
        // Load tilesets
        await renderSystem.loadAllTilesets();
        
        // Initialize sound system
        await soundSystem.initialize();
        await soundSystem.preloadAllSounds();
        
        // Load level progress
        levelSystem.loadLevelProgress();
        
        // Try to load the first level (binary format)
        const levelLoaded = await levelSystem.loadLevel(1);
        
        if (levelLoaded) {
          // Initialize tile map renderer from parsed level
          const parsedLevel = levelSystem.getParsedLevel();
          if (parsedLevel) {
            tileMapRenderer.initializeFromLevel(parsedLevel);
          }
          
          // Set camera bounds
          cameraSystem.setBounds({
            minX: 0,
            minY: 0,
            maxX: levelSystem.getLevelWidth() - width,
            maxY: levelSystem.getLevelHeight() - height,
          });
        } else {
          // Fallback: create test level
          createTestLevel(factory, gameObjectManager, renderSystem);
        }
      } catch (error) {
        console.error('Failed to load level:', error);
        // Create test level as fallback
        createTestLevel(factory, gameObjectManager, renderSystem);
      }
      
      setLevelLoading(false);
    };

    // Function to create a test level when binary loading fails
    const createTestLevel = (
      factory: GameObjectFactory,
      gameObjectManager: GameObjectManager,
      _renderSystem: RenderSystem
    ): void => {
      // Spawn player
      const player = factory.spawn(GameObjectType.PLAYER, 100, 200, false);
      if (player) {
        player.type = 'player';
        gameObjectManager.setPlayer(player);
      }

      // Spawn some collectibles
      factory.spawn(GameObjectType.COIN, 200, 200, false);
      factory.spawn(GameObjectType.COIN, 250, 200, false);
      factory.spawn(GameObjectType.PEARL, 300, 180, false);

      // Spawn an enemy
      factory.spawn(GameObjectType.ENEMY_BROBOT, 400, 220, true);
    };

    // Start initialization
    initializeGame();

    // Game loop
    const gameLoop = new GameLoop();
    gameLoopRef.current = gameLoop;
    gameLoop.setSystemRegistry(systemRegistry);

    // Update callback
    gameLoop.setUpdateCallback((deltaTime: number) => {
      if (state.gameState !== GameState.PLAYING) return;

      // Update input
      inputSystem.update();

      // Update time
      timeSystem.update(deltaTime);
      const gameTime = timeSystem.getGameTime();

      // Update game objects
      gameObjectManager.update(deltaTime, gameTime);

      // Update camera
      const player = gameObjectManager.getPlayer();
      if (player) {
        cameraSystem.setTarget(player);
      }
      cameraSystem.update(deltaTime);
    });

    // Render callback
    gameLoop.setRenderCallback((_interpolation: number) => {
      // Render tile map
      if (tileMapRendererRef.current) {
        tileMapRendererRef.current.render(renderSystem, cameraSystem);
      }

      // Render game objects
      gameObjectManager.forEach((obj) => {
        if (obj.isVisible()) {
          renderSystem.drawRect(
            obj.getPosition().x,
            obj.getPosition().y,
            obj.width,
            obj.height,
            obj.type === 'player' ? '#4caf50' : '#f44336',
            0
          );
        }
      });

      // Swap and render
      renderSystem.swap(cameraSystem.getFocusPositionX(), cameraSystem.getFocusPositionY());
    });

    setIsInitialized(true);

    // Start the game loop
    gameLoop.start();

    // FPS counter
    const fpsInterval = setInterval(() => {
      setFps(gameLoop.getFPS());
    }, 500);

    // Cleanup
    return (): void => {
      clearInterval(fpsInterval);
      gameLoop.stop();
      inputSystem.destroy();
      soundSystem.destroy();
    };
  }, [width, height, state.gameState]);

  // Handle resize
  useEffect(() => {
    const handleResize = (): void => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate scale to fit while maintaining aspect ratio
      const scaleX = containerWidth / width;
      const scaleY = containerHeight / height;
      const newScale = Math.min(scaleX, scaleY, 3); // Max 3x scale

      setScale(newScale);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return (): void => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  // Handle visibility change (pause when tab hidden)
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.hidden && state.gameState === GameState.PLAYING) {
        pauseGame();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.gameState, pauseGame]);

  // Handle pause key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (state.gameState === GameState.PLAYING) {
          pauseGame();
        } else if (state.gameState === GameState.PAUSED) {
          resumeGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [state.gameState, pauseGame, resumeGame]);

  // Prevent context menu on canvas
  const handleContextMenu = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: width * scale,
          height: height * scale,
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onContextMenu={handleContextMenu}
          style={{
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated',
            display: 'block',
          }}
        />
        
        {isInitialized && !levelLoading && (
          <>
            <HUD fps={fps} showFPS={state.config.debugMode} />
            <OnScreenControls
              onMovementChange={(direction: number): void => {
                // Handle horizontal movement from slider
                const inputSystem = systemRegistryRef.current?.inputSystem;
                if (inputSystem) {
                  inputSystem.setVirtualAxis('horizontal', direction);
                }
              }}
              onFlyPressed={(): void => {
                const inputSystem = systemRegistryRef.current?.inputSystem;
                if (inputSystem) {
                  inputSystem.setVirtualButton('fly', true);
                }
              }}
              onFlyReleased={(): void => {
                const inputSystem = systemRegistryRef.current?.inputSystem;
                if (inputSystem) {
                  inputSystem.setVirtualButton('fly', false);
                }
              }}
              onStompPressed={(): void => {
                const inputSystem = systemRegistryRef.current?.inputSystem;
                if (inputSystem) {
                  inputSystem.setVirtualButton('stomp', true);
                }
              }}
              onStompReleased={(): void => {
                const inputSystem = systemRegistryRef.current?.inputSystem;
                if (inputSystem) {
                  inputSystem.setVirtualButton('stomp', false);
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

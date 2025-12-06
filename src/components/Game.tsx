/**
 * Game Component - Main game canvas and loop
 * Fully integrated game with proper rendering and physics
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState } from '../types';
import { GameLoop } from '../engine/GameLoop';
import { SystemRegistry } from '../engine/SystemRegistry';
import { RenderSystem } from '../engine/RenderSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem, SoundEffects } from '../engine/SoundSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { CollisionSystem } from '../engine/CollisionSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { HotSpotSystem, HotSpotType } from '../engine/HotSpotSystem';
import { AnimationSystem } from '../engine/AnimationSystem';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { LevelSystem } from '../levels/LevelSystemNew';
import { TileMapRenderer } from '../levels/TileMapRenderer';
import { HUD } from './HUD';
import { OnScreenControls } from './OnScreenControls';
import { generatePlaceholderTileset } from '../utils/PlaceholderSprites';
import { gameSettings } from '../utils/GameSettings';

interface GameProps {
  width?: number;
  height?: number;
}

// Player physics constants (from original PlayerComponent.java)
const PLAYER = {
  GROUND_IMPULSE_SPEED: 5000,
  AIR_HORIZONTAL_IMPULSE_SPEED: 4000,
  AIR_VERTICAL_IMPULSE_SPEED: 1200,
  AIR_VERTICAL_IMPULSE_FROM_GROUND: 250,
  MAX_GROUND_HORIZONTAL_SPEED: 500,
  MAX_AIR_HORIZONTAL_SPEED: 150,
  MAX_UPWARD_SPEED: 250,
  JUMP_TO_JETS_DELAY: 0.5,
  STOMP_VELOCITY: -1000,
  AIR_DRAG_SPEED: 4000,
  GRAVITY: 500,
  FUEL_AMOUNT: 1.0,
  WIDTH: 48,
  HEIGHT: 48,
};

export function Game({ width = 480, height = 320 }: GameProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, pauseGame, resumeGame } = useGameContext();
  
  // Systems refs
  const gameLoopRef = useRef<GameLoop | null>(null);
  const systemRegistryRef = useRef<SystemRegistry | null>(null);
  const renderSystemRef = useRef<RenderSystem | null>(null);
  const soundSystemRef = useRef<SoundSystem | null>(null);
  const tileMapRendererRef = useRef<TileMapRenderer | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  
  // Player state ref for physics
  const playerStateRef = useRef({
    fuel: PLAYER.FUEL_AMOUNT,
    jumpTime: 0,
    touchingGround: false,
    rocketsOn: false,
    stomping: false,
    stompTime: 0,
  });
  
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
    soundSystemRef.current = soundSystem;
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

    // Load background image helper
    const loadBackgroundImage = (imageName: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = (): void => resolve(img);
        img.onerror = (): void => reject(new Error(`Failed to load ${imageName}`));
        img.src = `/assets/sprites/${imageName}.png`;
      });
    };

    // Load player sprite sheets
    const loadPlayerSprites = async (): Promise<void> => {
      const sprites = [
        { name: 'andou_stand', file: 'andou_stand' },
        { name: 'andou_flyup01', file: 'andou_flyup01' },
        { name: 'andou_flyup02', file: 'andou_flyup02' },
        { name: 'andou_flyup03', file: 'andou_flyup03' },
        { name: 'andou_fall01', file: 'andou_fall01' },
        { name: 'andou_fall02', file: 'andou_fall02' },
        { name: 'andou_stomp01', file: 'andou_stomp01' },
        { name: 'andou_stomp02', file: 'andou_stomp02' },
        { name: 'andou_hit', file: 'andou_hit' },
      ];

      const loadPromises = sprites.map(sprite =>
        renderSystem.loadSprite(sprite.name, `/assets/sprites/${sprite.file}.png`, 64, 64)
          .catch(err => console.warn(`Failed to load sprite ${sprite.name}:`, err))
      );

      await Promise.all(loadPromises);
    };

    // Load collectible sprites
    const loadCollectibleSprites = async (): Promise<void> => {
      const sprites = [
        { name: 'coin01', file: 'object_coin01', w: 32, h: 32 },
        { name: 'ruby01', file: 'object_ruby01', w: 32, h: 32 },
        { name: 'diary01', file: 'object_diary01', w: 32, h: 32 },
      ];

      const loadPromises = sprites.map(sprite =>
        renderSystem.loadSprite(sprite.name, `/assets/sprites/${sprite.file}.png`, sprite.w, sprite.h)
          .catch(err => console.warn(`Failed to load sprite ${sprite.name}:`, err))
      );

      await Promise.all(loadPromises);
    };

    // Load assets and level
    const initializeGame = async (): Promise<void> => {
      setLevelLoading(true);
      
      try {
        // Load tilesets
        await renderSystem.loadAllTilesets();
        
        // Load player sprites
        await loadPlayerSprites();
        
        // Load collectible sprites
        await loadCollectibleSprites();
        
        // Initialize sound system
        await soundSystem.initialize();
        await soundSystem.preloadAllSounds();
        
        // Apply sound settings
        const settings = gameSettings.getAll();
        soundSystem.setEnabled(settings.soundEnabled);
        soundSystem.setSfxVolume(settings.soundVolume);
        soundSystem.setMusicVolume(settings.musicVolume);
        
        // Load level progress
        levelSystem.loadLevelProgress();
        
        // Try to load the first level (binary format)
        const levelLoaded = await levelSystem.loadLevel(1);
        
        if (levelLoaded) {
          // Initialize tile map renderer from parsed level
          const parsedLevel = levelSystem.getParsedLevel();
          if (parsedLevel) {
            tileMapRenderer.initializeFromLevel(parsedLevel);
            
            // Load background image
            try {
              const bgImage = await loadBackgroundImage(parsedLevel.backgroundImage);
              backgroundImageRef.current = bgImage;
            } catch {
              console.warn('Failed to load background image');
            }
          }
          
          // Set camera bounds
          cameraSystem.setBounds({
            minX: 0,
            minY: 0,
            maxX: Math.max(0, levelSystem.getLevelWidth() - width),
            maxY: Math.max(0, levelSystem.getLevelHeight() - height),
          });
        } else {
          // Fallback: create test level
          createTestLevel(factory, gameObjectManager, collisionSystem);
        }
      } catch (error) {
        console.error('Failed to load level:', error);
        // Create test level as fallback
        createTestLevel(factory, gameObjectManager, collisionSystem);
      }
      
      setLevelLoading(false);
    };

    // Function to create a test level when binary loading fails
    const createTestLevel = (
      factory: GameObjectFactory,
      gameObjectManager: GameObjectManager,
      collisionSystem: CollisionSystem
    ): void => {
      // Create simple floor collision
      const testWidth = 30;
      const testHeight = 15;
      const tiles: number[] = [];
      for (let y = 0; y < testHeight; y++) {
        for (let x = 0; x < testWidth; x++) {
          // Floor at bottom, walls on sides
          if (y === testHeight - 1 || x === 0 || x === testWidth - 1) {
            tiles.push(1); // Solid
          } else if (y === testHeight - 3 && x > 5 && x < 15) {
            tiles.push(1); // Platform
          } else {
            tiles.push(0); // Empty
          }
        }
      }
      collisionSystem.setTileCollision(tiles, testWidth, testHeight, 32, 32);

      // Spawn player
      const player = factory.spawn(GameObjectType.PLAYER, 100, 320, false);
      if (player) {
        player.type = 'player';
        player.width = PLAYER.WIDTH;
        player.height = PLAYER.HEIGHT;
        gameObjectManager.setPlayer(player);
      }

      // Spawn some collectibles
      factory.spawn(GameObjectType.COIN, 200, 350, false);
      factory.spawn(GameObjectType.COIN, 250, 350, false);
      factory.spawn(GameObjectType.PEARL, 300, 300, false);
    };

    // Start initialization
    initializeGame();

    // Game loop
    const gameLoop = new GameLoop();
    gameLoopRef.current = gameLoop;
    gameLoop.setSystemRegistry(systemRegistry);

    // Update callback - Full game physics
    gameLoop.setUpdateCallback((deltaTime: number) => {
      if (state.gameState !== GameState.PLAYING) return;

      // Update input
      inputSystem.update();

      // Update time
      timeSystem.update(deltaTime);
      const gameTime = timeSystem.getGameTime();

      // Get player and input state
      const player = gameObjectManager.getPlayer();
      const input = inputSystem.getInputState();
      
      if (player) {
        // Player physics update (based on original PlayerComponent.java)
        updatePlayerPhysics(player, input, deltaTime, gameTime, collisionSystem, soundSystem);
      }

      // Update all game objects
      gameObjectManager.update(deltaTime, gameTime);

      // Check hot spots
      if (player && hotSpotSystem) {
        const px = player.getPosition().x + player.width / 2;
        const py = player.getPosition().y + player.height / 2;
        const hotSpot = hotSpotSystem.getHotSpot(px, py);
        
        if (hotSpot === HotSpotType.DIE) {
          // Player death
          soundSystem.playSfx(SoundEffects.EXPLODE);
        } else if (hotSpot === HotSpotType.END_LEVEL) {
          // Level complete
          soundSystem.playSfx(SoundEffects.DING);
        }
      }

      // Check collectible pickups
      if (player) {
        const playerPos = player.getPosition();
        const playerRect = {
          x: playerPos.x,
          y: playerPos.y,
          width: player.width,
          height: player.height,
        };
        
        gameObjectManager.forEach((obj) => {
          if (obj === player || !obj.isVisible()) return;
          
          // Check if collectible
          if (obj.type === 'coin' || obj.type === 'ruby' || obj.type === 'pearl' || obj.type === 'diary') {
            const objPos = obj.getPosition();
            const objRect = {
              x: objPos.x,
              y: objPos.y,
              width: obj.width,
              height: obj.height,
            };
            
            // Simple AABB collision
            if (playerRect.x < objRect.x + objRect.width &&
                playerRect.x + playerRect.width > objRect.x &&
                playerRect.y < objRect.y + objRect.height &&
                playerRect.y + playerRect.height > objRect.y) {
              // Collected!
              obj.setVisible(false);
              
              // Play sound based on type
              if (obj.type === 'coin') {
                soundSystem.playSfx(SoundEffects.GEM1, 0.5);
              } else if (obj.type === 'ruby' || obj.type === 'pearl') {
                soundSystem.playSfx(SoundEffects.GEM2, 0.5);
              } else if (obj.type === 'diary') {
                soundSystem.playSfx(SoundEffects.DING, 0.5);
              }
            }
          }
        });
      }

      // Update camera to follow player
      if (player) {
        cameraSystem.setTarget(player);
      }
      cameraSystem.update(deltaTime);
    });

    // Player physics update function
    const updatePlayerPhysics = (
      player: ReturnType<typeof gameObjectManager.getPlayer>,
      input: ReturnType<typeof inputSystem.getInputState>,
      deltaTime: number,
      gameTime: number,
      collisionSys: CollisionSystem,
      soundSys: SoundSystem
    ): void => {
      if (!player) return;

      const pState = playerStateRef.current;
      const velocity = player.getVelocity();
      const position = player.getPosition();

      // Check if grounded
      pState.touchingGround = player.touchingGround();

      // Refuel when on ground
      if (pState.fuel < PLAYER.FUEL_AMOUNT) {
        if (pState.touchingGround) {
          pState.fuel += 2.0 * deltaTime;
        } else {
          pState.fuel += 0.5 * deltaTime;
        }
        pState.fuel = Math.min(PLAYER.FUEL_AMOUNT, pState.fuel);
      }

      // Horizontal movement
      let moveX = 0;
      if (input.left) moveX -= 1;
      if (input.right) moveX += 1;

      const inTheAir = !pState.touchingGround;
      const horizontalSpeed = inTheAir ? PLAYER.AIR_HORIZONTAL_IMPULSE_SPEED : PLAYER.GROUND_IMPULSE_SPEED;
      const maxHorizontalSpeed = inTheAir ? PLAYER.MAX_AIR_HORIZONTAL_SPEED : PLAYER.MAX_GROUND_HORIZONTAL_SPEED;

      // Apply horizontal impulse
      if (moveX !== 0) {
        const impulseX = moveX * horizontalSpeed * deltaTime;
        const newSpeed = Math.abs(velocity.x + impulseX);
        
        if (newSpeed <= maxHorizontalSpeed) {
          velocity.x += impulseX;
        } else if (Math.abs(velocity.x) < maxHorizontalSpeed) {
          velocity.x = maxHorizontalSpeed * moveX;
        }

        // Update facing direction
        player.facingDirection.x = moveX;
      }

      // Air drag
      if (inTheAir && Math.abs(velocity.x) > maxHorizontalSpeed) {
        const drag = PLAYER.AIR_DRAG_SPEED * deltaTime * Math.sign(velocity.x);
        velocity.x -= drag;
        if (Math.abs(velocity.x) < maxHorizontalSpeed) {
          velocity.x = maxHorizontalSpeed * Math.sign(velocity.x);
        }
      }

      // Jump/Fly (combined in one button)
      if (input.jump) {
        if (pState.touchingGround && !pState.rocketsOn) {
          // Initial jump from ground
          velocity.y = -PLAYER.AIR_VERTICAL_IMPULSE_FROM_GROUND;
          pState.jumpTime = gameTime;
          soundSys.playSfx(SoundEffects.POING, 0.5);
        } else if (gameTime > pState.jumpTime + PLAYER.JUMP_TO_JETS_DELAY) {
          // Jet pack
          if (pState.fuel > 0) {
            pState.fuel -= deltaTime;
            velocity.y += -PLAYER.AIR_VERTICAL_IMPULSE_SPEED * deltaTime;
            pState.rocketsOn = true;
            
            // Cap upward speed
            if (velocity.y < -PLAYER.MAX_UPWARD_SPEED) {
              velocity.y = -PLAYER.MAX_UPWARD_SPEED;
            }
          }
        }
      } else {
        pState.rocketsOn = false;
      }

      // Stomp attack
      if (input.attack && inTheAir && !pState.stomping) {
        pState.stomping = true;
        pState.stompTime = gameTime;
        velocity.y = PLAYER.STOMP_VELOCITY;
        soundSys.playSfx(SoundEffects.STOMP);
      }

      // Reset stomp when landing
      if (pState.stomping && pState.touchingGround) {
        pState.stomping = false;
        // Could add screen shake here
      }

      // Apply gravity
      velocity.y += PLAYER.GRAVITY * deltaTime;

      // Clamp velocity
      velocity.x = Math.max(-PLAYER.MAX_GROUND_HORIZONTAL_SPEED, Math.min(PLAYER.MAX_GROUND_HORIZONTAL_SPEED, velocity.x));
      velocity.y = Math.max(-PLAYER.MAX_UPWARD_SPEED * 2, Math.min(1000, velocity.y));

      // Friction on ground
      if (pState.touchingGround && moveX === 0) {
        velocity.x *= 0.85;
        if (Math.abs(velocity.x) < 1) velocity.x = 0;
      }

      // Move player (simple integration)
      const newX = position.x + velocity.x * deltaTime;
      const newY = position.y + velocity.y * deltaTime;

      // Check collision
      const collision = collisionSys.checkTileCollision(
        newX, newY, player.width, player.height, velocity.x, velocity.y
      );

      // Apply collision response
      if (collision.grounded) {
        // Snap to ground
        const tileSize = 32;
        const groundY = Math.floor((newY + player.height) / tileSize) * tileSize - player.height;
        position.y = groundY;
        velocity.y = 0;
        player.setLastTouchedFloorTime(gameTime);
      } else {
        position.y = newY;
      }

      if (collision.ceiling) {
        velocity.y = Math.max(0, velocity.y);
        player.setLastTouchedCeilingTime(gameTime);
      }

      if (collision.leftWall) {
        velocity.x = Math.max(0, velocity.x);
        player.setLastTouchedLeftWallTime(gameTime);
      } else if (collision.rightWall) {
        velocity.x = Math.min(0, velocity.x);
        player.setLastTouchedRightWallTime(gameTime);
      }

      if (!collision.leftWall && !collision.rightWall) {
        position.x = newX;
      }

      player.setBackgroundCollisionNormal(collision.normal);
    };

    // Render callback
    gameLoop.setRenderCallback((): void => {
      // Clear canvas
      renderSystem.clear('#1a1a2e');

      // Draw scrolling background image
      const bgImage = backgroundImageRef.current;
      if (bgImage) {
        const ctx = (renderSystem as unknown as { ctx: CanvasRenderingContext2D }).ctx;
        const cameraX = cameraSystem.getFocusPositionX() - width / 2;
        const cameraY = cameraSystem.getFocusPositionY() - height / 2;
        
        // Simple parallax - background scrolls at 0.5x speed
        const bgScrollX = -(cameraX * 0.3) % bgImage.width;
        const bgScrollY = -(cameraY * 0.1);
        
        // Draw background tiled if needed
        ctx.save();
        for (let x = bgScrollX - bgImage.width; x < width + bgImage.width; x += bgImage.width) {
          ctx.drawImage(bgImage, x, bgScrollY, bgImage.width, bgImage.height);
        }
        ctx.restore();
      }

      // Render tile map
      if (tileMapRendererRef.current) {
        tileMapRendererRef.current.render(renderSystem, cameraSystem);
      }

      // Render game objects
      const player = gameObjectManager.getPlayer();
      
      gameObjectManager.forEach((obj) => {
        if (!obj.isVisible()) return;
        
        const pos = obj.getPosition();
        const isPlayer = obj === player;
        
        if (isPlayer) {
          // Determine player sprite based on state
          const pState = playerStateRef.current;
          let spriteName = 'andou_stand';
          
          if (pState.stomping) {
            spriteName = 'andou_stomp01';
          } else if (pState.rocketsOn) {
            spriteName = 'andou_flyup01';
          } else if (!pState.touchingGround) {
            const vel = obj.getVelocity();
            spriteName = vel.y < 0 ? 'andou_flyup02' : 'andou_fall01';
          }
          
          // Draw player sprite or fallback rectangle
          if (renderSystem.hasSprite(spriteName)) {
            const scaleX = obj.facingDirection.x < 0 ? -1 : 1;
            renderSystem.drawSprite(spriteName, pos.x - 8, pos.y - 8, 0, 10, 1, scaleX, 1);
          } else {
            // Fallback green rectangle for player
            renderSystem.drawRect(pos.x, pos.y, obj.width, obj.height, '#4caf50', 10);
          }
        } else {
          // Draw other objects
          let color = '#ff6b6b'; // Default enemy color
          
          switch (obj.type) {
            case 'coin':
              color = '#ffd700';
              break;
            case 'ruby':
            case 'pearl':
              color = '#ff69b4';
              break;
            case 'enemy':
              color = '#ff4444';
              break;
            case 'npc':
              color = '#44aaff';
              break;
            case 'door':
              color = '#8844ff';
              break;
            default:
              color = '#888888';
          }
          
          renderSystem.drawRect(pos.x, pos.y, obj.width, obj.height, color, 5);
        }
      });

      // Draw HUD fuel bar
      const pState = playerStateRef.current;
      const fuelPercent = pState.fuel / PLAYER.FUEL_AMOUNT;
      renderSystem.drawRect(10, 10, 100, 10, '#333333', 100, 0.8);
      renderSystem.drawRect(10, 10, 100 * fuelPercent, 10, '#44ff44', 101, 0.9);

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
  }, [width, height, state.gameState, pauseGame, resumeGame]);

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

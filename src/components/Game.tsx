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
import { DialogOverlay } from './DialogOverlay';
import { PauseMenu } from './PauseMenu';
import { GameOverScreen } from './GameOverScreen';
import { LevelCompleteScreen } from './LevelCompleteScreen';
import { generatePlaceholderTileset } from '../utils/PlaceholderSprites';
import { gameSettings } from '../utils/GameSettings';
import { setInventory, resetInventory, getInventory } from '../entities/components/InventoryComponent';
import { getDialogsForLevel, type Dialog } from '../data/dialogs';

interface GameProps {
  width?: number;
  height?: number;
}

// Player physics constants (from original PlayerComponent.java)
// Note: In canvas coordinates, positive Y is DOWN, negative Y is UP
// The original Java code used a coordinate system where positive Y was UP
const PLAYER = {
  GROUND_IMPULSE_SPEED: 5000,
  AIR_HORIZONTAL_IMPULSE_SPEED: 4000,
  AIR_VERTICAL_IMPULSE_SPEED: 1200,
  AIR_VERTICAL_IMPULSE_FROM_GROUND: 250,
  MAX_GROUND_HORIZONTAL_SPEED: 500,
  MAX_AIR_HORIZONTAL_SPEED: 150,
  MAX_UPWARD_SPEED: 250,
  JUMP_TO_JETS_DELAY: 0.5,
  STOMP_VELOCITY: 1000, // Positive = downward in canvas coordinates (was -1000 in original which had Y-up)
  AIR_DRAG_SPEED: 4000,
  GRAVITY: 500,
  FUEL_AMOUNT: 1.0,
  WIDTH: 48,
  HEIGHT: 48,
};

export function Game({ width = 480, height = 320 }: GameProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, pauseGame, resumeGame, gameOver, completeLevel, setLevel } = useGameContext();
  
  // Systems refs
  const gameLoopRef = useRef<GameLoop | null>(null);
  const systemRegistryRef = useRef<SystemRegistry | null>(null);
  const renderSystemRef = useRef<RenderSystem | null>(null);
  const soundSystemRef = useRef<SoundSystem | null>(null);
  const tileMapRendererRef = useRef<TileMapRenderer | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const levelSystemRef = useRef<LevelSystem | null>(null);
  
  // Player spawn point (set when level loads)
  const playerSpawnRef = useRef({ x: 100, y: 320 });
  
  // Player state ref for physics
  const playerStateRef = useRef({
    fuel: PLAYER.FUEL_AMOUNT,
    jumpTime: 0,
    touchingGround: false,
    rocketsOn: false,
    stomping: false,
    stompTime: 0,
    invincible: false,
    invincibleTime: 0,
    lastHitTime: 0,
    // Animation state
    animFrame: 0,
    animTimer: 0,
    lastAnimState: '',
    // Death/respawn state
    isDying: false,
    deathTime: 0,
  });
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [fps, setFps] = useState(0);
  const [scale, setScale] = useState(1);
  const [levelLoading, setLevelLoading] = useState(true);
  const [playerFuel, setPlayerFuel] = useState(PLAYER.FUEL_AMOUNT);
  
  // Use ref for current level to avoid dependency issues
  const currentLevelRef = useRef(state.currentLevel);
  currentLevelRef.current = state.currentLevel;
  
  // Game settings state - subscribe to changes
  const [currentSettings, setCurrentSettings] = useState(gameSettings.getAll());
  
  // Input state for on-screen controls sync (keyboard/gamepad -> UI)
  const [inputUIState, setInputUIState] = useState({
    flyActive: false,
    stompActive: false,
    leftActive: false,
    rightActive: false,
  });
  
  // Dialog state
  const [activeDialog, setActiveDialog] = useState<Dialog | null>(null);
  const activeDialogRef = useRef<Dialog | null>(null);
  const dialogTriggerCooldownRef = useRef(0);
  const hasShownIntroDialogRef = useRef(false);
  const introDialogTimeoutRef = useRef<number | null>(null);

  // Sync ref with state
  useEffect(() => {
    activeDialogRef.current = activeDialog;
  }, [activeDialog]);

  const gameStateRef = useRef(state.gameState);
  useEffect(() => {
    gameStateRef.current = state.gameState;
  }, [state.gameState]);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = gameSettings.subscribe((settings) => {
      setCurrentSettings(settings);
      // Apply sound settings immediately
      const soundSystem = systemRegistryRef.current?.soundSystem;
      if (soundSystem) {
        soundSystem.setEnabled(settings.soundEnabled);
        // Convert 0-100 to 0-1
        soundSystem.setSfxVolume(settings.soundVolume / 100);
      }
    });
    return unsubscribe;
  }, []);

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
    levelSystemRef.current = levelSystem;

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

    // Load player sprite sheets (matching original game sprites)
    const loadPlayerSprites = async (): Promise<void> => {
      const sprites = [
        // Idle
        { name: 'andou_stand', file: 'andou_stand' },
        // Movement (diagonal poses)
        { name: 'andou_diag01', file: 'andou_diag01' },
        { name: 'andou_diag02', file: 'andou_diag02' },
        { name: 'andou_diag03', file: 'andou_diag03' },
        // Fast movement (extreme diagonal poses)
        { name: 'andou_diagmore01', file: 'andou_diagmore01' },
        { name: 'andou_diagmore02', file: 'andou_diagmore02' },
        { name: 'andou_diagmore03', file: 'andou_diagmore03' },
        // Boost up (flying straight up)
        { name: 'andou_flyup01', file: 'andou_flyup01' },
        { name: 'andou_flyup02', file: 'andou_flyup02' },
        { name: 'andou_flyup03', file: 'andou_flyup03' },
        // Stomp attack (4 frame animation)
        { name: 'andou_stomp01', file: 'andou_stomp01' },
        { name: 'andou_stomp02', file: 'andou_stomp02' },
        { name: 'andou_stomp03', file: 'andou_stomp03' },
        { name: 'andou_stomp04', file: 'andou_stomp04' },
        // Hit reaction
        { name: 'andou_hit', file: 'andou_hit' },
        // Death animation
        { name: 'andou_die01', file: 'andou_die01' },
        { name: 'andou_die02', file: 'andou_die02' },
      ];

      const loadPromises = sprites.map(sprite =>
        renderSystem.loadSprite(sprite.name, `/assets/sprites/${sprite.file}.png`, 64, 64)
          .catch(err => console.warn(`Failed to load sprite ${sprite.name}:`, err))
      );

      await Promise.all(loadPromises);
    };

    // Load collectible sprites (with animation frames)
    const loadCollectibleSprites = async (): Promise<void> => {
      const sprites = [
        // Coins - 5 animation frames
        { name: 'coin01', file: 'object_coin01', w: 32, h: 32 },
        { name: 'coin02', file: 'object_coin02', w: 32, h: 32 },
        { name: 'coin03', file: 'object_coin03', w: 32, h: 32 },
        { name: 'coin04', file: 'object_coin04', w: 32, h: 32 },
        { name: 'coin05', file: 'object_coin05', w: 32, h: 32 },
        // Rubies - 5 animation frames
        { name: 'ruby01', file: 'object_ruby01', w: 32, h: 32 },
        { name: 'ruby02', file: 'object_ruby02', w: 32, h: 32 },
        { name: 'ruby03', file: 'object_ruby03', w: 32, h: 32 },
        { name: 'ruby04', file: 'object_ruby04', w: 32, h: 32 },
        { name: 'ruby05', file: 'object_ruby05', w: 32, h: 32 },
        // Diary
        { name: 'diary01', file: 'object_diary01', w: 32, h: 32 },
      ];

      const loadPromises = sprites.map(sprite =>
        renderSystem.loadSprite(sprite.name, `/assets/sprites/${sprite.file}.png`, sprite.w, sprite.h)
          .catch(err => console.warn(`Failed to load sprite ${sprite.name}:`, err))
      );

      await Promise.all(loadPromises);
    };

    // Load enemy sprites
    const loadEnemySprites = async (): Promise<void> => {
      const sprites = [
        // Bat enemy - 4 frames
        { name: 'bat01', file: 'enemy_bat01', w: 64, h: 64 },
        { name: 'bat02', file: 'enemy_bat02', w: 64, h: 64 },
        { name: 'bat03', file: 'enemy_bat03', w: 64, h: 64 },
        { name: 'bat04', file: 'enemy_bat04', w: 64, h: 64 },
        // Sting enemy - 3 frames
        { name: 'sting01', file: 'enemy_sting01', w: 64, h: 64 },
        { name: 'sting02', file: 'enemy_sting02', w: 64, h: 64 },
        { name: 'sting03', file: 'enemy_sting03', w: 64, h: 64 },
        // Onion enemy - 3 frames
        { name: 'onion01', file: 'enemy_onion01', w: 64, h: 64 },
        { name: 'onion02', file: 'enemy_onion02', w: 64, h: 64 },
        { name: 'onion03', file: 'enemy_onion03', w: 64, h: 64 },
        // Brobot enemy - idle & walk
        { name: 'brobot_idle01', file: 'enemy_brobot_idle01', w: 64, h: 64 },
        { name: 'brobot_idle02', file: 'enemy_brobot_idle02', w: 64, h: 64 },
        { name: 'brobot_idle03', file: 'enemy_brobot_idle03', w: 64, h: 64 },
        { name: 'brobot_walk01', file: 'enemy_brobot_walk01', w: 64, h: 64 },
        { name: 'brobot_walk02', file: 'enemy_brobot_walk02', w: 64, h: 64 },
        { name: 'brobot_walk03', file: 'enemy_brobot_walk03', w: 64, h: 64 },
        // Skeleton enemy
        { name: 'skeleton_stand', file: 'enemy_skeleton_stand', w: 64, h: 64 },
        { name: 'skeleton_walk01', file: 'enemy_skeleton_walk01', w: 64, h: 64 },
        { name: 'skeleton_walk02', file: 'enemy_skeleton_walk02', w: 64, h: 64 },
        { name: 'skeleton_walk03', file: 'enemy_skeleton_walk03', w: 64, h: 64 },
        { name: 'skeleton_walk04', file: 'enemy_skeleton_walk04', w: 64, h: 64 },
        { name: 'skeleton_walk05', file: 'enemy_skeleton_walk05', w: 64, h: 64 },
        // Karaguin enemy - 3 frames
        { name: 'karaguin01', file: 'enemy_karaguin01', w: 64, h: 64 },
        { name: 'karaguin02', file: 'enemy_karaguin02', w: 64, h: 64 },
        { name: 'karaguin03', file: 'enemy_karaguin03', w: 64, h: 64 },
        // Mud/Mudman enemy
        { name: 'mudman_stand', file: 'enemy_mud_stand', w: 64, h: 64 },
        { name: 'mudman_idle01', file: 'enemy_mud_idle01', w: 64, h: 64 },
        { name: 'mudman_idle02', file: 'enemy_mud_idle02', w: 64, h: 64 },
        { name: 'mudman_walk01', file: 'enemy_mud_walk01', w: 64, h: 64 },
        { name: 'mudman_walk02', file: 'enemy_mud_walk02', w: 64, h: 64 },
        { name: 'mudman_walk03', file: 'enemy_mud_walk03', w: 64, h: 64 },
        // Shadow Slime enemy
        { name: 'shadowslime_stand', file: 'enemy_shadowslime_stand', w: 64, h: 64 },
        { name: 'shadowslime_idle01', file: 'enemy_shadowslime_idle01', w: 64, h: 64 },
        { name: 'shadowslime_idle02', file: 'enemy_shadowslime_idle02', w: 64, h: 64 },
        // NPC sprites
        { name: 'wanda_stand', file: 'enemy_wanda_stand', w: 64, h: 64 },
        { name: 'kyle_stand', file: 'enemy_kyle_stand', w: 64, h: 64 },
        { name: 'kabocha_stand', file: 'enemy_kabocha_stand', w: 64, h: 64 },
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
      
      // Reset inventory for new game
      resetInventory();
      
      try {
        // Load tilesets
        await renderSystem.loadAllTilesets();
        
        // Load player sprites
        await loadPlayerSprites();
        
        // Load collectible sprites
        await loadCollectibleSprites();
        
        // Load enemy sprites
        await loadEnemySprites();
        
        // Initialize sound system
        await soundSystem.initialize();
        await soundSystem.preloadAllSounds();
        
        // Apply sound settings
        const settings = gameSettings.getAll();
        soundSystem.setEnabled(settings.soundEnabled);
        // Convert 0-100 to 0-1
        soundSystem.setSfxVolume(settings.soundVolume / 100);
        
        // Load level progress
        levelSystem.loadLevelProgress();
        
        // Get the current level from ref (or default to 1)
        const levelToLoad = currentLevelRef.current || 1;
        
        // Try to load the level (binary format)
        const levelLoaded = await levelSystem.loadLevel(levelToLoad);
        
        if (levelLoaded) {
          // Store player spawn position from level system
          playerSpawnRef.current = { ...levelSystem.playerSpawnPosition };
          
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
          
          // Set camera bounds - these are world bounds, not viewport-adjusted
          // CameraSystem will handle viewport offset internally
          cameraSystem.setBounds({
            minX: 0,
            minY: 0,
            maxX: levelSystem.getLevelWidth(),
            maxY: levelSystem.getLevelHeight(),
          });
          
          // Show intro dialog for this level (if any) - only once
          const levelInfo = levelSystem.getLevelInfo(levelToLoad);
          console.warn('Level info:', levelInfo);
          if (levelInfo && !hasShownIntroDialogRef.current) {
            const dialogs = getDialogsForLevel(levelInfo.file);
            console.warn('Dialogs for level:', levelInfo.file, dialogs);
            if (dialogs.length > 0) {
              // Show the first dialog (intro) after a short delay to ensure render is ready
              console.warn('Setting active dialog:', dialogs[0]);
              hasShownIntroDialogRef.current = true;
              // Use setTimeout to ensure the dialog shows after React has finished rendering
              introDialogTimeoutRef.current = window.setTimeout(() => {
                setActiveDialog(dialogs[0]);
              }, 100);
            }
          }
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
      if (gameStateRef.current !== GameState.PLAYING) return;

      // Update input
      inputSystem.update();

      // Update time
      timeSystem.update(deltaTime);
      const gameTime = timeSystem.getGameTime();

      // Get player and input state
      const player = gameObjectManager.getPlayer();
      const input = inputSystem.getInputState();
      
      // Update input UI state for on-screen controls synchronization
      setInputUIState({
        flyActive: inputSystem.isJumpActive(),
        stompActive: inputSystem.isAttackActive(),
        leftActive: inputSystem.isMovingLeft(),
        rightActive: inputSystem.isMovingRight(),
      });
      
      if (player) {
        // Player physics update (based on original PlayerComponent.java)
        updatePlayerPhysics(player, input, deltaTime, gameTime, collisionSystem, soundSystem);
      }

      // Update all game objects
      gameObjectManager.update(deltaTime, gameTime);

      // Enemy AI - Different behaviors based on subType
      gameObjectManager.forEach((obj) => {
        if (obj.type !== 'enemy' || !obj.isVisible() || obj.life <= 0) return;
        
        // Initialize patrol direction if not set
        if (obj.facingDirection.x === 0) {
          obj.facingDirection.x = 1;
        }
        
        const velocity = obj.getVelocity();
        const position = obj.getPosition();
        
        // Get player position for tracking enemies
        const playerPos = player?.getPosition();
        
        // Behavior based on enemy type
        switch (obj.subType) {
          case 'bat':
          case 'sting': {
            // Flying enemies - swoop towards player when close
            const FLYING_SPEED = 60;
            const SWOOP_DISTANCE = 150;
            
            if (playerPos) {
              const dx = playerPos.x - position.x;
              const dy = playerPos.y - position.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist < SWOOP_DISTANCE && dist > 10) {
                // Swoop towards player
                velocity.x = (dx / dist) * FLYING_SPEED * 1.5;
                velocity.y = (dy / dist) * FLYING_SPEED;
              } else {
                // Normal patrol with bobbing
                velocity.x = obj.facingDirection.x * FLYING_SPEED;
                velocity.y = Math.sin(gameTime * 3 + obj.id) * 30;
                
                // Check bounds and reverse
                if (position.x < 50 || position.x > levelSystemRef.current!.getLevelWidth() - 50) {
                  obj.facingDirection.x *= -1;
                }
              }
            } else {
              velocity.x = obj.facingDirection.x * FLYING_SPEED;
              velocity.y = Math.sin(gameTime * 3 + obj.id) * 30;
            }
            break;
          }
          
          case 'turret': {
            // Turrets don't move but track player
            velocity.x = 0;
            velocity.y = 0;
            
            if (playerPos) {
              // Face the player
              if (playerPos.x < position.x) {
                obj.facingDirection.x = -1;
              } else {
                obj.facingDirection.x = 1;
              }
            }
            break;
          }
          
          case 'skeleton':
          case 'brobot': {
            // Ground patrol - medium speed
            const GROUND_SPEED = 40;
            velocity.x = obj.facingDirection.x * GROUND_SPEED;
            velocity.y += 500 * deltaTime; // Gravity
            break;
          }
          
          case 'karaguin': {
            // Fish - horizontal swimming
            const SWIM_SPEED = 70;
            velocity.x = obj.facingDirection.x * SWIM_SPEED;
            velocity.y = Math.sin(gameTime * 2 + obj.id) * 15;
            break;
          }
          
          case 'shadowslime':
          case 'mudman': {
            // Slower ground enemies
            const SLOW_SPEED = 25;
            velocity.x = obj.facingDirection.x * SLOW_SPEED;
            velocity.y += 400 * deltaTime; // Gravity
            break;
          }
          
          default: {
            // Default patrol behavior
            const DEFAULT_SPEED = 50;
            velocity.x = obj.facingDirection.x * DEFAULT_SPEED;
            velocity.y += 400 * deltaTime; // Gravity
          }
        }
        
        // Wall collision check (skip for flying enemies)
        if (obj.subType !== 'bat' && obj.subType !== 'sting' && obj.subType !== 'karaguin') {
          const nextX = position.x + velocity.x * deltaTime;
          const collision = collisionSystem.checkTileCollision(
            nextX, position.y, obj.width, obj.height, velocity.x, velocity.y
          );
          
          if (collision.leftWall || collision.rightWall) {
            obj.facingDirection.x *= -1;
            velocity.x = -velocity.x;
          }
        } else {
          // Flying enemies reverse at level bounds
          if (position.x < 20 || position.x > (levelSystemRef.current?.getLevelWidth() ?? 960) - 50) {
            obj.facingDirection.x *= -1;
          }
        }
        
        // Update position
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;
        
        // Ground collision for non-flying enemies
        if (obj.subType !== 'bat' && obj.subType !== 'sting' && obj.subType !== 'karaguin' && obj.subType !== 'turret') {
          const groundCheck = collisionSystem.checkTileCollision(
            position.x, position.y, obj.width, obj.height, velocity.x, velocity.y
          );
          
          if (groundCheck.grounded) {
            const tileSize = 32;
            const groundY = Math.floor((position.y + obj.height) / tileSize) * tileSize - obj.height;
            position.y = groundY;
            velocity.y = 0;
          }
        }
      });

      // Check hot spots
      if (player && hotSpotSystem) {
        const px = player.getPosition().x + player.width / 2;
        const py = player.getPosition().y + player.height / 2;
        const hotSpot = hotSpotSystem.getHotSpot(px, py);
        const pState = playerStateRef.current;
        
        if (hotSpot === HotSpotType.DIE && !pState.isDying) {
          // Player death from death zone
          pState.isDying = true;
          pState.deathTime = 1.0; // 1 second death animation
          soundSystem.playSfx(SoundEffects.EXPLODE);
          
          // Screen shake for death
          cameraSystem.shake(15, 0.5);
          
          // Decrement lives
          const inv = getInventory();
          const newLives = inv.lives - 1;
          setInventory({ lives: newLives });
          
          if (newLives <= 0) {
            // Game over - no more lives
            gameOver();
          }
        } else if (hotSpot === HotSpotType.END_LEVEL && !pState.isDying) {
          // Level complete
          soundSystem.playSfx(SoundEffects.DING);
          
          // Get next level info
          const levelSys = levelSystemRef.current;
          if (levelSys) {
            const nextLevelId = levelSys.getNextLevelId();
            if (nextLevelId !== null) {
              // Unlock and go to next level
              levelSys.unlockLevel(nextLevelId);
              setLevel(nextLevelId);
              // Reload the level system
              levelSys.loadLevel(nextLevelId).then(() => {
                // Store new spawn position
                playerSpawnRef.current = { ...levelSys.playerSpawnPosition };
                // Reset player position
                const spawn = levelSys.playerSpawnPosition;
                if (player) {
                  player.setPosition(spawn.x, spawn.y);
                }
              });
            } else {
              // No more levels - game complete!
              completeLevel();
            }
          }
        }
      }
      
      // Handle death animation and respawn
      const pState = playerStateRef.current;
      if (pState.isDying) {
        pState.deathTime -= deltaTime;
        
        if (pState.deathTime <= 0) {
          // Respawn player
          pState.isDying = false;
          pState.deathTime = 0;
          
          // Check if we have lives left
          const inv = getInventory();
          if (inv.lives > 0) {
            // Reset player position to spawn point
            const spawn = playerSpawnRef.current;
            if (player) {
              player.setPosition(spawn.x, spawn.y);
              player.getVelocity().x = 0;
              player.getVelocity().y = 0;
            }
            
            // Give invincibility frames after respawn
            pState.invincible = true;
            pState.invincibleTime = 2.0;
          }
        }
      }
      
      // Handle dialog trigger cooldown
      if (dialogTriggerCooldownRef.current > 0) {
        dialogTriggerCooldownRef.current -= deltaTime;
      }
      
      // Check for TALK hot spots (NPC dialogs)
      if (player && hotSpotSystem && activeDialogRef.current === null && dialogTriggerCooldownRef.current <= 0) {
        const px = player.getPosition().x + player.width / 2;
        const py = player.getPosition().y + player.height / 2;
        const hotSpot = hotSpotSystem.getHotSpot(px, py);
        
        // Check for dialog triggers
        if (hotSpot === HotSpotType.TALK || (hotSpot >= 32 && hotSpot <= 42)) {
          // Get current level info to load the right dialog
          const levelSys = levelSystemRef.current;
          if (levelSys) {
            const levelId = levelSys.getCurrentLevelId();
            const levelInfo = levelSys.getLevelInfo(levelId);
            
            if (levelInfo) {
              const dialogs = getDialogsForLevel(levelInfo.file);
              
              if (dialogs.length > 0) {
                // Determine which dialog to show based on hotspot
                const dialogIndex = (hotSpot >= 32 && hotSpot <= 42) ? (hotSpot - 32) : 0;
                const dialog = dialogs[Math.min(dialogIndex, dialogs.length - 1)];
                
                if (dialog) {
                  setActiveDialog(dialog);
                  soundSystem.playSfx(SoundEffects.BUTTON);
                  // Set cooldown to prevent immediate re-trigger
                  dialogTriggerCooldownRef.current = 2.0;
                }
              }
            }
          }
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
              obj.markForRemoval();
              
              // Update inventory and play sound based on type
              const inv = getInventory();
              if (obj.type === 'coin') {
                setInventory({ coinCount: inv.coinCount + 1, score: inv.score + 1 });
                soundSystem.playSfx(SoundEffects.GEM1, 0.5);
              } else if (obj.type === 'ruby') {
                setInventory({ rubyCount: inv.rubyCount + 1, score: inv.score + 3 });
                soundSystem.playSfx(SoundEffects.GEM2, 0.5);
              } else if (obj.type === 'pearl') {
                setInventory({ pearls: inv.pearls + 1, score: inv.score + 5 });
                soundSystem.playSfx(SoundEffects.GEM2, 0.5);
              } else if (obj.type === 'diary') {
                setInventory({ diaryCount: inv.diaryCount + 1, score: inv.score + 50 });
                soundSystem.playSfx(SoundEffects.DING, 0.5);
              }
            }
          }
        });
        
        // Check enemy collisions in separate loop
        gameObjectManager.forEach((obj) => {
          if (obj === player || !obj.isVisible()) return;
          
          // Check if enemy - handle stomp/damage
          if (obj.type === 'enemy' && obj.life > 0) {
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
              
              const pState = playerStateRef.current;
              const playerVel = player.getVelocity();
              
              // Check if player is stomping (coming from above with stomp attack)
              if (pState.stomping || (playerVel.y > 0 && playerPos.y < objPos.y)) {
                // Player kills enemy with stomp
                obj.life = 0;
                obj.setVisible(false);
                obj.markForRemoval();
                
                // Bounce player up
                player.getVelocity().y = -200;
                
                soundSystem.playSfx(SoundEffects.STOMP);
                
                // Award points
                const inv = getInventory();
                setInventory({ score: inv.score + 25 });
              } else if (!pState.invincible) {
                // Enemy damages player (only if not invincible)
                const inv = getInventory();
                if (inv.lives > 0) {
                  const newLives = inv.lives - 1;
                  setInventory({ lives: newLives });
                  soundSystem.playSfx(SoundEffects.THUMP);
                  
                  // Screen shake for damage feedback
                  cameraSystem.shake(8, 0.3);
                  
                  if (newLives <= 0) {
                    // Game over
                    gameOver();
                    return;
                  }
                  
                  // Grant invincibility frames
                  pState.invincible = true;
                  pState.invincibleTime = 2.0;  // 2 seconds
                  
                  // Knock player back
                  const knockbackDir = playerPos.x < objPos.x ? -1 : 1;
                  player.setVelocity(knockbackDir * 200, -150);
                }
              }
            }
          }
        });
      }
      
      // Update player invincibility timer
      if (playerStateRef.current.invincible) {
        playerStateRef.current.invincibleTime -= deltaTime;
        if (playerStateRef.current.invincibleTime <= 0) {
          playerStateRef.current.invincible = false;
        }
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
      
      // Update HUD fuel display
      setPlayerFuel(pState.fuel);

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
      const FRAME_TIME = 1 / 24; // 24 FPS animation, matching original's Utils.framesToTime(24, 1)
      
      gameObjectManager.forEach((obj) => {
        if (!obj.isVisible()) return;
        
        const pos = obj.getPosition();
        const isPlayer = obj === player;
        
        if (isPlayer) {
          // Check if flashing (invincible) - skip every other frame
          const pState = playerStateRef.current;
          if (pState.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
            return; // Skip rendering this frame for flashing effect
          }
          
          const vel = obj.getVelocity();
          const absVelX = Math.abs(vel.x);
          
          // Determine animation state based on player state (matching original AnimationComponent.java logic)
          let animState = 'idle';
          let animFrames: string[] = ['andou_stand'];
          let looping = false;
          
          if (pState.stomping) {
            // STOMP animation - 4 frames, not looping
            animState = 'stomp';
            animFrames = ['andou_stomp01', 'andou_stomp02', 'andou_stomp03', 'andou_stomp04'];
            looping = false;
          } else if (pState.touchingGround) {
            // On ground
            if (absVelX < 30) {
              // IDLE - standing still
              animState = 'idle';
              animFrames = ['andou_stand'];
            } else if (absVelX > 300) {
              // MOVE_FAST - extreme diagonal
              animState = 'move_fast';
              animFrames = ['andou_diagmore01'];
            } else {
              // MOVE - slight diagonal
              animState = 'move';
              animFrames = ['andou_diag01'];
            }
          } else {
            // In air
            if (pState.rocketsOn) {
              // Boosting
              // Note: In canvas, negative vel.y = going up, positive = going down
              if (absVelX < 100 && vel.y < -10) {
                // BOOST_UP - going mostly up (vel.y < -10 means moving upward fast)
                animState = 'boost_up';
                animFrames = ['andou_flyup02', 'andou_flyup03'];
                looping = true;
              } else if (absVelX > 300) {
                // BOOST_MOVE_FAST - fast diagonal boost
                animState = 'boost_move_fast';
                animFrames = ['andou_diagmore02', 'andou_diagmore03'];
                looping = true;
              } else {
                // BOOST_MOVE - diagonal boost
                animState = 'boost_move';
                animFrames = ['andou_diag02', 'andou_diag03'];
                looping = true;
              }
            } else {
              // Falling without boost (use movement poses based on horizontal velocity)
              if (absVelX < 1) {
                animState = 'idle';
                animFrames = ['andou_stand'];
              } else if (absVelX > 300) {
                animState = 'move_fast';
                animFrames = ['andou_diagmore01'];
              } else {
                animState = 'move';
                animFrames = ['andou_diag01'];
              }
            }
          }
          
          // Reset animation frame if state changed
          if (animState !== pState.lastAnimState) {
            pState.animFrame = 0;
            pState.animTimer = 0;
            pState.lastAnimState = animState;
          }
          
          // Update animation timer
          pState.animTimer += 1 / 60; // Assuming 60 FPS game loop
          if (pState.animTimer >= FRAME_TIME) {
            pState.animTimer -= FRAME_TIME;
            pState.animFrame++;
            
            if (pState.animFrame >= animFrames.length) {
              if (looping) {
                pState.animFrame = 0;
              } else {
                pState.animFrame = animFrames.length - 1; // Stay on last frame
              }
            }
          }
          
          const spriteName = animFrames[pState.animFrame] || animFrames[0];
          
          // Draw player sprite or fallback rectangle
          if (renderSystem.hasSprite(spriteName)) {
            const scaleX = obj.facingDirection.x < 0 ? -1 : 1;
            renderSystem.drawSprite(spriteName, pos.x - 8, pos.y - 8, 0, 10, 1, scaleX, 1);
          } else {
            // Fallback green rectangle for player
            renderSystem.drawRect(pos.x, pos.y, obj.width, obj.height, '#4caf50', 10);
          }
        } else {
          // Draw other objects with sprites
          const OBJECT_FRAME_TIME = 0.15; // Animation speed for objects
          
          // Use object's animTimer and animFrame for per-object animation
          // Initialize if not set
          if (obj.animTimer === undefined) obj.animTimer = Math.random(); // Random offset to desync animations
          if (obj.animFrame === undefined) obj.animFrame = 0;
          
          // Update animation timer
          obj.animTimer += 1 / 60;
          if (obj.animTimer >= OBJECT_FRAME_TIME) {
            obj.animTimer -= OBJECT_FRAME_TIME;
            obj.animFrame++;
          }
          
          let spriteName: string | null = null;
          let spriteFrames: string[] = [];
          const spriteOffset = { x: 0, y: 0 };
          
          switch (obj.type) {
            case 'coin':
              spriteFrames = ['coin01', 'coin02', 'coin03', 'coin04', 'coin05'];
              obj.animFrame = obj.animFrame % spriteFrames.length;
              spriteName = spriteFrames[obj.animFrame];
              spriteOffset.x = -obj.width / 2;
              spriteOffset.y = -obj.height / 2;
              break;
            case 'ruby':
            case 'pearl':
              spriteFrames = ['ruby01', 'ruby02', 'ruby03', 'ruby04', 'ruby05'];
              obj.animFrame = obj.animFrame % spriteFrames.length;
              spriteName = spriteFrames[obj.animFrame];
              spriteOffset.x = -obj.width / 2;
              spriteOffset.y = -obj.height / 2;
              break;
            case 'diary':
              spriteName = 'diary01';
              spriteOffset.x = -obj.width / 2;
              spriteOffset.y = -obj.height / 2;
              break;
            case 'enemy': {
              // Determine enemy type by subtype or default to bat
              const enemyType = obj.subType || 'bat';
              switch (enemyType) {
                case 'bat':
                  spriteFrames = ['bat01', 'bat02', 'bat03', 'bat04'];
                  break;
                case 'sting':
                  spriteFrames = ['sting01', 'sting02', 'sting03'];
                  break;
                case 'onion':
                  spriteFrames = ['onion01', 'onion02', 'onion03'];
                  break;
                case 'brobot':
                  // Animate based on velocity
                  if (Math.abs(obj.getVelocity().x) > 10) {
                    spriteFrames = ['brobot_walk01', 'brobot_walk02', 'brobot_walk03'];
                  } else {
                    spriteFrames = ['brobot_idle01', 'brobot_idle02', 'brobot_idle03'];
                  }
                  break;
                case 'skeleton':
                  if (Math.abs(obj.getVelocity().x) > 10) {
                    spriteFrames = ['skeleton_walk01', 'skeleton_walk02', 'skeleton_walk03', 'skeleton_walk04', 'skeleton_walk05'];
                  } else {
                    spriteFrames = ['skeleton_stand'];
                  }
                  break;
                case 'karaguin':
                  spriteFrames = ['karaguin01', 'karaguin02', 'karaguin03'];
                  break;
                case 'mudman':
                  if (Math.abs(obj.getVelocity().x) > 10) {
                    spriteFrames = ['mudman_walk01', 'mudman_walk02', 'mudman_walk03'];
                  } else {
                    spriteFrames = ['mudman_idle01', 'mudman_idle02'];
                  }
                  break;
                case 'shadowslime':
                  spriteFrames = ['shadowslime_idle01', 'shadowslime_idle02'];
                  break;
                default:
                  // Default to bat animation for unhandled enemy types
                  spriteFrames = ['bat01', 'bat02', 'bat03', 'bat04'];
              }
              obj.animFrame = obj.animFrame % spriteFrames.length;
              spriteName = spriteFrames[obj.animFrame];
              spriteOffset.x = -8;
              spriteOffset.y = -8;
              break;
            }
            case 'npc': {
              // NPCs use their subtype to determine sprite
              const npcType = obj.subType || 'wanda';
              spriteName = `${npcType}_stand`;
              spriteOffset.x = -8;
              spriteOffset.y = -8;
              break;
            }
            case 'door':
              // Doors are rendered as rectangles for now
              break;
          }
          
          // Try to draw sprite, fall back to colored rectangle
          if (spriteName && renderSystem.hasSprite(spriteName)) {
            const scaleX = obj.facingDirection.x < 0 ? -1 : 1;
            renderSystem.drawSprite(
              spriteName, 
              pos.x + spriteOffset.x, 
              pos.y + spriteOffset.y, 
              0, 
              5, 
              1, 
              scaleX, 
              1
            );
          } else {
            // Fallback to colored rectangles
            let color = '#888888';
            switch (obj.type) {
              case 'coin': color = '#ffd700'; break;
              case 'ruby':
              case 'pearl': color = '#ff69b4'; break;
              case 'diary': color = '#ffaa00'; break;
              case 'enemy': color = '#ff4444'; break;
              case 'npc': color = '#44aaff'; break;
              case 'door': color = '#8844ff'; break;
            }
            renderSystem.drawRect(pos.x, pos.y, obj.width, obj.height, color, 5);
          }
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
      if (introDialogTimeoutRef.current) {
        clearTimeout(introDialogTimeoutRef.current);
      }
      hasShownIntroDialogRef.current = false; // Reset for strict mode double-render
      gameLoop.stop();
      inputSystem.destroy();
      soundSystem.destroy();
    };
  }, [width, height, pauseGame, resumeGame, gameOver, completeLevel, setLevel]);

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
            <HUD fps={fps} showFPS={currentSettings.showFPS} fuel={playerFuel} gameWidth={width} gameHeight={height} />
            {currentSettings.onScreenControlsEnabled && (
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
                keyboardFlyActive={inputUIState.flyActive}
                keyboardStompActive={inputUIState.stompActive}
                keyboardLeftActive={inputUIState.leftActive}
                keyboardRightActive={inputUIState.rightActive}
              />
            )}
          </>
        )}
        
        {/* Dialog overlay */}
        {activeDialog && (
          <DialogOverlay
            dialog={activeDialog}
            onComplete={(): void => {
              setActiveDialog(null);
            }}
            onSkip={(): void => {
              setActiveDialog(null);
            }}
          />
        )}
        
        {/* Debug: Show when activeDialog is set */}
        {activeDialog === null && (
          <div style={{ position: 'absolute', top: 0, left: 0, color: 'yellow', zIndex: 2000, fontSize: '10px' }}>
            No dialog
          </div>
        )}
        
        {/* Pause menu overlay */}
        {state.gameState === GameState.PAUSED && (
          <PauseMenu
            onResume={resumeGame}
            onRestart={(): void => {
              resetInventory();
              // Reload current level
              const levelSys = levelSystemRef.current;
              if (levelSys) {
                levelSys.loadLevel(state.currentLevel).then(() => {
                  const spawn = levelSys.playerSpawnPosition;
                  playerSpawnRef.current = { ...spawn };
                  const gameObjectMgr = systemRegistryRef.current?.gameObjectManager;
                  const player = gameObjectMgr?.getPlayer();
                  if (player) {
                    player.setPosition(spawn.x, spawn.y);
                    player.getVelocity().x = 0;
                    player.getVelocity().y = 0;
                  }
                });
              }
              resumeGame();
            }}
          />
        )}
        
        {/* Game over overlay */}
        {state.gameState === GameState.GAME_OVER && (
          <GameOverScreen
            onRetry={(): void => {
              resetInventory();
              // Reload current level
              const levelSys = levelSystemRef.current;
              if (levelSys) {
                levelSys.loadLevel(state.currentLevel).then(() => {
                  const spawn = levelSys.playerSpawnPosition;
                  playerSpawnRef.current = { ...spawn };
                  const gameObjectMgr = systemRegistryRef.current?.gameObjectManager;
                  const player = gameObjectMgr?.getPlayer();
                  if (player) {
                    player.setPosition(spawn.x, spawn.y);
                    player.getVelocity().x = 0;
                    player.getVelocity().y = 0;
                  }
                });
              }
              resumeGame();
            }}
          />
        )}
        
        {/* Level complete overlay */}
        {state.gameState === GameState.LEVEL_COMPLETE && (
          <LevelCompleteScreen
            levelName={levelSystemRef.current?.getLevelInfo(state.currentLevel)?.name}
            onContinue={(): void => {
              const levelSys = levelSystemRef.current;
              if (levelSys) {
                const nextLevelId = levelSys.getNextLevelId();
                if (nextLevelId !== null) {
                  levelSys.unlockLevel(nextLevelId);
                  setLevel(nextLevelId);
                  levelSys.loadLevel(nextLevelId).then(() => {
                    const spawn = levelSys.playerSpawnPosition;
                    playerSpawnRef.current = { ...spawn };
                    const gameObjectMgr = systemRegistryRef.current?.gameObjectManager;
                    const player = gameObjectMgr?.getPlayer();
                    if (player) {
                      player.setPosition(spawn.x, spawn.y);
                      player.getVelocity().x = 0;
                      player.getVelocity().y = 0;
                    }
                  });
                  resumeGame();
                }
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

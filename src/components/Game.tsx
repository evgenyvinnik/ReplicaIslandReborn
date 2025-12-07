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
import { EffectsSystem } from '../engine/EffectsSystem';
import { CanvasHUD } from '../engine/CanvasHUD';
import { CanvasControls } from '../engine/CanvasControls';
import { CanvasDialog } from '../engine/CanvasDialog';
import { CanvasCutscene } from '../engine/CanvasCutscene';
import { CanvasPauseMenu } from '../engine/CanvasPauseMenu';
import { CanvasGameOverScreen } from '../engine/CanvasGameOverScreen';
import { CanvasLevelCompleteScreen } from '../engine/CanvasLevelCompleteScreen';
import { CanvasDiaryOverlay } from '../engine/CanvasDiaryOverlay';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { GameObject } from '../entities/GameObject';
import { LevelSystem } from '../levels/LevelSystemNew';
import { TileMapRenderer } from '../levels/TileMapRenderer';
import { generatePlaceholderTileset } from '../utils/PlaceholderSprites';
import { gameSettings } from '../utils/GameSettings';
import { setInventory, resetInventory, getInventory } from '../entities/components/InventoryComponent';
import { getDialogsForLevel, type Dialog } from '../data/dialogs';
import { getDiaryByCollectionOrder } from '../data/diaries';
import { assetPath } from '../utils/helpers';
import { CutsceneType, getCutscene } from '../data/cutscenes';
import { useGameStore } from '../stores/useGameStore';

interface GameProps {
  width?: number;
  height?: number;
}

// Player physics constants (from original PlayerComponent.java)
// Player state machine (from original PlayerComponent.java)
enum PlayerState {
  MOVE = 0,          // Normal movement
  STOMP = 1,         // Stomp attack in progress
  HIT_REACT = 2,     // Hit reaction (invulnerability frames)
  DEAD = 3,          // Death animation
  WIN = 4,           // Level complete
  FROZEN = 5,        // Frozen (cutscene, dialog)
  POST_GHOST_DELAY = 6, // Delay after ghost possession ends
}

// Note: In canvas coordinates, positive Y is DOWN, negative Y is UP
// The original Java code used a coordinate system where positive Y was UP
const PLAYER = {
  // Movement constants
  GROUND_IMPULSE_SPEED: 5000,
  AIR_HORIZONTAL_IMPULSE_SPEED: 4000,
  AIR_VERTICAL_IMPULSE_SPEED: 1200,
  AIR_VERTICAL_IMPULSE_FROM_GROUND: 250,
  MAX_GROUND_HORIZONTAL_SPEED: 500,
  MAX_AIR_HORIZONTAL_SPEED: 150,
  MAX_UPWARD_SPEED: 250,
  JUMP_TO_JETS_DELAY: 0.5,
  AIR_DRAG_SPEED: 4000,
  GRAVITY: 500,
  FUEL_AMOUNT: 1.0,
  WIDTH: 48,
  HEIGHT: 48,
  
  // Stomp attack constants (from original)
  STOMP_VELOCITY: 1000, // Positive = downward in canvas coordinates
  STOMP_DELAY_TIME: 0.15,     // Hitstop duration on stomp impact
  STOMP_AIR_HANG_TIME: 0.0,   // Time to hang in air before stomp
  STOMP_SHAKE_MAGNITUDE: 15,  // Camera shake intensity on stomp land
  STOMP_VIBRATE_TIME: 0.05,   // Vibration duration
  
  // Hit reaction constants
  HIT_REACT_TIME: 0.5,        // Duration of hit reaction state
  INVINCIBILITY_TIME: 2.0,    // Post-hit invincibility duration
  
  // Ghost/Possession constants
  GHOST_REACTIVATION_DELAY: 0.3,
  GHOST_CHARGE_TIME: 0.75,    // Time to hold attack to spawn ghost
  
  // Win condition
  MAX_GEMS_PER_LEVEL: 3,      // Rubies needed to win
  
  // Ghost duration by gems
  NO_GEMS_GHOST_TIME: 3.0,
  ONE_GEM_GHOST_TIME: 8.0,
  TWO_GEMS_GHOST_TIME: 0.0,   // Unlimited with 2+ gems
  
  // Glow mode / Invincibility powerup (from DifficultyConstants.java)
  // Collecting enough coins grants temporary invincibility with a glowing effect
  COINS_PER_POWERUP_KIDS: 20,
  COINS_PER_POWERUP_ADULTS: 30,
  GLOW_DURATION_KIDS: 15.0,    // 15 seconds of invincibility on Kids difficulty
  GLOW_DURATION_ADULTS: 10.0,  // 10 seconds on Adults difficulty
};

export function Game({ width = 480, height = 320 }: GameProps): React.JSX.Element {
  console.warn('[Game] Component rendering, width:', width, 'height:', height);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, pauseGame, resumeGame, gameOver, completeLevel, setLevel, playCutscene, endCutscene, goToMainMenu } = useGameContext();
  
  // Zustand store for persistent progress/scores - use individual selectors to avoid infinite loops
  const storeCompleteLevel = useGameStore((s) => s.completeLevel);
  const storeRecordLevelAttempt = useGameStore((s) => s.recordLevelAttempt);
  const storeCollectDiary = useGameStore((s) => s.collectDiary);
  const storeAddToTotalStats = useGameStore((s) => s.addToTotalStats);
  const storeLevelProgress = useGameStore((s) => s.progress.levels);
  
  // Systems refs
  const gameLoopRef = useRef<GameLoop | null>(null);
  const systemRegistryRef = useRef<SystemRegistry | null>(null);
  const renderSystemRef = useRef<RenderSystem | null>(null);
  const soundSystemRef = useRef<SoundSystem | null>(null);
  const effectsSystemRef = useRef<EffectsSystem | null>(null);
  const tileMapRendererRef = useRef<TileMapRenderer | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const levelSystemRef = useRef<LevelSystem | null>(null);
  
  // Canvas-based UI systems
  const canvasHUDRef = useRef<CanvasHUD | null>(null);
  const canvasControlsRef = useRef<CanvasControls | null>(null);
  const canvasDialogRef = useRef<CanvasDialog | null>(null);
  const canvasCutsceneRef = useRef<CanvasCutscene | null>(null);
  const canvasPauseMenuRef = useRef<CanvasPauseMenu | null>(null);
  const canvasGameOverRef = useRef<CanvasGameOverScreen | null>(null);
  const canvasLevelCompleteRef = useRef<CanvasLevelCompleteScreen | null>(null);
  const canvasDiaryRef = useRef<CanvasDiaryOverlay | null>(null);
  
  // Level timing tracking
  const levelStartTimeRef = useRef<number>(0);
  const levelElapsedTimeRef = useRef<number>(0);
  
  // Player spawn point (set when level loads)
  const playerSpawnRef = useRef({ x: 100, y: 320 });
  
  // Player state ref for physics (matching original PlayerComponent.java)
  const playerStateRef = useRef({
    // State machine
    currentState: PlayerState.MOVE,
    stateTimer: 0,
    
    // Physics state
    fuel: PLAYER.FUEL_AMOUNT,
    jumpTime: 0,
    touchingGround: false,
    wasTouchingGround: false, // Track previous frame for landing detection
    rocketsOn: false,
    
    // Stomp attack state
    stomping: false,
    stompTime: 0,
    stompHangTime: 0,         // Air hang time before stomp
    stompLanded: false,       // True when stomp impacts ground/enemy
    
    // Hit reaction state
    invincible: false,
    invincibleTime: 0,
    lastHitTime: 0,
    hitReactTimer: 0,         // Time remaining in HIT_REACT state
    
    // Ghost/Possession state
    ghostChargeTime: 0,       // Time attack held on ground
    ghostActive: false,       // True when ghost is spawned
    postGhostDelay: 0,        // Delay after ghost returns
    
    // Animation state
    animFrame: 0,
    animTimer: 0,
    lastAnimState: '',
    
    // Death/respawn state
    isDying: false,
    deathTime: 0,
    
    // Win state
    levelWon: false,
    
    // Glow mode (invincibility powerup from coins)
    glowMode: false,
    glowTime: 0,               // Time remaining in glow mode
    coinsForPowerup: 0,        // Coins collected toward next powerup
  });
  
  // Helper function to reset player state (call when loading/restarting levels)
  const resetPlayerState = useCallback((): void => {
    const pState = playerStateRef.current;
    pState.currentState = PlayerState.MOVE;
    pState.stateTimer = 0;
    pState.fuel = PLAYER.FUEL_AMOUNT;
    pState.jumpTime = 0;
    pState.touchingGround = false;
    pState.wasTouchingGround = false;
    pState.rocketsOn = false;
    pState.stomping = false;
    pState.stompTime = 0;
    pState.stompHangTime = 0;
    pState.stompLanded = false;
    pState.invincible = false;
    pState.invincibleTime = 0;
    pState.lastHitTime = 0;
    pState.hitReactTimer = 0;
    pState.ghostChargeTime = 0;
    pState.ghostActive = false;
    pState.postGhostDelay = 0;
    pState.animFrame = 0;
    pState.animTimer = 0;
    pState.lastAnimState = '';
    pState.isDying = false;
    pState.deathTime = 0;
    pState.levelWon = false;
    pState.glowMode = false;
    pState.glowTime = 0;
    pState.coinsForPowerup = 0;
  }, []);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [scale, setScale] = useState(1);
  const [levelLoading, setLevelLoading] = useState(true);
  
  // Use ref for current level to avoid dependency issues
  const currentLevelRef = useRef(state.currentLevel);
  currentLevelRef.current = state.currentLevel;
  
  // Game settings state - subscribe to changes
  const [currentSettings, setCurrentSettings] = useState(gameSettings.getAll());
  
  // Dialog state
  const [activeDialog, setActiveDialog] = useState<Dialog | null>(null);
  const activeDialogRef = useRef<Dialog | null>(null);
  const dialogTriggerCooldownRef = useRef(0);
  const hasShownIntroDialogRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    activeDialogRef.current = activeDialog;
  }, [activeDialog]);

  const gameStateRef = useRef(state.gameState);
  useEffect(() => {
    gameStateRef.current = state.gameState;
  }, [state.gameState]);

  // Show intro dialog after level finishes loading
  // Only auto-show for cutscene levels (no player spawn)
  useEffect(() => {
    if (!levelLoading && isInitialized && !hasShownIntroDialogRef.current) {
      const levelSystem = levelSystemRef.current;
      const gameObjectManager = systemRegistryRef.current?.gameObjectManager;
      if (levelSystem && gameObjectManager) {
        // Only auto-show dialog for cutscene levels (no player)
        const player = gameObjectManager.getPlayer();
        if (!player) {
          const levelInfo = levelSystem.getLevelInfo(state.currentLevel);
          console.warn('[Game] Cutscene level - showing intro dialog, level:', state.currentLevel, 'levelInfo:', levelInfo?.file);
          if (levelInfo) {
            const dialogs = getDialogsForLevel(levelInfo.file);
            console.warn('[Game] Found', dialogs.length, 'dialogs for level', levelInfo.file);
            if (dialogs.length > 0) {
              hasShownIntroDialogRef.current = true;
              setActiveDialog(dialogs[0]);
            }
          }
        } else {
          console.warn('[Game] Playable level - skipping auto-dialog, level:', state.currentLevel);
        }
      }
    }
  }, [levelLoading, isInitialized, state.currentLevel]);

  // Track previous level to detect level changes
  const prevLevelRef = useRef(state.currentLevel);
  
  // Reload level when currentLevel changes (e.g., from LevelSelect)
  useEffect(() => {
    // Skip if not initialized yet
    if (!isInitialized) return;
    
    // Skip if level hasn't actually changed
    if (prevLevelRef.current === state.currentLevel) return;
    
    // Update previous level
    prevLevelRef.current = state.currentLevel;
    
    // Load the new level
    const levelSystem = levelSystemRef.current;
    const gameObjectManager = systemRegistryRef.current?.gameObjectManager;
    if (!levelSystem || !gameObjectManager) return;
    
    setLevelLoading(true);
    hasShownIntroDialogRef.current = false;
    
    levelSystem.loadLevel(state.currentLevel).then(() => {
      gameObjectManager.commitUpdates();
      
      // Initialize tile map renderer for new level
      const parsedLevel = levelSystem.getParsedLevel();
      if (parsedLevel && tileMapRendererRef.current) {
        tileMapRendererRef.current.initializeFromLevel(parsedLevel);
        
        // Load background image
        const backgroundImage = parsedLevel.backgroundImage;
        const bgPath = `/assets/sprites/${backgroundImage}.png`;
        const bgImg = new Image();
        bgImg.onload = (): void => {
          backgroundImageRef.current = bgImg;
        };
        bgImg.src = bgPath;
      }
      
      // Update camera bounds
      const cameraSystem = systemRegistryRef.current?.cameraSystem;
      if (cameraSystem) {
        cameraSystem.setBounds({
          minX: 0,
          minY: 0,
          maxX: levelSystem.getLevelWidth(),
          maxY: levelSystem.getLevelHeight(),
        });
      }
      
      const spawn = levelSystem.playerSpawnPosition;
      playerSpawnRef.current = { ...spawn };
      resetPlayerState();
      
      const player = gameObjectManager.getPlayer();
      if (player) {
        player.setPosition(spawn.x, spawn.y);
        player.getVelocity().x = 0;
        player.getVelocity().y = 0;
      }
      
      setLevelLoading(false);
    });
  }, [isInitialized, state.currentLevel, resetPlayerState]);

  // Handle Canvas Dialog when activeDialog changes
  useEffect(() => {
    const canvasDialog = canvasDialogRef.current;
    if (!canvasDialog) return;
    
    if (activeDialog) {
      // Define dialog completion handler
      const handleDialogComplete = (): void => {
        console.warn('[Game] Dialog complete');
        setActiveDialog(null);
        // If this is a cutscene-only level (no player), advance to next level after dialog
        const gameObjectMgr = systemRegistryRef.current?.gameObjectManager;
        const player = gameObjectMgr?.getPlayer();
        console.warn('[Game] Player exists:', !!player);
        if (!player) {
          // No player means this is a story/cutscene level - advance to next
          const levelSys = levelSystemRef.current;
          if (levelSys) {
            const nextLevelId = levelSys.getNextLevelId();
            console.warn('[Game] Cutscene level - advancing to next level:', nextLevelId);
            if (nextLevelId !== null) {
              levelSys.unlockLevel(nextLevelId);
              setLevel(nextLevelId);
              setLevelLoading(true);
              hasShownIntroDialogRef.current = false;
              levelSys.loadLevel(nextLevelId).then(() => {
                gameObjectMgr?.commitUpdates();
                
                // Initialize tile map renderer for new level
                const parsedLevel = levelSys.getParsedLevel();
                if (parsedLevel && tileMapRendererRef.current) {
                  tileMapRendererRef.current.initializeFromLevel(parsedLevel);
                }
                
                // Update camera bounds for new level
                const cameraSystem = systemRegistryRef.current?.cameraSystem;
                if (cameraSystem) {
                  cameraSystem.setBounds({
                    minX: 0,
                    minY: 0,
                    maxX: levelSys.getLevelWidth(),
                    maxY: levelSys.getLevelHeight(),
                  });
                }
                
                const spawn = levelSys.playerSpawnPosition;
                playerSpawnRef.current = { ...spawn };
                resetPlayerState(); // Reset player state for new level
                const newPlayer = gameObjectMgr?.getPlayer();
                if (newPlayer) {
                  newPlayer.setPosition(spawn.x, spawn.y);
                  newPlayer.getVelocity().x = 0;
                  newPlayer.getVelocity().y = 0;
                  
                  // Set camera to follow the new player
                  if (cameraSystem) {
                    cameraSystem.setTarget(newPlayer);
                    cameraSystem.setPosition(spawn.x, spawn.y);
                  }
                }
                setLevelLoading(false);
              });
            }
          }
        }
      };
      
      canvasDialog.show(activeDialog, handleDialogComplete, handleDialogComplete);
    } else {
      canvasDialog.hide();
    }
  }, [activeDialog, setLevel, resetPlayerState]);

  // Handle Canvas Cutscene when cutscene state changes
  useEffect(() => {
    const canvasCutscene = canvasCutsceneRef.current;
    if (!canvasCutscene) return;
    
    if (state.gameState === GameState.CUTSCENE && state.activeCutscene !== null) {
      const handleCutsceneComplete = (): void => {
        // Check if this cutscene leads to game over
        const cutscene = getCutscene(state.activeCutscene!);
        if (cutscene.isGameOver) {
          endCutscene();
          gameOver();
        } else if (cutscene.isEnding) {
          // Ending cutscenes return to main menu
          endCutscene();
          // TODO: Show ending stats screen before main menu
        } else {
          endCutscene();
        }
      };
      
      canvasCutscene.play(state.activeCutscene, handleCutsceneComplete);
    } else {
      canvasCutscene.stop();
    }
  }, [state.gameState, state.activeCutscene, endCutscene, gameOver]);

  // Handle Canvas Pause Menu when game state changes
  useEffect(() => {
    const canvasPauseMenu = canvasPauseMenuRef.current;
    if (!canvasPauseMenu) return;
    
    if (state.gameState === GameState.PAUSED) {
      canvasPauseMenu.show((): void => {
        resumeGame();
      });
    } else {
      canvasPauseMenu.hide();
    }
  }, [state.gameState, resumeGame]);

  // Handle Canvas Game Over Screen when game state changes
  useEffect(() => {
    const canvasGameOver = canvasGameOverRef.current;
    if (!canvasGameOver) return;
    
    if (state.gameState === GameState.GAME_OVER) {
      canvasGameOver.show(
        (): void => {
          // Retry - reload current level
          const levelSys = levelSystemRef.current;
          if (levelSys) {
            levelSys.loadLevel(state.currentLevel).then(() => {
              // Initialize tile map renderer for level
              const parsedLevel = levelSys.getParsedLevel();
              if (parsedLevel && tileMapRendererRef.current) {
                tileMapRendererRef.current.initializeFromLevel(parsedLevel);
              }
              
              const spawn = levelSys.playerSpawnPosition;
              playerSpawnRef.current = { ...spawn };
              resetPlayerState(); // Reset player state for retry
              const gameObjectMgr = systemRegistryRef.current?.gameObjectManager;
              gameObjectMgr?.commitUpdates();
              const player = gameObjectMgr?.getPlayer();
              if (player) {
                player.setPosition(spawn.x, spawn.y);
                player.getVelocity().x = 0;
                player.getVelocity().y = 0;
              }
              resumeGame();
            });
          }
        },
        (): void => {
          // Main menu
          goToMainMenu();
        }
      );
    } else {
      canvasGameOver.hide();
    }
  }, [state.gameState, state.currentLevel, resumeGame, goToMainMenu, resetPlayerState]);

  // Handle Canvas Level Complete Screen when game state changes
  useEffect(() => {
    const canvasLevelComplete = canvasLevelCompleteRef.current;
    if (!canvasLevelComplete) return;
    
    if (state.gameState === GameState.LEVEL_COMPLETE) {
      // Calculate elapsed time and save progress to store
      const elapsedTime = (Date.now() - levelStartTimeRef.current) / 1000; // In seconds
      levelElapsedTimeRef.current = elapsedTime;
      const inventory = getInventory();
      
      // Get previous best stats before saving (for comparison display)
      const levelProgress = storeLevelProgress[state.currentLevel];
      const previousBestTime = levelProgress?.bestTime ?? null;
      const previousBestScore = levelProgress?.bestScore ?? 0;
      
      // Save level completion with score and time to persistent store
      storeCompleteLevel(state.currentLevel, inventory.score, elapsedTime);
      
      // Update total stats
      storeAddToTotalStats({
        totalCoinsCollected: inventory.coinCount,
        totalRubiesCollected: inventory.rubyCount,
      });
      
      const levelName = levelSystemRef.current?.getLevelInfo(state.currentLevel)?.name ?? 'Level';
      canvasLevelComplete.show(
        levelName,
        (): void => {
          // Continue - go to next level
          const levelSys = levelSystemRef.current;
          if (levelSys) {
            const nextLevelId = levelSys.getNextLevelId();
            if (nextLevelId !== null) {
              levelSys.unlockLevel(nextLevelId);
              setLevel(nextLevelId);
              hasShownIntroDialogRef.current = false;
              levelSys.loadLevel(nextLevelId).then(() => {
                // Initialize tile map renderer for new level
                const parsedLevel = levelSys.getParsedLevel();
                if (parsedLevel && tileMapRendererRef.current) {
                  tileMapRendererRef.current.initializeFromLevel(parsedLevel);
                }
                
                const spawn = levelSys.playerSpawnPosition;
                playerSpawnRef.current = { ...spawn };
                resetPlayerState(); // Reset player state for new level
                
                // Start timer for new level
                levelStartTimeRef.current = Date.now();
                levelElapsedTimeRef.current = 0;
                storeRecordLevelAttempt(nextLevelId);
                
                const gameObjectMgr = systemRegistryRef.current?.gameObjectManager;
                gameObjectMgr?.commitUpdates();
                const player = gameObjectMgr?.getPlayer();
                if (player) {
                  player.setPosition(spawn.x, spawn.y);
                  player.getVelocity().x = 0;
                  player.getVelocity().y = 0;
                }
                resumeGame();
              });
            }
          }
        },
        (): void => {
          // Main menu
          goToMainMenu();
        },
        // Pass level stats for display
        {
          bestTime: previousBestTime,
          bestScore: previousBestScore,
          currentTime: elapsedTime,
        }
      );
    } else {
      canvasLevelComplete.hide();
    }
  }, [state.gameState, state.currentLevel, resumeGame, setLevel, goToMainMenu, resetPlayerState, storeCompleteLevel, storeAddToTotalStats, storeRecordLevelAttempt, storeLevelProgress]);

  // Attach/detach Canvas Controls when settings change
  useEffect(() => {
    const canvasControls = canvasControlsRef.current;
    if (!canvasControls) return;
    
    if (currentSettings.onScreenControlsEnabled && isInitialized && !levelLoading) {
      canvasControls.attach();
    } else {
      canvasControls.detach();
    }
    
    return (): void => {
      canvasControls.detach();
    };
  }, [currentSettings.onScreenControlsEnabled, isInitialized, levelLoading]);

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

    // Create all systems fresh each time (Strict Mode will run this twice,
    // but cleanup will stop the first game loop)
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

    // Effects system (explosions, smoke, etc.)
    const effectsSystem = new EffectsSystem();
    effectsSystem.setRenderSystem(renderSystem);
    effectsSystem.setSoundSystem(soundSystem);
    effectsSystemRef.current = effectsSystem;
    systemRegistry.register(effectsSystem, 'effects');

    // Game object manager
    const gameObjectManager = new GameObjectManager();
    gameObjectManager.setCamera(cameraSystem);
    systemRegistry.register(gameObjectManager, 'gameObject');

    // Game object factory
    const factory = new GameObjectFactory(gameObjectManager);
    factory.setRenderSystem(renderSystem);
    factory.setCollisionSystem(collisionSystem);
    factory.setInputSystem(inputSystem);
    factory.setSystemRegistry(systemRegistry);
    systemRegistry.register(factory, 'factory');

    // Level system
    const levelSystem = new LevelSystem();
    levelSystem.setSystems(collisionSystem, gameObjectManager, hotSpotSystem);
    systemRegistry.register(levelSystem, 'level');
    levelSystemRef.current = levelSystem;

    // Tile map renderer - reuse existing instance if available (prevents Strict Mode issues)
    let tileMapRenderer = tileMapRendererRef.current;
    if (!tileMapRenderer) {
      tileMapRenderer = new TileMapRenderer();
      tileMapRendererRef.current = tileMapRenderer;
    }
    tileMapRenderer.setViewport(width, height);

    // Placeholder tileset for fallback
    const placeholderTileset = generatePlaceholderTileset(32);
    renderSystem.registerCanvasSprite('tileset', placeholderTileset, 32, 32);

    // Canvas-based UI systems - get canvas context
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Canvas HUD
      const canvasHUD = new CanvasHUD(ctx, width, height);
      canvasHUDRef.current = canvasHUD;
      
      // Canvas Controls
      const canvasControls = new CanvasControls(ctx, canvas, width, height);
      canvasControlsRef.current = canvasControls;
      
      // Canvas Dialog
      const canvasDialog = new CanvasDialog(ctx, canvas, width, height);
      canvasDialogRef.current = canvasDialog;
      
      // Canvas Cutscene
      const canvasCutscene = new CanvasCutscene(ctx, canvas, width, height);
      canvasCutsceneRef.current = canvasCutscene;
      
      // Canvas Pause Menu
      const canvasPauseMenu = new CanvasPauseMenu(ctx, canvas, width, height);
      canvasPauseMenuRef.current = canvasPauseMenu;
      canvasPauseMenu.preload();
      
      // Canvas Game Over Screen
      const canvasGameOver = new CanvasGameOverScreen(ctx, canvas, width, height);
      canvasGameOverRef.current = canvasGameOver;
      
      // Canvas Level Complete Screen
      const canvasLevelComplete = new CanvasLevelCompleteScreen(ctx, canvas, width, height);
      canvasLevelCompleteRef.current = canvasLevelComplete;
      
      // Canvas Diary Overlay
      const canvasDiary = new CanvasDiaryOverlay(ctx, canvas, width, height);
      canvasDiaryRef.current = canvasDiary;
      
      // Setup controls callbacks
      canvasControls.setCallbacks(
        (direction: number): void => {
          inputSystem.setVirtualAxis('horizontal', direction);
        },
        (): void => {
          inputSystem.setVirtualButton('fly', true);
        },
        (): void => {
          inputSystem.setVirtualButton('fly', false);
        },
        (): void => {
          inputSystem.setVirtualButton('stomp', true);
        },
        (): void => {
          inputSystem.setVirtualButton('stomp', false);
        }
      );
    }

    // Load background image helper
    const loadBackgroundImage = (imageName: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = (): void => resolve(img);
        img.onerror = (): void => reject(new Error(`Failed to load ${imageName}`));
        img.src = assetPath(`/assets/sprites/${imageName}.png`);
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
        renderSystem.loadSprite(sprite.name, assetPath(`/assets/sprites/${sprite.file}.png`), 64, 64)
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
        renderSystem.loadSprite(sprite.name, assetPath(`/assets/sprites/${sprite.file}.png`), sprite.w, sprite.h)
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
        renderSystem.loadSprite(sprite.name, assetPath(`/assets/sprites/${sprite.file}.png`), sprite.w, sprite.h)
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
        
        // Load effect sprites (explosions, smoke, etc.)
        await effectsSystem.preloadSprites();
        
        // Load Canvas UI sprites
        if (canvasHUDRef.current) {
          await canvasHUDRef.current.preload();
        }
        if (canvasControlsRef.current) {
          await canvasControlsRef.current.preload();
        }
        
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
        console.warn('[Game] Loading level:', levelToLoad);
        
        // Try to load the level (JSON format)
        const levelLoaded = await levelSystem.loadLevel(levelToLoad);
        console.warn('[Game] Level loaded:', levelLoaded);
        
        if (levelLoaded) {
          // Commit pending object additions immediately so they're available for rendering
          gameObjectManager.commitUpdates();
          
          // Store player spawn position from level system
          playerSpawnRef.current = { ...levelSystem.playerSpawnPosition };
          
          // Initialize tile map renderer from parsed level
          const parsedLevel = levelSystem.getParsedLevel();
          console.warn('[Game] parsedLevel:', parsedLevel ? { bgLayers: parsedLevel.backgroundLayers.length, w: parsedLevel.widthInTiles, h: parsedLevel.heightInTiles } : null);
          if (parsedLevel) {
            tileMapRenderer.initializeFromLevel(parsedLevel);
            console.warn('[Game] TileMapRenderer initialized, layers:', tileMapRenderer.getLayerCount());
            
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
          
          // Handle cutscene levels (no player spawn)
          // If there's no player but there is an NPC, focus camera on the NPC
          const player = gameObjectManager.getPlayer();
          console.warn('[Game] Player found:', !!player, 'position:', player?.getPosition());
          
          if (player) {
            // Set camera to initially focus on the player
            const playerPos = player.getPosition();
            cameraSystem.setTarget(player);
            // Also set camera position directly to player location immediately
            // This prevents the camera from "lerping" from (0,0) to the player
            cameraSystem.setPosition(
              playerPos.x,
              playerPos.y
            );
            console.warn('[Game] Camera set to player position:', playerPos.x, playerPos.y);
          } else {
            // Find an NPC to focus on (Wanda, Kyle, Kabocha, or Rokudou)
            let npcTarget: GameObject | null = null;
            gameObjectManager.forEach((obj) => {
              if (obj.type === 'npc' && npcTarget === null) {
                npcTarget = obj;
              }
            });
            
            if (npcTarget !== null) {
              console.warn(`[Game] Found NPC target: ${(npcTarget as GameObject).subType}`);
              // Set camera to initially focus on the NPC
              const npc = npcTarget as GameObject;
              cameraSystem.setNPCTarget(npcTarget);
              // Also set camera position directly to NPC location
              // setPosition expects the center focus point, not the top-left corner
              const npcPos = npc.getPosition();
              cameraSystem.setPosition(
                npcPos.x,
                npcPos.y
              );
              console.warn('[Game] Camera set to NPC position:', npcPos.x, npcPos.y);
            }
          }
          
          // Note: Intro dialog is now shown via a separate useEffect after levelLoading becomes false
          
          // Start level timer
          levelStartTimeRef.current = Date.now();
          levelElapsedTimeRef.current = 0;
          
          // Record level attempt in store
          storeRecordLevelAttempt(levelToLoad);
        } else {
          // Fallback: create test level
          createTestLevel(factory, gameObjectManager, collisionSystem);
        }
      } catch (error) {
        console.error('[InitializeGame] Failed to load level:', error);
        // Create test level as fallback
        createTestLevel(factory, gameObjectManager, collisionSystem);
      }
      
      setLevelLoading(false);
      
      // Start game loop AFTER initialization completes
      if (gameLoopRef.current && !gameLoopRef.current.isRunning()) {
        console.warn('[Game] Starting game loop after initialization');
        gameLoopRef.current.start();
      }
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
    initializeGame().catch((error) => {
      console.error('[InitializeGame] Unhandled error:', error);
      setLevelLoading(false);
    });

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
      
      if (player) {
        // Update player's internal gameTime before physics so touchingGround() works correctly
        player.setGameTime(gameTime);
        // Player physics update (based on original PlayerComponent.java)
        updatePlayerPhysics(player, input, deltaTime, gameTime, collisionSystem, soundSystem);
      }

      // Update all game objects
      gameObjectManager.update(deltaTime, gameTime);
      
      // Update effects system (explosions, smoke, etc.)
      effectsSystem.update(deltaTime);

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

      // NPC movement and physics
      gameObjectManager.forEach((obj) => {
        if (obj.type !== 'npc' || !obj.isVisible()) return;
        
        const velocity = obj.getVelocity();
        const targetVelocity = obj.getTargetVelocity();
        const acceleration = obj.getAcceleration();
        const position = obj.getPosition();
        
        // Interpolate velocity towards target velocity (based on original MovementComponent)
        if (acceleration.x > 0) {
          if (Math.abs(targetVelocity.x - velocity.x) < 0.1) {
            velocity.x = targetVelocity.x;
          } else if (targetVelocity.x > velocity.x) {
            velocity.x += acceleration.x * deltaTime;
            if (velocity.x > targetVelocity.x) velocity.x = targetVelocity.x;
          } else if (targetVelocity.x < velocity.x) {
            velocity.x -= acceleration.x * deltaTime;
            if (velocity.x < targetVelocity.x) velocity.x = targetVelocity.x;
          }
        }
        
        // Apply gravity to NPCs (unless flying)
        velocity.y += 400 * deltaTime;
        
        // Update position
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;
        
        // Ground collision for NPCs
        const groundCheck = collisionSystem.checkTileCollision(
          position.x, position.y, obj.width, obj.height, velocity.x, velocity.y
        );
        
        if (groundCheck.grounded) {
          const tileSize = 32;
          const groundY = Math.floor((position.y + obj.height) / tileSize) * tileSize - obj.height;
          position.y = groundY;
          velocity.y = 0;
          // Update floor touch time so touchingGround() returns true
          obj.lastTouchedFloorTime = gameTime;
        }
        
        // Update facing direction based on velocity
        if (Math.abs(velocity.x) > 1) {
          obj.facingDirection.x = velocity.x > 0 ? 1 : -1;
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
          
          // Spawn explosion effect at player position
          effectsSystem.spawnExplosion(px, py, 'large');
          
          // Screen shake for death
          cameraSystem.shake(15, 0.5);
          
          // Decrement lives
          const inv = getInventory();
          const newLives = inv.lives - 1;
          setInventory({ lives: newLives });
          
          if (newLives <= 0) {
            // Game over - play death cutscene then show game over
            playCutscene(CutsceneType.KYLE_DEATH);
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
                // Initialize tile map renderer for new level
                const parsedLevel = levelSys.getParsedLevel();
                if (parsedLevel && tileMapRendererRef.current) {
                  tileMapRendererRef.current.initializeFromLevel(parsedLevel);
                }
                
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
            
            // Reset state machine to MOVE
            pState.currentState = PlayerState.MOVE;
            pState.stomping = false;
            pState.stompHangTime = 0;
            pState.stompLanded = false;
            pState.ghostChargeTime = 0;
            pState.ghostActive = false;
            
            // Give invincibility frames after respawn (using constant)
            pState.invincible = true;
            pState.invincibleTime = PLAYER.INVINCIBILITY_TIME;
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
              const pState = playerStateRef.current;
              
              if (obj.type === 'coin') {
                setInventory({ coinCount: inv.coinCount + 1, score: inv.score + 1 });
                soundSystem.playSfx(SoundEffects.GEM1, 0.5);
                
                // Track coins toward glow mode powerup
                pState.coinsForPowerup++;
                
                // Check if enough coins for glow mode (difficulty-based)
                // TODO: Get difficulty from game settings, for now use Kids
                const coinsNeeded = PLAYER.COINS_PER_POWERUP_KIDS;
                const glowDuration = PLAYER.GLOW_DURATION_KIDS;
                
                if (pState.coinsForPowerup >= coinsNeeded && !pState.glowMode) {
                  // Activate glow mode!
                  pState.glowMode = true;
                  pState.glowTime = glowDuration;
                  pState.invincible = true;  // Glow mode grants invincibility
                  pState.invincibleTime = glowDuration;
                  pState.coinsForPowerup = 0;  // Reset counter
                  soundSystem.playSfx(SoundEffects.DING, 1.0);  // Power-up sound
                }
              } else if (obj.type === 'ruby') {
                const newRubyCount = inv.rubyCount + 1;
                setInventory({ rubyCount: newRubyCount, score: inv.score + 3 });
                soundSystem.playSfx(SoundEffects.GEM2, 0.5);
                
                // WIN CONDITION: Collecting 3 rubies (MAX_GEMS_PER_LEVEL) completes the level
                if (newRubyCount >= PLAYER.MAX_GEMS_PER_LEVEL) {
                  const pState = playerStateRef.current;
                  if (!pState.levelWon) {
                    pState.levelWon = true;
                    pState.currentState = PlayerState.WIN;
                    soundSystem.playSfx(SoundEffects.DING, 1.0);
                    
                    // Trigger level complete after a short delay
                    setTimeout(() => {
                      completeLevel();
                    }, 500);
                  }
                }
              } else if (obj.type === 'pearl') {
                setInventory({ pearls: inv.pearls + 1, score: inv.score + 5 });
                soundSystem.playSfx(SoundEffects.GEM2, 0.5);
              } else if (obj.type === 'diary') {
                const newDiaryCount = inv.diaryCount + 1;
                setInventory({ diaryCount: newDiaryCount, score: inv.score + 50 });
                soundSystem.playSfx(SoundEffects.DING, 0.5);
                
                // Save diary collection to persistent store
                storeCollectDiary(state.currentLevel, newDiaryCount);
                
                // Show diary overlay with entry content
                const canvasDiary = canvasDiaryRef.current;
                const diaryEntry = getDiaryByCollectionOrder(newDiaryCount);
                if (canvasDiary && diaryEntry) {
                  // Pause the game while showing diary
                  const pState = playerStateRef.current;
                  pState.currentState = PlayerState.FROZEN;
                  
                  canvasDiary.show(diaryEntry, () => {
                    // Resume when diary is closed
                    if (pState.currentState === PlayerState.FROZEN) {
                      pState.currentState = PlayerState.MOVE;
                    }
                  });
                }
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
                
                // Spawn crush flash effect at enemy position
                effectsSystem.spawnCrushFlash(
                  objPos.x + obj.width / 2,
                  objPos.y + obj.height / 2
                );
                
                // Bounce player up
                player.getVelocity().y = -200;
                
                soundSystem.playSfx(SoundEffects.STOMP);
                
                // Award points
                const inv = getInventory();
                setInventory({ score: inv.score + 25 });
              } else if (!pState.invincible && pState.currentState !== PlayerState.HIT_REACT) {
                // Enemy damages player (only if not invincible and not in hit reaction)
                const inv = getInventory();
                if (inv.lives > 0) {
                  const newLives = inv.lives - 1;
                  setInventory({ lives: newLives });
                  soundSystem.playSfx(SoundEffects.THUMP);
                  
                  // Enter HIT_REACT state (matching original HIT_REACT_TIME = 0.5s)
                  pState.currentState = PlayerState.HIT_REACT;
                  pState.hitReactTimer = PLAYER.HIT_REACT_TIME;
                  
                  // Screen shake for damage feedback
                  cameraSystem.shake(8, 0.3);
                  
                  if (newLives <= 0) {
                    // Enter DEAD state, then game over
                    pState.currentState = PlayerState.DEAD;
                    playCutscene(CutsceneType.KYLE_DEATH);
                    return;
                  }
                  
                  // Grant invincibility frames (INVINCIBILITY_TIME from original)
                  pState.invincible = true;
                  pState.invincibleTime = PLAYER.INVINCIBILITY_TIME;
                  
                  // Knock player back
                  const knockbackDir = playerPos.x < objPos.x ? -1 : 1;
                  player.setVelocity(knockbackDir * 200, -150);
                }
              }
            }
          }
        });
      }
      
      // Update player state machine (using existing pState from death handling above)
      
      // Update HIT_REACT state timer
      if (pState.currentState === PlayerState.HIT_REACT) {
        pState.hitReactTimer -= deltaTime;
        if (pState.hitReactTimer <= 0) {
          pState.currentState = PlayerState.MOVE;
          pState.hitReactTimer = 0;
        }
      }
      
      // Update invincibility timer
      if (pState.invincible) {
        pState.invincibleTime -= deltaTime;
        if (pState.invincibleTime <= 0) {
          pState.invincible = false;
        }
      }
      
      // Update glow mode timer (separate from invincibility in case we extend glow)
      if (pState.glowMode) {
        pState.glowTime -= deltaTime;
        if (pState.glowTime <= 0) {
          pState.glowMode = false;
          pState.glowTime = 0;
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

      // Save previous ground state for landing detection
      pState.wasTouchingGround = pState.touchingGround;
      
      // Check if grounded
      pState.touchingGround = player.touchingGround();
      
      // Detect landing (just hit the ground this frame)
      const justLanded = pState.touchingGround && !pState.wasTouchingGround;
      if (justLanded) {
        // Spawn dust effect at player's feet
        effectsSystem.spawnDust(position.x + PLAYER.WIDTH / 2, position.y + PLAYER.HEIGHT);
        effectsSystem.spawnDust(position.x + PLAYER.WIDTH / 2 - 10, position.y + PLAYER.HEIGHT);
        effectsSystem.spawnDust(position.x + PLAYER.WIDTH / 2 + 10, position.y + PLAYER.HEIGHT);
      }

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

      // Stomp attack (with hang time matching original)
      if (input.attack && inTheAir && !pState.stomping && pState.currentState === PlayerState.MOVE) {
        // Enter stomp state
        pState.currentState = PlayerState.STOMP;
        pState.stomping = true;
        pState.stompTime = gameTime;
        pState.stompHangTime = PLAYER.STOMP_AIR_HANG_TIME;
        pState.stompLanded = false;
        
        // Freeze position momentarily for hang time (if STOMP_AIR_HANG_TIME > 0)
        if (PLAYER.STOMP_AIR_HANG_TIME > 0) {
          velocity.x = 0;
          velocity.y = 0;
        } else {
          // No hang time, start stomp immediately
          velocity.y = PLAYER.STOMP_VELOCITY;
        }
        soundSys.playSfx(SoundEffects.STOMP);
      }

      // Handle stomp hang time
      if (pState.stomping && pState.stompHangTime > 0) {
        pState.stompHangTime -= deltaTime;
        // Keep velocity at 0 during hang time
        velocity.x = 0;
        velocity.y = 0;
        
        // When hang time ends, apply stomp velocity
        if (pState.stompHangTime <= 0) {
          velocity.y = PLAYER.STOMP_VELOCITY;
        }
      }

      // Reset stomp when landing - with camera shake and effects
      if (pState.stomping && pState.touchingGround && !pState.stompLanded) {
        pState.stompLanded = true;
        
        // Camera shake on stomp landing (matching original STOMP_SHAKE_MAGNITUDE)
        const cameraSystem = systemRegistryRef.current?.cameraSystem;
        if (cameraSystem) {
          cameraSystem.shake(PLAYER.STOMP_SHAKE_MAGNITUDE, PLAYER.STOMP_DELAY_TIME);
        }
        
        // Spawn dust/impact effects
        effectsSystem.spawnDust(position.x + PLAYER.WIDTH / 2, position.y + PLAYER.HEIGHT);
        effectsSystem.spawnDust(position.x + PLAYER.WIDTH / 2 - 15, position.y + PLAYER.HEIGHT);
        effectsSystem.spawnDust(position.x + PLAYER.WIDTH / 2 + 15, position.y + PLAYER.HEIGHT);
        
        // Reset stomp state
        pState.stomping = false;
        pState.currentState = PlayerState.MOVE;
      }

      // Ghost mechanic - hold attack on ground to spawn ghost (from original)
      if (input.attack && pState.touchingGround && !pState.stomping && !pState.ghostActive) {
        // Charge ghost while holding attack on ground
        pState.ghostChargeTime += deltaTime;
        
        // Visual feedback could be added here (player glowing, etc.)
        
        // When fully charged, spawn ghost
        if (pState.ghostChargeTime >= PLAYER.GHOST_CHARGE_TIME) {
          pState.ghostActive = true;
          pState.ghostChargeTime = 0;
          soundSys.playSfx(SoundEffects.POSSESSION, 0.7);
          
          // Spawn ghost entity using GhostComponent
          const ghostFactory = systemRegistryRef.current?.gameObjectFactory;
          const inv = getInventory();
          if (ghostFactory && player) {
            const playerPos = player.getPosition();
            const ghost = ghostFactory.spawnGhost(playerPos.x, playerPos.y - 32, inv.rubyCount);
            
            if (ghost) {
              // Camera should follow the ghost
              const camera = systemRegistryRef.current?.cameraSystem;
              if (camera) {
                camera.setTarget(ghost);
              }
              
              // Player is frozen during ghost possession
              pState.currentState = PlayerState.FROZEN;
            }
          }
        }
      } else if (!input.attack) {
        // Reset charge when attack is released
        pState.ghostChargeTime = 0;
      }
      
      // Check if ghost has been released/destroyed (camera returned to player)
      if (pState.ghostActive && pState.currentState === PlayerState.FROZEN) {
        const camera = systemRegistryRef.current?.cameraSystem;
        const currentTarget = camera?.getTarget();
        
        // If camera target is null or player, ghost was released
        if (!currentTarget || currentTarget === player) {
          // Transition to post-ghost delay
          pState.currentState = PlayerState.POST_GHOST_DELAY;
          pState.postGhostDelay = PLAYER.GHOST_REACTIVATION_DELAY;
          
          // Return camera to player
          if (camera && player) {
            camera.setTarget(player);
          }
        }
      }
      
      // Handle post-ghost delay (after ghost returns to player)
      if (pState.currentState === PlayerState.POST_GHOST_DELAY) {
        pState.postGhostDelay -= deltaTime;
        if (pState.postGhostDelay <= 0) {
          pState.currentState = PlayerState.MOVE;
          pState.ghostActive = false;
        }
      }

      // Apply gravity (skip during stomp hang time)
      if (!pState.stomping || pState.stompHangTime <= 0) {
        velocity.y += PLAYER.GRAVITY * deltaTime;
      }

      // Clamp velocity
      velocity.x = Math.max(-PLAYER.MAX_GROUND_HORIZONTAL_SPEED, Math.min(PLAYER.MAX_GROUND_HORIZONTAL_SPEED, velocity.x));
      velocity.y = Math.max(-PLAYER.MAX_UPWARD_SPEED * 2, Math.min(1000, velocity.y));

      // Friction on ground
      if (pState.touchingGround && moveX === 0) {
        velocity.x *= 0.85;
        if (Math.abs(velocity.x) < 1) velocity.x = 0;
      }

      // Move player (simple integration with separate X/Y collision handling)
      const tileSize = 32;
      
      // First, try horizontal movement
      const newX = position.x + velocity.x * deltaTime;
      const hCollision = collisionSys.checkTileCollision(
        newX, position.y, player.width, player.height, velocity.x, 0
      );
      
      if (hCollision.leftWall) {
        // Snap to right edge of tile
        const tileX = Math.floor(position.x / tileSize);
        position.x = (tileX + 1) * tileSize;
        velocity.x = 0;
        player.setLastTouchedLeftWallTime(gameTime);
      } else if (hCollision.rightWall) {
        // Snap to left edge of tile
        const tileX = Math.floor((newX + player.width) / tileSize);
        position.x = tileX * tileSize - player.width;
        velocity.x = 0;
        player.setLastTouchedRightWallTime(gameTime);
      } else {
        position.x = newX;
      }
      
      // Then, try vertical movement
      const newY = position.y + velocity.y * deltaTime;
      const vCollision = collisionSys.checkTileCollision(
        position.x, newY, player.width, player.height, 0, velocity.y
      );

      // Apply vertical collision response
      if (vCollision.grounded) {
        // Snap to top of the solid tile (player bottom aligns with tile top)
        const bottomTileY = Math.floor((newY + player.height) / tileSize);
        position.y = bottomTileY * tileSize - player.height;
        velocity.y = 0;
        player.setLastTouchedFloorTime(gameTime);
      } else if (vCollision.ceiling) {
        // Snap to bottom of the solid tile (player top aligns with tile bottom)
        const topTileY = Math.floor(newY / tileSize);
        position.y = (topTileY + 1) * tileSize;
        velocity.y = 0;
        player.setLastTouchedCeilingTime(gameTime);
      } else {
        position.y = newY;
      }
      
      // Clamp to world bounds
      const levelSystem = levelSystemRef.current;
      if (levelSystem) {
        const levelWidth = levelSystem.getLevelWidth();
        
        // Horizontal bounds
        if (position.x < 0) {
          position.x = 0;
          velocity.x = 0;
        } else if (position.x + player.width > levelWidth) {
          position.x = levelWidth - player.width;
          velocity.x = 0;
        }
        
        // Vertical bounds - top
        if (position.y < 0) {
          position.y = 0;
          velocity.y = 0;
        }
        // Note: Bottom bound is handled by death zones, not clamping
      }

      player.setBackgroundCollisionNormal(vCollision.normal.y !== 0 ? vCollision.normal : hCollision.normal);
    };

    // Render callback
    let renderCount = 0;
    gameLoop.setRenderCallback((): void => {
      renderCount++;
      if (renderCount === 1 || renderCount === 60) {
        console.warn('[Game Render]', { renderCount, tileMapLayers: tileMapRendererRef.current?.getLayerCount() });
      }
      
      // Clear canvas
      renderSystem.clear('#1a1a2e');

      // Draw scrolling background image
      const bgImage = backgroundImageRef.current;
      if (bgImage) {
        const ctx = (renderSystem as unknown as { ctx: CanvasRenderingContext2D }).ctx;
        // focusPosition is already the top-left corner of the camera viewport
        const cameraX = cameraSystem.getFocusPositionX();
        const cameraY = cameraSystem.getFocusPositionY();
        
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
          
          // Check state machine first for special states
          if (pState.currentState === PlayerState.HIT_REACT) {
            // HIT_REACT animation - hit/damaged pose
            animState = 'hit';
            animFrames = ['andou_hit'];
            looping = false;
          } else if (pState.currentState === PlayerState.DEAD || pState.isDying) {
            // DEAD animation - death sequence
            animState = 'dead';
            animFrames = ['andou_die01', 'andou_die02'];
            looping = false;
          } else if (pState.stomping) {
            // STOMP animation - 4 frames, not looping
            animState = 'stomp';
            animFrames = ['andou_stomp01', 'andou_stomp02', 'andou_stomp03', 'andou_stomp04'];
            looping = false;
          } else if (pState.ghostChargeTime > 0) {
            // Charging ghost - could use a special charging animation
            // For now, use a slight variation (maybe flyup frames to show charging)
            animState = 'charge';
            animFrames = ['andou_flyup01'];
            looping = false;
          } else if (pState.touchingGround) {
            // On ground
            if (absVelX < 30) {
              // IDLE - standing still
              animState = 'idle';
              animFrames = ['andou_stand'];
            } else if (absVelX > 200) {
              // MOVE_FAST - running fast (adjusted threshold for ground max speed 500)
              animState = 'move_fast';
              animFrames = ['andou_diagmore01'];
            } else {
              // MOVE - walking/running
              animState = 'move';
              animFrames = ['andou_diag01'];
            }
          } else {
            // In air
            if (pState.rocketsOn) {
              // Boosting with jets
              // Note: In canvas, negative vel.y = going up, positive = going down
              if (absVelX < 50 && vel.y < -50) {
                // BOOST_UP - going mostly up (strong upward velocity)
                animState = 'boost_up';
                animFrames = ['andou_flyup02', 'andou_flyup03'];
                looping = true;
              } else if (absVelX > 100) {
                // BOOST_MOVE_FAST - fast diagonal boost (adjusted for air max 150)
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
              // Falling without boost - show falling/gliding animations
              if (absVelX < 10) {
                // Falling straight down - use flyup frames (looks like falling)
                animState = 'fall';
                animFrames = ['andou_flyup01'];
              } else if (absVelX > 100) {
                // Fast horizontal movement while falling
                animState = 'fall_fast';
                animFrames = ['andou_diagmore01'];
              } else {
                // Normal falling with some horizontal movement
                animState = 'fall_move';
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
          
          // Get canvas context for glow effect
          const ctx = renderSystem.getContext();
          
          // Draw player sprite or fallback rectangle
          if (renderSystem.hasSprite(spriteName)) {
            const scaleX = obj.facingDirection.x < 0 ? -1 : 1;
            
            // Apply glow effect when in glow mode
            if (pState.glowMode && ctx) {
              ctx.save();
              // Pulsating glow effect - oscillates based on time
              const glowIntensity = 15 + 10 * Math.sin(Date.now() / 100);
              ctx.shadowColor = '#FFD700';  // Golden glow color
              ctx.shadowBlur = glowIntensity;
              // Draw multiple times for stronger glow
              renderSystem.drawSprite(spriteName, pos.x - 8, pos.y - 8, 0, 10, 1, scaleX, 1);
              ctx.shadowColor = '#FFFFFF';  // Inner white glow
              ctx.shadowBlur = glowIntensity / 2;
              renderSystem.drawSprite(spriteName, pos.x - 8, pos.y - 8, 0, 10, 1, scaleX, 1);
              ctx.restore();
            } else {
              renderSystem.drawSprite(spriteName, pos.x - 8, pos.y - 8, 0, 10, 1, scaleX, 1);
            }
          } else {
            // Fallback green rectangle for player (with glow if needed)
            if (pState.glowMode && ctx) {
              ctx.save();
              ctx.shadowColor = '#FFD700';
              ctx.shadowBlur = 20;
              renderSystem.drawRect(pos.x, pos.y, obj.width, obj.height, '#4caf50', 10);
              ctx.restore();
            } else {
              renderSystem.drawRect(pos.x, pos.y, obj.width, obj.height, '#4caf50', 10);
            }
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

      // Render visual effects (explosions, smoke, etc.)
      const ctx = (renderSystem as unknown as { ctx: CanvasRenderingContext2D }).ctx;
      // focusPosition is already the top-left corner of the camera viewport
      const effectsCameraX = cameraSystem.getFocusPositionX();
      const effectsCameraY = cameraSystem.getFocusPositionY();
      effectsSystem.render(ctx, effectsCameraX, effectsCameraY);

      // Swap and render - focusPosition is already the top-left corner for world-space objects
      const cameraTopLeftX = cameraSystem.getFocusPositionX();
      const cameraTopLeftY = cameraSystem.getFocusPositionY();
      renderSystem.swap(cameraTopLeftX, cameraTopLeftY);
      
      // === Canvas UI Layer (rendered after swap, in screen space) ===
      
      // Update and render Canvas HUD
      const canvasHUD = canvasHUDRef.current;
      if (canvasHUD) {
        const pState = playerStateRef.current;
        const inventory = getInventory();
        canvasHUD.setFuel(pState.fuel / PLAYER.FUEL_AMOUNT);
        canvasHUD.setInventory(inventory.coinCount, inventory.rubyCount);
        canvasHUD.setShowFPS(currentSettings.showFPS);
        canvasHUD.setFPS(gameLoop.getFPS());
        canvasHUD.update(1 / 60); // ~60fps deltaTime
        canvasHUD.render();
      }
      
      // Update and render Canvas Controls (if enabled)
      const canvasControls = canvasControlsRef.current;
      if (canvasControls && currentSettings.onScreenControlsEnabled) {
        const iSystem = systemRegistryRef.current?.inputSystem;
        if (iSystem) {
          canvasControls.setKeyboardState(
            iSystem.isMovingLeft(),
            iSystem.isMovingRight(),
            iSystem.isJumpActive(),
            iSystem.isAttackActive()
          );
        }
        canvasControls.render();
      }
      
      // Update and render Canvas Dialog (if active)
      const canvasDialog = canvasDialogRef.current;
      if (canvasDialog && canvasDialog.isActive()) {
        canvasDialog.update(1 / 60);
        canvasDialog.render();
      }
      
      // Update and render Canvas Cutscene (if active)
      const canvasCutscene = canvasCutsceneRef.current;
      if (canvasCutscene && canvasCutscene.isActive()) {
        canvasCutscene.update(1 / 60);
        canvasCutscene.render();
      }
      
      // Update and render Canvas Pause Menu (if active)
      const canvasPauseMenu = canvasPauseMenuRef.current;
      if (canvasPauseMenu && canvasPauseMenu.isShowing()) {
        canvasPauseMenu.render();
      }
      
      // Update and render Canvas Game Over Screen (if active)
      const canvasGameOver = canvasGameOverRef.current;
      if (canvasGameOver && canvasGameOver.isShowing()) {
        canvasGameOver.update(1 / 60);
        canvasGameOver.render();
      }
      
      // Update and render Canvas Level Complete Screen (if active)
      const canvasLevelComplete = canvasLevelCompleteRef.current;
      if (canvasLevelComplete && canvasLevelComplete.isShowing()) {
        canvasLevelComplete.update(1 / 60);
        canvasLevelComplete.render();
      }
      
      // Update and render Canvas Diary Overlay (if active)
      const canvasDiary = canvasDiaryRef.current;
      if (canvasDiary && canvasDiary.isVisible()) {
        canvasDiary.update(1 / 60);
        canvasDiary.render();
      }
    });

    setIsInitialized(true);

    // NOTE: Game loop is started by initializeGame() after level loads
    // This prevents rendering before tiles are ready

    // Cleanup
    return (): void => {
      hasShownIntroDialogRef.current = false; // Reset for strict mode double-render
      gameLoop.stop();
      inputSystem.destroy();
      soundSystem.destroy();
    };
  }, [width, height, pauseGame, resumeGame, gameOver, completeLevel, setLevel, playCutscene, currentSettings.onScreenControlsEnabled, currentSettings.showFPS, state.currentLevel, storeRecordLevelAttempt, storeCollectDiary]);

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
        
        {/* All UI is now Canvas-based, rendered in the game loop */}
      </div>
    </div>
  );
}

/**
 * Game Component - Main game canvas and loop
 * Fully integrated game with proper rendering and physics
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState, ActionType } from '../types';
import { GameLoop } from '../engine/GameLoop';
import { SystemRegistry, sSystemRegistry } from '../engine/SystemRegistry';
import { RenderSystem } from '../engine/RenderSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem, SoundEffects } from '../engine/SoundSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { CollisionSystem } from '../engine/CollisionSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { HotSpotSystem, HotSpotType } from '../engine/HotSpotSystem';
import { AnimationSystem } from '../engine/AnimationSystem';
import { EffectsSystem } from '../engine/EffectsSystem';
import { ChannelSystem } from '../engine/ChannelSystem';
import { gameFlowEvent, GameFlowEventType } from '../engine/GameFlowEvent';
import { CanvasHUD } from '../engine/CanvasHUD';
import { CanvasControls } from '../engine/CanvasControls';
import { CanvasDialog } from '../engine/CanvasDialog';
import { CanvasCutscene } from '../engine/CanvasCutscene';
import { CanvasPauseMenu } from '../engine/CanvasPauseMenu';
import { CanvasGameOverScreen } from '../engine/CanvasGameOverScreen';
import { CanvasLevelCompleteScreen } from '../engine/CanvasLevelCompleteScreen';
import { CanvasDiaryOverlay } from '../engine/CanvasDiaryOverlay';
import { CanvasEndingStatsScreen } from '../engine/CanvasEndingStatsScreen';
import { GameObjectManager } from '../entities/GameObjectManager';
import { GameObjectFactory, GameObjectType } from '../entities/GameObjectFactory';
import { GameObject } from '../entities/GameObject';
import { DoorAnimationComponent, DoorAnimation } from '../entities/components/DoorAnimationComponent';
import { ButtonAnimation } from '../entities/components/ButtonAnimationComponent';
import { SpriteComponent } from '../entities/components/SpriteComponent';
import { PatrolComponent } from '../entities/components/PatrolComponent';
import { LevelSystem } from '../levels/LevelSystemNew';
import { TileMapRenderer } from '../levels/TileMapRenderer';
import { generatePlaceholderTileset } from '../utils/PlaceholderSprites';
import { gameSettings, getDifficultySettings } from '../utils/GameSettings';
import { setInventory, resetInventory, getInventory } from '../entities/components/InventoryComponent';
import { getDialogsForLevel, type Dialog } from '../data/dialogs';
import { getDiaryByCollectionOrder } from '../data/diaries';
import { assetPath } from '../utils/helpers';
import { CutsceneType, getCutscene } from '../data/cutscenes';
import { UIStrings } from '../data/strings';
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
  // Collision box dimensions (smaller than sprite)
  // Original Java: sprite 64x64, collision box 32x48 with offset (16, 0)
  WIDTH: 32,
  HEIGHT: 48,
  
  // Stomp attack constants (from original)
  STOMP_VELOCITY: 1000, // Positive = downward in canvas coordinates
  STOMP_DELAY_TIME: 0.15,     // Hitstop duration on stomp impact
  STOMP_AIR_HANG_TIME: 0.0,   // Time to hang in air before stomp
  STOMP_SHAKE_MAGNITUDE: 15,  // Camera shake intensity on stomp land
  STOMP_VIBRATE_TIME: 0.05,   // Vibration duration
  ATTACK_PAUSE_DELAY: (1.0 / 60.0) * 4, // ~67ms pause on attack (4 frames at 60fps)
  
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
  
  // Note: Glow mode constants moved to DifficultySettings in useGameStore.ts
  // Access via getDifficultySettings().coinsPerPowerup and .glowDuration
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
  const storeUnlockExtra = useGameStore((s) => s.unlockExtra);
  
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
  const canvasEndingStatsRef = useRef<CanvasEndingStatsScreen | null>(null);
  
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
    
    // Jet fire animation (separate from player animation)
    jetFrame: 0,
    jetTimer: 0,
    
    // Sparks animation (shown when hit)
    sparkFrame: 0,
    sparkTimer: 0,
    
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
    pState.jetFrame = 0;
    pState.jetTimer = 0;
    pState.sparkFrame = 0;
    pState.sparkTimer = 0;
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
  const [dialogConversationIndex, setDialogConversationIndex] = useState(0);
  const [dialogSingleMode, setDialogSingleMode] = useState(false);
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
  // For cutscene levels (no player), dialog is triggered by NPC via GameFlowEvent
  // For playable levels, dialog is triggered via hotspots
  useEffect(() => {
    if (!levelLoading && isInitialized && !hasShownIntroDialogRef.current) {
      const levelSystem = levelSystemRef.current;
      const gameObjectManager = systemRegistryRef.current?.gameObjectManager;
      if (levelSystem && gameObjectManager) {
        const player = gameObjectManager.getPlayer();
        if (!player) {
          // Cutscene level - dialog will be triggered by NPC via GameFlowEvent
          console.warn('[Game] Cutscene level - waiting for NPC to trigger dialog via hotspot, level:', state.currentLevel);
        } else {
          console.warn('[Game] Playable level - dialog will be triggered by hotspots, level:', state.currentLevel);
        }
      }
    }
  }, [levelLoading, isInitialized, state.currentLevel]);

  // Subscribe to GameFlowEvent for NPC-triggered dialogs
  // NPCs use GameFlowEvent to trigger dialogs when they hit NPC_SELECT_DIALOG hotspots
  useEffect(() => {
    if (!isInitialized) return;
    
    const handleGameFlowEvent = (event: GameFlowEventType, dataIndex: number): void => {
      console.warn('[Game] GameFlowEvent received:', event, 'dataIndex:', dataIndex);
      
      if (event === GameFlowEventType.SHOW_DIALOG_CHARACTER1 || 
          event === GameFlowEventType.SHOW_DIALOG_CHARACTER2) {
        // NPC triggered a dialog
        const levelSystem = levelSystemRef.current;
        if (levelSystem) {
          const levelId = levelSystem.getCurrentLevelId();
          const levelInfo = levelSystem.getLevelInfo(levelId);
          
          if (levelInfo) {
            const dialogs = getDialogsForLevel(levelInfo.file);
            // Character 1 uses dialogs[0], Character 2 uses dialogs[1]
            const dialogIndex = event === GameFlowEventType.SHOW_DIALOG_CHARACTER1 ? 0 : 1;
            
            if (dialogs.length > dialogIndex) {
              const dialog = dialogs[dialogIndex];
              // dataIndex is the conversation index within the dialog
              const conversationIdx = Math.min(dataIndex, dialog.conversations.length - 1);
              
              console.warn('[Game] Showing NPC dialog - character:', dialogIndex + 1, 
                'conversation:', conversationIdx, 'level:', levelInfo.file);
              
              hasShownIntroDialogRef.current = true;
              setDialogConversationIndex(conversationIdx);
              // For NPC-triggered dialogs, show all remaining conversations
              setDialogSingleMode(false);
              setActiveDialog(dialog);
            }
          }
        }
      } else if (event === GameFlowEventType.GO_TO_NEXT_LEVEL) {
        // NPC reached end of level - advance to next level
        const levelSystem = levelSystemRef.current;
        const gameObjectManager = systemRegistryRef.current?.gameObjectManager;
        if (levelSystem && gameObjectManager) {
          const nextLevelId = levelSystem.getNextLevelId();
          console.warn('[Game] NPC triggered GO_TO_NEXT_LEVEL - advancing to:', nextLevelId);
          if (nextLevelId !== null) {
            levelSystem.unlockLevel(nextLevelId);
            setLevel(nextLevelId);
            setLevelLoading(true);
            hasShownIntroDialogRef.current = false;
            levelSystem.loadLevel(nextLevelId).then(() => {
              gameObjectManager.commitUpdates();
              setLevelLoading(false);
            });
          }
        }
      }
    };
    
    gameFlowEvent.addListener(handleGameFlowEvent);
    
    return (): void => {
      gameFlowEvent.removeListener(handleGameFlowEvent);
    };
  }, [isInitialized, setLevel]);

  // Track previous level to detect level changes
  const prevLevelRef = useRef(state.currentLevel);
  // Track whether the previous level was "in the past" (memory flashback)
  const prevLevelInThePastRef = useRef(false);
  
  // Reload level when currentLevel changes (e.g., from LevelSelect)
  useEffect(() => {
    // Skip if not initialized yet
    if (!isInitialized) return;
    
    // Skip if level hasn't actually changed
    if (prevLevelRef.current === state.currentLevel) return;
    
    // Get the previous level's inThePast status before updating
    const levelSystem = levelSystemRef.current;
    const gameObjectManager = systemRegistryRef.current?.gameObjectManager;
    if (!levelSystem || !gameObjectManager) return;
    
    const prevLevelInfo = levelSystem.getLevelInfo(prevLevelRef.current);
    const wasInThePast = prevLevelInfo?.inThePast ?? false;
    
    // Update previous level
    prevLevelRef.current = state.currentLevel;
    
    setLevelLoading(true);
    hasShownIntroDialogRef.current = false;
    
    levelSystem.loadLevel(state.currentLevel).then(() => {
      gameObjectManager.commitUpdates();
      
      // Check if we need to show memory playback toast
      const newLevelInfo = levelSystem.getLevelInfo(state.currentLevel);
      const isInThePast = newLevelInfo?.inThePast ?? false;
      
      // Show toast based on transition (matching original Game.java logic)
      if (canvasHUDRef.current) {
        if (isInThePast) {
          // Entering a memory/flashback level
          canvasHUDRef.current.showToast(UIStrings.memory_playback_start, true);
        } else if (wasInThePast) {
          // Exiting a memory/flashback level back to present
          canvasHUDRef.current.showToast(UIStrings.memory_playback_complete, true);
        }
      }
      // Update the ref for next transition
      prevLevelInThePastRef.current = isInThePast;
      
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
            // Get current level's inThePast status before advancing
            const currentLevelInfo = levelSys.getLevelInfo(currentLevelRef.current);
            const wasInThePast = currentLevelInfo?.inThePast ?? false;
            
            const nextLevelId = levelSys.getNextLevelId();
            console.warn('[Game] Cutscene level - advancing to next level:', nextLevelId);
            if (nextLevelId !== null) {
              levelSys.unlockLevel(nextLevelId);
              setLevel(nextLevelId);
              setLevelLoading(true);
              hasShownIntroDialogRef.current = false;
              levelSys.loadLevel(nextLevelId).then(() => {
                gameObjectMgr?.commitUpdates();
                
                // Check if we need to show memory playback toast
                const newLevelInfo = levelSys.getLevelInfo(nextLevelId);
                const isInThePast = newLevelInfo?.inThePast ?? false;
                if (canvasHUDRef.current) {
                  if (isInThePast && !wasInThePast) {
                    canvasHUDRef.current.showToast(UIStrings.memory_playback_start, true);
                  } else if (!isInThePast && wasInThePast) {
                    canvasHUDRef.current.showToast(UIStrings.memory_playback_complete, true);
                  }
                }
                prevLevelInThePastRef.current = isInThePast;
                
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
      
      canvasDialog.show(
        activeDialog, 
        handleDialogComplete, 
        handleDialogComplete,
        dialogConversationIndex,
        dialogSingleMode
      );
    } else {
      canvasDialog.hide();
    }
  }, [activeDialog, dialogConversationIndex, dialogSingleMode, setLevel, resetPlayerState]);

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
          // Ending cutscenes show stats then return to main menu
          endCutscene();
          
          // Show ending stats screen
          const canvasEndingStats = canvasEndingStatsRef.current;
          if (canvasEndingStats) {
            // Get total stats from store
            const gameState = useGameStore.getState();
            const totalStats = gameState.progress.totalStats;
            const inventory = getInventory();
            
            // Determine ending type based on cutscene
            let endingType: 'good' | 'bad' | 'neutral' = 'neutral';
            if (state.activeCutscene === CutsceneType.WANDA_ENDING) {
              endingType = 'good';
            } else if (state.activeCutscene === CutsceneType.KABOCHA_ENDING || 
                       state.activeCutscene === CutsceneType.ROKUDOU_ENDING) {
              endingType = 'bad';
            }
            
            canvasEndingStats.show({
              totalPlayTime: totalStats.totalPlayTime,
              totalScore: inventory.score,
              totalCoinsCollected: totalStats.totalCoinsCollected,
              totalRubiesCollected: totalStats.totalRubiesCollected,
              totalEnemiesDefeated: totalStats.totalEnemiesDefeated,
              totalDeaths: totalStats.totalDeaths,
              diariesCollected: gameState.progress.diariesCollected.length,
              totalDiaries: 20, // Total diaries in the game
              ending: endingType,
            }, () => {
              // Return to main menu after stats
              goToMainMenu();
            });
          } else {
            // Fallback: just return to main menu
            goToMainMenu();
          }
        } else {
          endCutscene();
        }
      };
      
      canvasCutscene.play(state.activeCutscene, handleCutsceneComplete);
    } else {
      canvasCutscene.stop();
    }
  }, [state.gameState, state.activeCutscene, endCutscene, gameOver, goToMainMenu]);

  // Handle Canvas Pause Menu when game state changes
  useEffect(() => {
    const canvasPauseMenu = canvasPauseMenuRef.current;
    if (!canvasPauseMenu) return;
    
    const currentSoundSystem = systemRegistryRef.current?.soundSystem;
    
    if (state.gameState === GameState.PAUSED) {
      canvasPauseMenu.show((): void => {
        resumeGame();
      });
      // Pause background music
      if (currentSoundSystem) {
        currentSoundSystem.pauseBackgroundMusic();
      }
    } else {
      canvasPauseMenu.hide();
      // Resume background music (if playing state and music enabled)
      if (state.gameState === GameState.PLAYING && currentSoundSystem) {
        const settings = gameSettings.getAll();
        if (settings.musicEnabled) {
          currentSoundSystem.resumeBackgroundMusic();
        }
      }
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
      
      // Unlock extras when final boss is defeated (level 41 = level_final_boss_lab)
      // This enables Linear Mode and Level Select in the Extras menu
      if (state.currentLevel === 41) {
        storeUnlockExtra('linearMode');
        storeUnlockExtra('levelSelect');
        console.warn('[Game] Final boss defeated! Unlocking extras (Linear Mode, Level Select)');
      }
      
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
            // Get current level's inThePast status before advancing
            const currentLevelInfo = levelSys.getLevelInfo(state.currentLevel);
            const wasInThePast = currentLevelInfo?.inThePast ?? false;
            
            const nextLevelId = levelSys.getNextLevelId();
            if (nextLevelId !== null) {
              levelSys.unlockLevel(nextLevelId);
              setLevel(nextLevelId);
              hasShownIntroDialogRef.current = false;
              levelSys.loadLevel(nextLevelId).then(() => {
                // Check if we need to show memory playback toast
                const newLevelInfo = levelSys.getLevelInfo(nextLevelId);
                const isInThePast = newLevelInfo?.inThePast ?? false;
                if (canvasHUDRef.current) {
                  if (isInThePast && !wasInThePast) {
                    canvasHUDRef.current.showToast(UIStrings.memory_playback_start, true);
                  } else if (!isInThePast && wasInThePast) {
                    canvasHUDRef.current.showToast(UIStrings.memory_playback_complete, true);
                  }
                }
                prevLevelInThePastRef.current = isInThePast;
                
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
  }, [state.gameState, state.currentLevel, resumeGame, setLevel, goToMainMenu, resetPlayerState, storeCompleteLevel, storeAddToTotalStats, storeRecordLevelAttempt, storeLevelProgress, storeUnlockExtra]);

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

    // Reset and reuse the global system registry (Strict Mode will run this twice,
    // but cleanup will stop the first game loop)
    // Using sSystemRegistry ensures NPCComponent and other components can access systems
    sSystemRegistry.reset();
    const systemRegistry = sSystemRegistry;
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

    // Channel system (for button/door communication)
    const channelSystem = new ChannelSystem();
    systemRegistry.channelSystem = channelSystem;

    // Hot spot system
    const hotSpotSystem = new HotSpotSystem();
    systemRegistry.register(hotSpotSystem, 'hotSpot');

    // Game flow event system (for NPC dialogs, level transitions, etc.)
    systemRegistry.register(gameFlowEvent, 'gameFlowEvent');

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
    
    // Set up boss death callback to trigger ending cutscenes
    levelSystem.setOnBossDeathCallback((endingType: string) => {
      // Map ending type string to CutsceneType enum
      switch (endingType) {
        case 'KABOCHA_ENDING':
          playCutscene(CutsceneType.KABOCHA_ENDING);
          break;
        case 'WANDA_ENDING':
          playCutscene(CutsceneType.WANDA_ENDING);
          break;
        case 'ROKUDOU_ENDING':
          playCutscene(CutsceneType.ROKUDOU_ENDING);
          break;
        default:
          console.warn(`Unknown ending type: ${endingType}`);
      }
    });
    
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
      
      // Canvas Ending Stats Screen
      const canvasEndingStats = new CanvasEndingStatsScreen(ctx, canvas, width, height);
      canvasEndingStatsRef.current = canvasEndingStats;
      
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
        // Jet fire (shown when boosting with jetpack)
        { name: 'jetfire01', file: 'jetfire01' },
        { name: 'jetfire02', file: 'jetfire02' },
        // Sparks (shown when hit)
        { name: 'spark01', file: 'spark01' },
        { name: 'spark02', file: 'spark02' },
        { name: 'spark03', file: 'spark03' },
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
        // Breakable block (destructible wall)
        { name: 'debris_block', file: 'object_debris_block', w: 32, h: 32 },
        { name: 'debris_piece', file: 'object_debris_piece', w: 16, h: 16 },
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
        // Bat enemy - 4 frames (64x32 actual size)
        { name: 'bat01', file: 'enemy_bat01', w: 64, h: 32 },
        { name: 'bat02', file: 'enemy_bat02', w: 64, h: 32 },
        { name: 'bat03', file: 'enemy_bat03', w: 64, h: 32 },
        { name: 'bat04', file: 'enemy_bat04', w: 64, h: 32 },
        // Sting enemy - 3 frames (64x64 actual size)
        { name: 'sting01', file: 'enemy_sting01', w: 64, h: 64 },
        { name: 'sting02', file: 'enemy_sting02', w: 64, h: 64 },
        { name: 'sting03', file: 'enemy_sting03', w: 64, h: 64 },
        // Onion enemy - 3 frames (64x64 actual size)
        { name: 'onion01', file: 'enemy_onion01', w: 64, h: 64 },
        { name: 'onion02', file: 'enemy_onion02', w: 64, h: 64 },
        { name: 'onion03', file: 'enemy_onion03', w: 64, h: 64 },
        // Brobot enemy - idle & walk (64x64 actual size)
        { name: 'brobot_idle01', file: 'enemy_brobot_idle01', w: 64, h: 64 },
        { name: 'brobot_idle02', file: 'enemy_brobot_idle02', w: 64, h: 64 },
        { name: 'brobot_idle03', file: 'enemy_brobot_idle03', w: 64, h: 64 },
        { name: 'brobot_walk01', file: 'enemy_brobot_walk01', w: 64, h: 64 },
        { name: 'brobot_walk02', file: 'enemy_brobot_walk02', w: 64, h: 64 },
        { name: 'brobot_walk03', file: 'enemy_brobot_walk03', w: 64, h: 64 },
        // Skeleton enemy (64x64 actual size)
        { name: 'skeleton_stand', file: 'enemy_skeleton_stand', w: 64, h: 64 },
        { name: 'skeleton_walk01', file: 'enemy_skeleton_walk01', w: 64, h: 64 },
        { name: 'skeleton_walk02', file: 'enemy_skeleton_walk02', w: 64, h: 64 },
        { name: 'skeleton_walk03', file: 'enemy_skeleton_walk03', w: 64, h: 64 },
        { name: 'skeleton_walk04', file: 'enemy_skeleton_walk04', w: 64, h: 64 },
        { name: 'skeleton_walk05', file: 'enemy_skeleton_walk05', w: 64, h: 64 },
        // Karaguin enemy - 3 frames (32x32 actual size)
        { name: 'karaguin01', file: 'enemy_karaguin01', w: 32, h: 32 },
        { name: 'karaguin02', file: 'enemy_karaguin02', w: 32, h: 32 },
        { name: 'karaguin03', file: 'enemy_karaguin03', w: 32, h: 32 },
        // Mud/Mudman enemy (128x128 actual size)
        { name: 'mudman_stand', file: 'enemy_mud_stand', w: 128, h: 128 },
        { name: 'mudman_idle01', file: 'enemy_mud_idle01', w: 128, h: 128 },
        { name: 'mudman_idle02', file: 'enemy_mud_idle02', w: 128, h: 128 },
        { name: 'mudman_walk01', file: 'enemy_mud_walk01', w: 128, h: 128 },
        { name: 'mudman_walk02', file: 'enemy_mud_walk02', w: 128, h: 128 },
        { name: 'mudman_walk03', file: 'enemy_mud_walk03', w: 128, h: 128 },
        // Pink Namazu enemy (128x128 actual size - sleeping enemy that wakes up)
        { name: 'pinknamazu_stand', file: 'enemy_pinkdude_stand', w: 128, h: 128 },
        { name: 'pinknamazu_sleep01', file: 'enemy_pinkdude_sleep01', w: 128, h: 128 },
        { name: 'pinknamazu_sleep02', file: 'enemy_pinkdude_sleep02', w: 128, h: 128 },
        { name: 'pinknamazu_eyeopen', file: 'enemy_pinkdude_eyeopen', w: 128, h: 128 },
        { name: 'pinknamazu_jump', file: 'enemy_pinkdude_jump', w: 128, h: 128 },
        // Shadow Slime enemy (64x64 actual size)
        { name: 'shadowslime_stand', file: 'enemy_shadowslime_stand', w: 64, h: 64 },
        { name: 'shadowslime_idle01', file: 'enemy_shadowslime_idle01', w: 64, h: 64 },
        { name: 'shadowslime_idle02', file: 'enemy_shadowslime_idle02', w: 64, h: 64 },
        // NPC sprites (64x128 actual size for wanda/kyle, 64x128 for kabocha)
        { name: 'wanda_stand', file: 'enemy_wanda_stand', w: 64, h: 128 },
        { name: 'kyle_stand', file: 'enemy_kyle_stand', w: 64, h: 128 },
        { name: 'kabocha_stand', file: 'enemy_kabocha_stand', w: 64, h: 128 },
        // Evil Kabocha boss (128x128 actual size)
        { name: 'evil_kabocha_stand', file: 'enemy_kabocha_evil_stand', w: 128, h: 128 },
        { name: 'evil_kabocha_walk01', file: 'enemy_kabocha_evil_walk01', w: 128, h: 128 },
        { name: 'evil_kabocha_walk02', file: 'enemy_kabocha_evil_walk02', w: 128, h: 128 },
        { name: 'evil_kabocha_walk03', file: 'enemy_kabocha_evil_walk03', w: 128, h: 128 },
        { name: 'evil_kabocha_walk04', file: 'enemy_kabocha_evil_walk04', w: 128, h: 128 },
        { name: 'evil_kabocha_walk05', file: 'enemy_kabocha_evil_walk05', w: 128, h: 128 },
        { name: 'evil_kabocha_walk06', file: 'enemy_kabocha_evil_walk06', w: 128, h: 128 },
        { name: 'evil_kabocha_hit01', file: 'enemy_kabocha_evil_hit01', w: 128, h: 128 },
        { name: 'evil_kabocha_hit02', file: 'enemy_kabocha_evil_hit02', w: 128, h: 128 },
        { name: 'evil_kabocha_surprised', file: 'enemy_kabocha_evil_surprised', w: 128, h: 128 },
        { name: 'evil_kabocha_die01', file: 'enemy_kabocha_evil_die01', w: 128, h: 128 },
        { name: 'evil_kabocha_die02', file: 'enemy_kabocha_evil_die02', w: 128, h: 128 },
        { name: 'evil_kabocha_die03', file: 'enemy_kabocha_evil_die03', w: 128, h: 128 },
        { name: 'evil_kabocha_die04', file: 'enemy_kabocha_evil_die04', w: 128, h: 128 },
        // Snailbomb enemy (64x64 actual size)
        { name: 'snailbomb_stand', file: 'snailbomb_stand', w: 64, h: 64 },
        { name: 'snailbomb_walk01', file: 'snailbomb_walk01', w: 64, h: 64 },
        { name: 'snailbomb_walk02', file: 'snailbomb_walk02', w: 64, h: 64 },
        { name: 'snailbomb_shoot01', file: 'snailbomb_shoot01', w: 64, h: 64 },
        { name: 'snailbomb_shoot02', file: 'snailbomb_shoot02', w: 64, h: 64 },
        { name: 'snail_bomb', file: 'snail_bomb', w: 16, h: 16 },
        // Rokudou boss enemy (128x128 actual size based on sprites)
        { name: 'rokudou_stand', file: 'enemy_rokudou_fight_stand', w: 128, h: 128 },
        { name: 'rokudou_fly01', file: 'enemy_rokudou_fight_fly01', w: 128, h: 128 },
        { name: 'rokudou_fly02', file: 'enemy_rokudou_fight_fly02', w: 128, h: 128 },
        { name: 'rokudou_shoot01', file: 'enemy_rokudou_fight_shoot01', w: 128, h: 128 },
        { name: 'rokudou_shoot02', file: 'enemy_rokudou_fight_shoot02', w: 128, h: 128 },
        { name: 'rokudou_surprise', file: 'enemy_rokudou_fight_surprise', w: 128, h: 128 },
        { name: 'rokudou_hit01', file: 'enemy_rokudou_fight_hit01', w: 128, h: 128 },
        { name: 'rokudou_hit02', file: 'enemy_rokudou_fight_hit02', w: 128, h: 128 },
        { name: 'rokudou_hit03', file: 'enemy_rokudou_fight_hit03', w: 128, h: 128 },
        { name: 'rokudou_die01', file: 'enemy_rokudou_fight_die01', w: 128, h: 128 },
        { name: 'rokudou_die02', file: 'enemy_rokudou_fight_die02', w: 128, h: 128 },
        { name: 'rokudou_die03', file: 'enemy_rokudou_fight_die03', w: 128, h: 128 },
        { name: 'rokudou_die04', file: 'enemy_rokudou_fight_die04', w: 128, h: 128 },
        // The Source - Final boss (512x512 layered sprites)
        { name: 'source_black', file: 'enemy_source_black', w: 512, h: 512 },
        { name: 'source_body', file: 'enemy_source_body', w: 512, h: 512 },
        { name: 'source_core', file: 'enemy_source_core', w: 512, h: 512 },
        { name: 'source_spikes', file: 'enemy_source_spikes', w: 512, h: 512 },
        { name: 'source_spots', file: 'enemy_source_spots', w: 512, h: 512 },
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
          
          // Show memory playback toast for initial level if it's a flashback
          const initialLevelInfo = levelSystem.getLevelInfo(levelToLoad);
          if (initialLevelInfo?.inThePast && canvasHUDRef.current) {
            canvasHUDRef.current.showToast(UIStrings.memory_playback_start, true);
          }
          prevLevelInThePastRef.current = initialLevelInfo?.inThePast ?? false;
          
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
        
        // Start background music if available and music is enabled
        const settings = gameSettings.getAll();
        if (settings.musicEnabled && soundSystem.isInitialized()) {
          soundSystem.setMusicVolume(settings.musicVolume / 100);
          soundSystem.startBackgroundMusic();
        }
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
    let frameCount = 0;
    gameLoop.setUpdateCallback((deltaTime: number) => {
      frameCount++;
      if (frameCount % 60 === 0) {
        console.warn('[Game] Update tick - state:', gameStateRef.current, 'PLAYING:', GameState.PLAYING, 'match:', gameStateRef.current === GameState.PLAYING);
      }
      if (gameStateRef.current !== GameState.PLAYING) return;

      // Update input
      inputSystem.update();

      // Update time
      timeSystem.update(deltaTime);
      const gameTime = timeSystem.getGameTime();
      // Use frozen-aware delta for game logic (0 when frozen for pause-on-attack effect)
      const gameDelta = timeSystem.getFrameDelta();

      // Get player and input state
      const player = gameObjectManager.getPlayer();
      
      // Check if any blocking UI is active (dialog, cutscene, pause menu, etc.)
      // When blocking UI is active, we should not pass movement input to player
      const isInputBlocked = 
        canvasDialogRef.current?.isActive() ||
        canvasCutsceneRef.current?.isActive() ||
        canvasPauseMenuRef.current?.isShowing() ||
        canvasGameOverRef.current?.isShowing() ||
        canvasLevelCompleteRef.current?.isShowing() ||
        canvasDiaryRef.current?.isVisible() ||
        canvasEndingStatsRef.current?.isShowing();
      
      // Use empty input when blocked, otherwise use real input
      const input = isInputBlocked 
        ? { left: false, right: false, up: false, down: false, jump: false, attack: false, pause: false }
        : inputSystem.getInputState();
      
      if (player) {
        // Update player's internal gameTime before physics so touchingGround() works correctly
        player.setGameTime(gameTime);
        // Player physics update (based on original PlayerComponent.java)
        // Use gameDelta so physics freezes during pause-on-attack
        updatePlayerPhysics(player, input, gameDelta, gameTime, collisionSystem, soundSystem);
      }

      // Update all game objects (use gameDelta so game freezes during pause-on-attack)
      gameObjectManager.update(gameDelta, gameTime);
      
      // Debug: Count NPC objects
      if (frameCount % 120 === 0) {
        let npcCount = 0;
        let activeNpcCount = 0;
        gameObjectManager.forEach((obj) => {
          if (obj.type === 'npc') {
            npcCount++;
            if (obj.isActive()) {
              activeNpcCount++;
              console.warn('[Game] NPC found:', obj.subType, 'active:', obj.isActive(), 'visible:', obj.isVisible(), 'pos:', obj.getPosition().x, obj.getPosition().y);
            }
          }
        });
        console.warn('[Game] NPC count:', npcCount, 'active:', activeNpcCount);
      }
      
      // Update effects system (explosions, smoke, etc.)
      effectsSystem.update(deltaTime);

      // Enemy AI and physics
      gameObjectManager.forEach((obj) => {
        if (obj.type !== 'enemy' || !obj.isVisible() || obj.life <= 0) return;
        
        // Initialize patrol direction if not set
        if (obj.facingDirection.x === 0) {
          obj.facingDirection.x = 1;
        }
        
        const velocity = obj.getVelocity();
        const targetVelocity = obj.getTargetVelocity();
        const acceleration = obj.getAcceleration();
        const position = obj.getPosition();
        
        // Check if enemy has PatrolComponent (proper AI)
        const hasPatrolComponent = obj.getComponent(PatrolComponent as unknown as new (...args: unknown[]) => PatrolComponent) !== null;
        
        // If no PatrolComponent, use simplified inline AI (fallback for special enemies)
        if (!hasPatrolComponent) {
          // Behavior based on enemy type - only for enemies without PatrolComponent
          switch (obj.subType) {
            case 'pink_namazu': {
              // Pink Namazu - special sleeper behavior (stationary for now)
              velocity.x = 0;
              velocity.y = 0;
              break;
            }
            
            case 'evil_kabocha': {
              // Evil Kabocha boss - special behavior
              velocity.x = 0;
              velocity.y = 0;
              break;
            }
            
            default: {
              // Default simple patrol for any enemy without PatrolComponent
              const DEFAULT_SPEED = 50;
              targetVelocity.x = obj.facingDirection.x * DEFAULT_SPEED;
              acceleration.x = 1000;
            }
          }
        }
        
        // === Movement Component Logic ===
        // Interpolate velocity toward target velocity (from original MovementComponent.java)
        if (acceleration.x > 0) {
          const diff = targetVelocity.x - velocity.x;
          if (Math.abs(diff) < 0.1) {
            velocity.x = targetVelocity.x;
          } else {
            const direction = Math.sign(diff);
            velocity.x += direction * acceleration.x * deltaTime;
            // Clamp to target
            if ((direction > 0 && velocity.x > targetVelocity.x) ||
                (direction < 0 && velocity.x < targetVelocity.x)) {
              velocity.x = targetVelocity.x;
            }
          }
        }
        
        // Flying vs ground enemy physics
        const isFlying = obj.subType === 'bat' || obj.subType === 'sting' || obj.subType === 'karaguin';
        
        if (!isFlying) {
          // Gravity for ground enemies
          velocity.y += 500 * deltaTime;
          
          // Wall collision check
          const nextX = position.x + velocity.x * deltaTime;
          const collision = collisionSystem.checkTileCollision(
            nextX, position.y, obj.width, obj.height, velocity.x, velocity.y
          );
          
          if (collision.leftWall || collision.rightWall) {
            // Hit wall - reverse direction
            obj.facingDirection.x *= -1;
            velocity.x = -velocity.x;
            targetVelocity.x = -targetVelocity.x;
            
            // Update touching flags for PatrolComponent
            if (collision.leftWall) {
              obj.setLastTouchedLeftWallTime(gameTime);
            }
            if (collision.rightWall) {
              obj.setLastTouchedRightWallTime(gameTime);
            }
          }
        } else {
          // Flying enemy - interpolate Y velocity too
          if (acceleration.y > 0) {
            const diffY = targetVelocity.y - velocity.y;
            if (Math.abs(diffY) < 0.1) {
              velocity.y = targetVelocity.y;
            } else {
              const directionY = Math.sign(diffY);
              velocity.y += directionY * acceleration.y * deltaTime;
              if ((directionY > 0 && velocity.y > targetVelocity.y) ||
                  (directionY < 0 && velocity.y < targetVelocity.y)) {
                velocity.y = targetVelocity.y;
              }
            }
          }
          
          // Flying enemies reverse at level bounds
          if (position.x < 20 || position.x > (levelSystemRef.current?.getLevelWidth() ?? 960) - 50) {
            obj.facingDirection.x *= -1;
            targetVelocity.x = -targetVelocity.x;
          }
        }
        
        // Update position
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;
        
        // Ground collision for non-flying enemies and turrets
        if (!isFlying && obj.subType !== 'turret') {
          const groundCheck = collisionSystem.checkTileCollision(
            position.x, position.y, obj.width, obj.height, velocity.x, velocity.y
          );
          
          if (groundCheck.grounded) {
            const tileSize = 32;
            const groundY = Math.floor((position.y + obj.height) / tileSize) * tileSize - obj.height;
            position.y = groundY;
            velocity.y = 0;
            obj.setLastTouchedFloorTime(gameTime);
          }
        }
        
        // Update facing direction based on velocity
        if (velocity.x !== 0) {
          obj.facingDirection.x = Math.sign(velocity.x);
        }
      });

      // NPC movement and physics
      gameObjectManager.forEach((obj) => {
        if (obj.type !== 'npc') return;
        if (!obj.isVisible()) {
          console.warn(`[NPC Physics] ${obj.name} is not visible, skipping physics`);
          return;
        }
        
        const velocity = obj.getVelocity();
        const targetVelocity = obj.getTargetVelocity();
        const acceleration = obj.getAcceleration();
        const position = obj.getPosition();
        
        // Debug log for Wanda
        if (obj.subType === 'wanda' && Math.random() < 0.02) {
          console.warn(`[NPC Physics] Wanda pos=(${position.x.toFixed(1)}, ${position.y.toFixed(1)}) vel=(${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)})`);
        }
        
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
        // Use a narrower collision width to avoid detecting side walls as ground
        // NPCs are 64px wide, but we check collision with a centered 32px width
        const collisionMargin = (obj.width - 32) / 2; // Center a 32px wide collision box
        const groundCheck = collisionSystem.checkTileCollision(
          position.x + collisionMargin, position.y, 32, obj.height, velocity.x, velocity.y
        );
        
        // Debug ground check for Wanda
        if (obj.subType === 'wanda' && Math.random() < 0.01) {
          console.warn(`[NPC Ground] Wanda grounded=${groundCheck.grounded} pos.y=${position.y.toFixed(1)} bottom=${(position.y + obj.height).toFixed(1)} tileRow=${Math.floor((position.y + obj.height) / 32)}`);
        }
        
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
        
        // IMPORTANT: Check hotspots AFTER physics update so NPCs don't skip hotspot tiles
        // Get NPCComponent and trigger its hotspot check with updated position
        const npcComponent = obj.getComponent(NPCComponent as unknown as new (...args: unknown[]) => NPCComponent);
        if (npcComponent && hotSpotSystem) {
          // Call the post-physics hotspot check
          npcComponent.checkHotSpotsPostPhysics(obj, deltaTime);
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
            // Get current level's inThePast status before advancing
            const currentLevelInfo = levelSys.getLevelInfo(levelSys.getCurrentLevelId());
            const wasInThePast = currentLevelInfo?.inThePast ?? false;
            
            const nextLevelId = levelSys.getNextLevelId();
            if (nextLevelId !== null) {
              // Unlock and go to next level
              levelSys.unlockLevel(nextLevelId);
              setLevel(nextLevelId);
              // Reload the level system
              levelSys.loadLevel(nextLevelId).then(() => {
                // Check if we need to show memory playback toast
                const newLevelInfo = levelSys.getLevelInfo(nextLevelId);
                const isInThePast = newLevelInfo?.inThePast ?? false;
                if (canvasHUDRef.current) {
                  if (isInThePast && !wasInThePast) {
                    canvasHUDRef.current.showToast(UIStrings.memory_playback_start, true);
                  } else if (!isInThePast && wasInThePast) {
                    canvasHUDRef.current.showToast(UIStrings.memory_playback_complete, true);
                  }
                }
                prevLevelInThePastRef.current = isInThePast;
                
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
        // TALK (8) = generic dialog trigger
        // NPC_SELECT_DIALOG_1_* (32-36) = character 1's dialog, conversation index = hotspot - 32
        // NPC_SELECT_DIALOG_2_* (38-42) = character 2's dialog, conversation index = hotspot - 38
        if (hotSpot === HotSpotType.TALK || (hotSpot >= 32 && hotSpot <= 42)) {
          // Get current level info to load the right dialog
          const levelSys = levelSystemRef.current;
          if (levelSys) {
            const levelId = levelSys.getCurrentLevelId();
            const levelInfo = levelSys.getLevelInfo(levelId);
            
            if (levelInfo) {
              const dialogs = getDialogsForLevel(levelInfo.file);
              
              if (dialogs.length > 0) {
                let dialogFileIndex = 0; // Which dialog file (character) to use
                let conversationIdx = 0;  // Which conversation within that dialog
                
                if (hotSpot === HotSpotType.TALK) {
                  // Generic TALK hot spot - use first dialog, first conversation
                  dialogFileIndex = 0;
                  conversationIdx = 0;
                } else if (hotSpot >= 32 && hotSpot <= 36) {
                  // NPC_SELECT_DIALOG_1_* - character 1's dialog
                  dialogFileIndex = 0;
                  conversationIdx = hotSpot - 32; // 32->0, 33->1, etc.
                } else if (hotSpot >= 38 && hotSpot <= 42) {
                  // NPC_SELECT_DIALOG_2_* - character 2's dialog (if exists)
                  dialogFileIndex = Math.min(1, dialogs.length - 1);
                  conversationIdx = hotSpot - 38; // 38->0, 39->1, etc.
                }
                
                const dialog = dialogs[dialogFileIndex];
                
                if (dialog && conversationIdx < dialog.conversations.length) {
                  // Set the conversation index and show only this single conversation
                  setDialogConversationIndex(conversationIdx);
                  setDialogSingleMode(true); // Only show this one conversation
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
                const difficultyConfig = getDifficultySettings();
                const coinsNeeded = difficultyConfig.coinsPerPowerup;
                const glowDuration = difficultyConfig.glowDuration;
                
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
                
                // Show "FOUND OLD DIARY" toast
                if (canvasHUDRef.current) {
                  canvasHUDRef.current.showToast(UIStrings.diary_found, false); // Short duration
                }
                
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
                
                // Pause-on-attack effect: brief time freeze for impact feedback
                timeSystem.freeze(PLAYER.ATTACK_PAUSE_DELAY);
                
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
        // Player's LEFT edge hit a wall (moving left)
        // Find the tile that the left edge collided with
        const tileX = Math.floor(newX / tileSize);
        // Snap player's left edge just past the right edge of the blocking tile
        position.x = (tileX + 1) * tileSize + 0.1;
        velocity.x = 0;
        player.setLastTouchedLeftWallTime(gameTime);
      } else if (hCollision.rightWall) {
        // Player's RIGHT edge hit a wall (moving right)
        // Find the tile that the right edge collided with
        const tileX = Math.floor((newX + player.width) / tileSize);
        // Snap player's right edge just before the left edge of the blocking tile
        position.x = tileX * tileSize - player.width - 0.1;
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
          
          // Calculate sprite offset to align sprite bottom with collision box bottom
          // Player sprite is 64x64, collision box is 32x48 (matches original Java)
          // X: center horizontally: (32 - 64) / 2 = -16 (offset collision box 16px from sprite left)
          // Y: align bottoms: 48 - 64 = -16 (sprite extends 16px above collision box)
          const spriteOffsetX = -16;
          const spriteOffsetY = -16;
          const scaleX = obj.facingDirection.x < 0 ? -1 : 1;
          
          // Draw jet fire FIRST (behind player) when boosting
          if (pState.rocketsOn) {
            // Update jet fire animation
            pState.jetTimer += 1 / 60;
            if (pState.jetTimer >= FRAME_TIME) {
              pState.jetTimer -= FRAME_TIME;
              pState.jetFrame = (pState.jetFrame + 1) % 2;
            }
            
            const jetSpriteName = pState.jetFrame === 0 ? 'jetfire01' : 'jetfire02';
            if (renderSystem.hasSprite(jetSpriteName)) {
              // Jets are drawn below the player (offset Y by +16 in original)
              // In canvas coords, +Y is down, so we add to Y to draw below feet
              renderSystem.drawSprite(jetSpriteName, pos.x + spriteOffsetX, pos.y + spriteOffsetY + 16, 0, 9, 1, scaleX, 1);
            }
          }
          
          // Draw player sprite or fallback rectangle
          if (renderSystem.hasSprite(spriteName)) {
            
            // Apply glow effect when in glow mode
            if (pState.glowMode && ctx) {
              ctx.save();
              // Pulsating glow effect - oscillates based on time
              const glowIntensity = 15 + 10 * Math.sin(Date.now() / 100);
              ctx.shadowColor = '#FFD700';  // Golden glow color
              ctx.shadowBlur = glowIntensity;
              // Draw multiple times for stronger glow
              renderSystem.drawSprite(spriteName, pos.x + spriteOffsetX, pos.y + spriteOffsetY, 0, 10, 1, scaleX, 1);
              ctx.shadowColor = '#FFFFFF';  // Inner white glow
              ctx.shadowBlur = glowIntensity / 2;
              renderSystem.drawSprite(spriteName, pos.x + spriteOffsetX, pos.y + spriteOffsetY, 0, 10, 1, scaleX, 1);
              ctx.restore();
            } else {
              renderSystem.drawSprite(spriteName, pos.x + spriteOffsetX, pos.y + spriteOffsetY, 0, 10, 1, scaleX, 1);
            }
            
            // Draw sparks ON TOP of player when hit
            if (pState.currentState === PlayerState.HIT_REACT) {
              // Update sparks animation
              pState.sparkTimer += 1 / 60;
              if (pState.sparkTimer >= FRAME_TIME) {
                pState.sparkTimer -= FRAME_TIME;
                pState.sparkFrame = (pState.sparkFrame + 1) % 3;
              }
              
              const sparkFrames = ['spark01', 'spark02', 'spark03'];
              const sparkSpriteName = sparkFrames[pState.sparkFrame];
              if (renderSystem.hasSprite(sparkSpriteName)) {
                // Sparks drawn at player center, slightly higher priority (on top)
                renderSystem.drawSprite(sparkSpriteName, pos.x + spriteOffsetX, pos.y + spriteOffsetY, 0, 11, 1, scaleX, 1);
              }
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
            case 'breakable_block':
              // Breakable/destructible block - uses debris_block sprite
              spriteName = 'debris_block';
              // Block is 32x32, same as object dimensions
              spriteOffset.x = 0;
              spriteOffset.y = 0;
              break;
            case 'enemy': {
              // Determine enemy type by subtype or default to bat
              const enemyType = obj.subType || 'bat';
              let spriteWidth = 64;
              let spriteHeight = 64;
              
              switch (enemyType) {
                case 'bat':
                  spriteFrames = ['bat01', 'bat02', 'bat03', 'bat04'];
                  spriteWidth = 64;
                  spriteHeight = 32;
                  break;
                case 'sting':
                  spriteFrames = ['sting01', 'sting02', 'sting03'];
                  spriteWidth = 64;
                  spriteHeight = 64;
                  break;
                case 'onion':
                  spriteFrames = ['onion01', 'onion02', 'onion03'];
                  spriteWidth = 64;
                  spriteHeight = 64;
                  break;
                case 'brobot':
                  // Animate based on velocity
                  if (Math.abs(obj.getVelocity().x) > 10) {
                    spriteFrames = ['brobot_walk01', 'brobot_walk02', 'brobot_walk03'];
                  } else {
                    spriteFrames = ['brobot_idle01', 'brobot_idle02', 'brobot_idle03'];
                  }
                  spriteWidth = 64;
                  spriteHeight = 64;
                  break;
                case 'skeleton':
                  if (Math.abs(obj.getVelocity().x) > 10) {
                    spriteFrames = ['skeleton_walk01', 'skeleton_walk02', 'skeleton_walk03', 'skeleton_walk04', 'skeleton_walk05'];
                  } else {
                    spriteFrames = ['skeleton_stand'];
                  }
                  spriteWidth = 64;
                  spriteHeight = 64;
                  break;
                case 'karaguin':
                  spriteFrames = ['karaguin01', 'karaguin02', 'karaguin03'];
                  spriteWidth = 32;
                  spriteHeight = 32;
                  break;
                case 'mudman':
                  if (Math.abs(obj.getVelocity().x) > 10) {
                    spriteFrames = ['mudman_walk01', 'mudman_walk02', 'mudman_walk03'];
                  } else {
                    spriteFrames = ['mudman_idle01', 'mudman_idle02'];
                  }
                  spriteWidth = 128;
                  spriteHeight = 128;
                  break;
                case 'pink_namazu':
                  // Pink Namazu is a sleeping enemy that wakes up when player is near
                  if (obj.getCurrentAction() === ActionType.ATTACK) {
                    spriteFrames = ['pinknamazu_jump'];
                  } else if (obj.getCurrentAction() === ActionType.MOVE) {
                    spriteFrames = ['pinknamazu_eyeopen', 'pinknamazu_stand'];
                  } else {
                    spriteFrames = ['pinknamazu_sleep01', 'pinknamazu_sleep02'];
                  }
                  spriteWidth = 128;
                  spriteHeight = 128;
                  break;
                case 'shadowslime':
                  spriteFrames = ['shadowslime_idle01', 'shadowslime_idle02'];
                  spriteWidth = 64;
                  spriteHeight = 64;
                  break;
                case 'snailbomb':
                  // Snailbomb has stand, walk, and shoot animations
                  if (obj.getCurrentAction() === ActionType.ATTACK) {
                    spriteFrames = ['snailbomb_shoot01', 'snailbomb_shoot02'];
                  } else if (Math.abs(obj.getVelocity().x) > 5) {
                    spriteFrames = ['snailbomb_walk01', 'snailbomb_walk02'];
                  } else {
                    spriteFrames = ['snailbomb_stand'];
                  }
                  spriteWidth = 64;
                  spriteHeight = 64;
                  break;
                case 'evil_kabocha':
                  // Evil Kabocha boss has walk, hit, surprised, and death animations
                  if (obj.life <= 0) {
                    spriteFrames = ['evil_kabocha_die01', 'evil_kabocha_die02', 'evil_kabocha_die03', 'evil_kabocha_die04'];
                  } else if (obj.getCurrentAction() === ActionType.HIT_REACT) {
                    spriteFrames = ['evil_kabocha_hit01', 'evil_kabocha_hit02'];
                  } else if (Math.abs(obj.getVelocity().x) > 10) {
                    spriteFrames = ['evil_kabocha_walk01', 'evil_kabocha_walk02', 'evil_kabocha_walk03', 'evil_kabocha_walk04', 'evil_kabocha_walk05', 'evil_kabocha_walk06'];
                  } else {
                    spriteFrames = ['evil_kabocha_stand'];
                  }
                  spriteWidth = 128;
                  spriteHeight = 128;
                  break;
                case 'rokudou':
                  // Rokudou boss has fly, shoot, surprise, hit, and death animations
                  if (obj.life <= 0) {
                    spriteFrames = ['rokudou_die01', 'rokudou_die02', 'rokudou_die03', 'rokudou_die04'];
                  } else if (obj.getCurrentAction() === ActionType.HIT_REACT) {
                    spriteFrames = ['rokudou_hit01', 'rokudou_hit02', 'rokudou_hit03'];
                  } else if (obj.getCurrentAction() === ActionType.ATTACK) {
                    spriteFrames = ['rokudou_shoot01', 'rokudou_shoot02'];
                  } else if (Math.abs(obj.getVelocity().x) > 10 || Math.abs(obj.getVelocity().y) > 10) {
                    spriteFrames = ['rokudou_fly01', 'rokudou_fly02'];
                  } else {
                    spriteFrames = ['rokudou_stand'];
                  }
                  spriteWidth = 128;
                  spriteHeight = 128;
                  break;
                case 'the_source':
                  // The Source is the final boss with layered 512x512 sprites
                  // Render all layers with staggered z-indices
                  {
                    const sourcePos = obj.getPosition();
                    const sourceWidth = 512;
                    const sourceHeight = 512;
                    const sourceLayers = ['source_black', 'source_body', 'source_core', 'source_spikes', 'source_spots'];
                    const offsetX = (obj.width - sourceWidth) / 2;
                    const offsetY = (obj.height - sourceHeight) / 2;
                    for (let layerIdx = 0; layerIdx < sourceLayers.length; layerIdx++) {
                      renderSystem.drawSprite(
                        sourceLayers[layerIdx],
                        sourcePos.x + offsetX,
                        sourcePos.y + offsetY,
                        10 + layerIdx // Staggered z-index for layers
                      );
                    }
                    // Don't set spriteName - we handled rendering above
                    spriteName = '';
                  }
                  spriteWidth = 512;
                  spriteHeight = 512;
                  break;
                default:
                  // Default to bat animation for unhandled enemy types
                  spriteFrames = ['bat01', 'bat02', 'bat03', 'bat04'];
                  spriteWidth = 64;
                  spriteHeight = 32;
              }
              // Skip normal rendering if we already handled it specially (The Source)
              if (spriteName === '') {
                break;
              }
              obj.animFrame = obj.animFrame % spriteFrames.length;
              spriteName = spriteFrames[obj.animFrame];
              // Center sprite on object - sprite draws from top-left, so offset by half difference
              spriteOffset.x = (obj.width - spriteWidth) / 2;
              spriteOffset.y = (obj.height - spriteHeight) / 2;
              break;
            }
            case 'npc': {
              // NPCs use their subtype to determine sprite
              const npcType = obj.subType || 'wanda';
              spriteName = `${npcType}_stand`;
              // NPCs are 64x128 sprites
              const npcSpriteWidth = 64;
              const npcSpriteHeight = 128;
              spriteOffset.x = (obj.width - npcSpriteWidth) / 2;
              spriteOffset.y = (obj.height - npcSpriteHeight) / 2;
              break;
            }
            case 'door': {
              // Doors use their subtype (red, blue, green) to determine sprite
              // DoorAnimationComponent handles animation state
              const doorColor = obj.subType || 'red';
              // Use type assertion since getComponent uses strict constructor signature
              const doorAnim = obj.getComponent(DoorAnimationComponent as unknown as new (...args: unknown[]) => DoorAnimationComponent);
              if (doorAnim) {
                const doorState = doorAnim.getCurrentState();
                // Map door state to sprite: 0=closed, 1=open, 2=closing, 3=opening
                switch (doorState) {
                  case DoorAnimation.CLOSED:
                    spriteName = `object_door_${doorColor}01`;
                    break;
                  case DoorAnimation.OPEN:
                    spriteName = `object_door_${doorColor}04`;
                    break;
                  case DoorAnimation.OPENING:
                  case DoorAnimation.CLOSING: {
                    // Use middle frames based on animation time
                    const animTime = doorAnim.getCurrentAnimationTime();
                    spriteName = animTime < 0.083 ? `object_door_${doorColor}02` : `object_door_${doorColor}03`;
                    break;
                  }
                  default:
                    spriteName = `object_door_${doorColor}01`;
                }
              } else {
                spriteName = `object_door_${doorColor}01`;
              }
              // Doors are 32x64
              spriteOffset.x = 0;
              spriteOffset.y = 0;
              break;
            }
            case 'button': {
              // Buttons use their subtype (red, blue, green) to determine sprite
              // Get SpriteComponent directly since ButtonAnimationComponent delegates to it
              const buttonColor = obj.subType || 'red';
              // Use type assertion since getComponent uses strict constructor signature
              const buttonSprite = obj.getComponent(SpriteComponent as unknown as new (...args: unknown[]) => SpriteComponent);
              if (buttonSprite) {
                const animIndex = buttonSprite.getCurrentAnimationIndex();
                spriteName = animIndex === ButtonAnimation.DOWN
                  ? `object_button_pressed_${buttonColor}`
                  : `object_button_${buttonColor}`;
              } else {
                spriteName = `object_button_${buttonColor}`;
              }
              // Buttons are 32x32 sprites but visually only 16px tall
              spriteOffset.x = 0;
              spriteOffset.y = 16; // Offset to bottom of collision box
              break;
            }
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
      
      // Update and render Canvas HUD (hide during cutscenes)
      const canvasHUD = canvasHUDRef.current;
      const isCutsceneActive = canvasCutsceneRef.current?.isActive() ?? false;
      if (canvasHUD && !isCutsceneActive) {
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
      
      // Update and render Canvas Ending Stats Screen (if active)
      const canvasEndingStats = canvasEndingStatsRef.current;
      if (canvasEndingStats && canvasEndingStats.isShowing()) {
        canvasEndingStats.update(1 / 60);
        canvasEndingStats.render();
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

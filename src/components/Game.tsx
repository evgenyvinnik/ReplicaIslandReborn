/**
 * Game Component - Main game canvas and loop
 * Fully integrated game with proper rendering and physics
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGameContext } from '../context/GameContext';
import { GameState, ActionType, HitType } from '../types';
import { GameLoop } from '../engine/GameLoop';
import { SystemRegistry, sSystemRegistry } from '../engine/SystemRegistry';
import { RenderSystem } from '../engine/RenderSystem';
import { InputSystem } from '../engine/InputSystem';
import { SoundSystem, SoundEffects } from '../engine/SoundSystem';
import { CameraSystem } from '../engine/CameraSystem';
import { CollisionSystem } from '../engine/CollisionSystemNew';
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
import { PlayerComponent, PlayerState } from '../entities/components/PlayerComponent';
import { PatrolComponent } from '../entities/components/PatrolComponent';
import { NPCComponent } from '../entities/components/NPCComponent';
import { setSolidSurfaceSystemRegistry } from '../entities/components/SolidSurfaceComponent';
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

// Note: In canvas coordinates, positive Y is DOWN, negative Y is UP
// The original Java code used a coordinate system where positive Y was UP

export function Game({ width = 480, height = 320 }: GameProps): React.JSX.Element {
  console.log('[Game] Component rendering, width:', width, 'height:', height);
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
  
  // Track if level completion has been processed (to prevent infinite loops)
  const levelCompleteProcessedRef = useRef<number | null>(null);
  
  // Decoration smoke effect timing (for ANDOU_DEAD)
  const decorationSmokeTimerRef = useRef<Map<number, number>>(new Map());
  
  // Player spawn point (set when level loads)
  const playerSpawnRef = useRef({ x: 100, y: 320 });
  
  // Player state ref for physics (matching original PlayerComponent.java)
  // Helper function to reset player state (call when loading/restarting levels)
  const resetPlayerState = useCallback((): void => {
    const gameObjectManager = systemRegistryRef.current?.gameObjectManager;
    if (gameObjectManager) {
      const player = gameObjectManager.getPlayer();
      if (player) {
         // We need to find the PlayerComponent
         // Since we don't have a direct reference here, we might need to iterate or assume it's there
         // But for now, let's assume the player object has a reset method or we reset components
         // Actually, GameObject doesn't have reset. Components do.
         // We should iterate components and reset them.
         player.reset();
         
         // Specifically reset PlayerComponent if we can find it
         // For now, player.reset() resets all components which is correct.
      }
    }
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
  const dialogIsCutsceneRef = useRef(false); // True for NPC-triggered dialogs (don't pause physics)
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
          console.log('[Game] Cutscene level - waiting for NPC to trigger dialog via hotspot, level:', state.currentLevel);
        } else {
          // Inject systems into PlayerComponent
          const playerComponent = player.getComponent(PlayerComponent);
          if (playerComponent) {
            const inputSystem = systemRegistryRef.current?.inputSystem;
            const collisionSystem = systemRegistryRef.current?.collisionSystem;
            const soundSystem = systemRegistryRef.current?.soundSystem;
            
            if (inputSystem && collisionSystem && soundSystem) {
              playerComponent.setSystems(inputSystem, collisionSystem, soundSystem, levelSystem);
            }
          }

          // Check for intro dialog
          console.log('[Game] Playable level - dialog will be triggered by hotspots, level:', state.currentLevel);
        }
      }
    }
  }, [levelLoading, isInitialized, state.currentLevel]);

  // Subscribe to GameFlowEvent for NPC-triggered dialogs
  // NPCs use GameFlowEvent to trigger dialogs when they hit NPC_SELECT_DIALOG hotspots
  useEffect(() => {
    if (!isInitialized) return;
    
    const handleGameFlowEvent = (event: GameFlowEventType, dataIndex: number): void => {
      console.log('[Game] GameFlowEvent received:', event, 'dataIndex:', dataIndex);
      
      if (event === GameFlowEventType.SHOW_DIALOG_CHARACTER1 || 
          event === GameFlowEventType.SHOW_DIALOG_CHARACTER2) {
        // NPC triggered a dialog - but only if no dialog is currently active
        if (activeDialogRef.current !== null) {
          console.log('[Game] Ignoring NPC dialog trigger - dialog already active');
          return;
        }
        
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
              
              console.log('[Game] Showing NPC dialog - character:', dialogIndex + 1, 
                'conversation:', conversationIdx, 'level:', levelInfo.file);
              
              hasShownIntroDialogRef.current = true;
              setDialogConversationIndex(conversationIdx);
              // For NPC-triggered dialogs, only show the single conversation at this hotspot
              setDialogSingleMode(true);
              // Mark as cutscene dialog so physics don't pause - NPC needs to keep walking
              dialogIsCutsceneRef.current = true;
              // Update ref immediately to prevent duplicate triggers (state update is async)
              activeDialogRef.current = dialog;
              setActiveDialog(dialog);
            }
          }
        }
      } else if (event === GameFlowEventType.GO_TO_NEXT_LEVEL) {
        // NPC reached end of level - advance to next level
        const levelSystem = levelSystemRef.current;
        const gameObjectManager = systemRegistryRef.current?.gameObjectManager;
        if (levelSystem && gameObjectManager) {
          // Get current level's inThePast status before advancing
          const currentLevelInfo = levelSystem.getLevelInfo(levelSystem.getCurrentLevelId());
          const wasInThePast = currentLevelInfo?.inThePast ?? false;
          
          const nextLevelId = levelSystem.getNextLevelId();
          console.log('[Game] NPC triggered GO_TO_NEXT_LEVEL - advancing to:', nextLevelId);
          if (nextLevelId !== null) {
            levelSystem.unlockLevel(nextLevelId);
            setLevel(nextLevelId);
            setLevelLoading(true);
            hasShownIntroDialogRef.current = false;
            levelSystem.loadLevel(nextLevelId).then((success) => {
              if (!success) {
                console.error('[Game] Failed to load next level (NPC trigger):', nextLevelId);
                setLevelLoading(false);
                goToMainMenu();
                return;
              }
              
              // Check if we need to show memory playback toast
              const newLevelInfo = levelSystem.getLevelInfo(nextLevelId);
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
              const parsedLevel = levelSystem.getParsedLevel();
              if (parsedLevel && tileMapRendererRef.current) {
                tileMapRendererRef.current.initializeFromLevel(parsedLevel);
              }
              
              const spawn = levelSystem.playerSpawnPosition;
              playerSpawnRef.current = { ...spawn };
              resetPlayerState(); // Reset player state for new level
              
              // Start timer for new level
              levelStartTimeRef.current = Date.now();
              levelElapsedTimeRef.current = 0;
              storeRecordLevelAttempt(nextLevelId);
              
              gameObjectManager.commitUpdates();
              const player = gameObjectManager.getPlayer();
              if (player) {
                player.setPosition(spawn.x, spawn.y);
                player.getVelocity().x = 0;
                player.getVelocity().y = 0;
              }
              
              // Update camera bounds for new level
              const cameraSystem = systemRegistryRef.current?.cameraSystem;
              if (cameraSystem) {
                cameraSystem.setBounds({
                  minX: 0,
                  minY: 0,
                  maxX: levelSystem.getLevelWidth(),
                  maxY: levelSystem.getLevelHeight(),
                });
                if (player) {
                  cameraSystem.setTarget(player);
                  cameraSystem.setPosition(spawn.x, spawn.y);
                }
              }
              
              setLevelLoading(false);
            }).catch((error) => {
              console.error('[Game] Error loading next level (NPC trigger):', error);
              setLevelLoading(false);
              goToMainMenu();
            });
          } else {
            // No next level available - go to main menu
            console.log('[Game] No next level available from NPC trigger, returning to main menu');
            goToMainMenu();
          }
        }
      }
    };
    
    gameFlowEvent.addListener(handleGameFlowEvent);
    
    return (): void => {
      gameFlowEvent.removeListener(handleGameFlowEvent);
    };
  }, [isInitialized, setLevel, goToMainMenu, resetPlayerState, storeRecordLevelAttempt]);

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
      // IMPORTANT: Dialog completion should NOT auto-advance levels!
      // Level advancement is handled separately by:
      // 1. Player hitting END_LEVEL hotspot (playable levels)
      // 2. NPC hitting END_LEVEL hotspot -> GO_TO_NEXT_LEVEL event (cutscene levels)
      // This matches the original game where dialogs just close and gameplay resumes
      const handleDialogComplete = (): void => {
        console.log('[Game] Dialog complete - closing dialog, gameplay resumes');
        // Update ref immediately (state update is async)
        activeDialogRef.current = null;
        setActiveDialog(null);
        dialogIsCutsceneRef.current = false; // Reset cutscene flag
        // Do NOT auto-advance level here - NPC will continue walking and hit END_LEVEL hotspot
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
  }, [activeDialog, dialogConversationIndex, dialogSingleMode]);

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
      // Prevent infinite loop - only process level completion once per level
      if (levelCompleteProcessedRef.current === state.currentLevel) {
        return;
      }
      levelCompleteProcessedRef.current = state.currentLevel;
      
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
        console.log('[Game] Final boss defeated! Unlocking extras (Linear Mode, Level Select)');
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
            console.log('[Game] Level complete - next level ID:', nextLevelId);
            if (nextLevelId !== null) {
              levelSys.unlockLevel(nextLevelId);
              setLevel(nextLevelId);
              setLevelLoading(true); // Mark level as loading
              hasShownIntroDialogRef.current = false;
              levelSys.loadLevel(nextLevelId).then((success) => {
                if (!success) {
                  console.error('[Game] Failed to load next level:', nextLevelId);
                  setLevelLoading(false);
                  goToMainMenu();
                  return;
                }
                
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
                
                // Update camera bounds for new level
                const cameraSystem = systemRegistryRef.current?.cameraSystem;
                if (cameraSystem) {
                  cameraSystem.setBounds({
                    minX: 0,
                    minY: 0,
                    maxX: levelSys.getLevelWidth(),
                    maxY: levelSys.getLevelHeight(),
                  });
                  if (player) {
                    cameraSystem.setTarget(player);
                    cameraSystem.setPosition(spawn.x, spawn.y);
                  }
                }
                
                setLevelLoading(false); // Mark level as loaded
                resumeGame();
              }).catch((error) => {
                console.error('[Game] Error loading next level:', error);
                setLevelLoading(false);
                goToMainMenu();
              });
            } else {
              // No next level available (e.g., played from debug menu or completed final level)
              // Go back to main menu
              console.log('[Game] No next level available, returning to main menu');
              goToMainMenu();
            }
          } else {
            // No level system available, go to main menu
            goToMainMenu();
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
      // Reset the processed flag when not in LEVEL_COMPLETE state
      // This allows processing when the player completes another level
      if (levelCompleteProcessedRef.current !== null && state.gameState === GameState.PLAYING) {
        levelCompleteProcessedRef.current = null;
      }
    }
  }, [state.gameState, state.currentLevel, resumeGame, setLevel, goToMainMenu, resetPlayerState, storeRecordLevelAttempt]);

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

    // Set up SolidSurfaceComponent to use the system registry
    // This allows door collision surfaces to work properly
    setSolidSurfaceSystemRegistry(systemRegistry);

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
    levelSystem.setLinearMode(state.isLinearMode); // Set linear mode from context
    
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
          console.log(`Unknown ending type: ${endingType}`);
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
        { name: 'andou_die01', file: 'andou_die02' },
        { name: 'andou_die02', file: 'andou_die02' },
        // Jet fire (shown when boosting with jetpack)
        { name: 'jetfire01', file: 'jetfire01' },
        { name: 'jetfire02', file: 'jetfire02' },
        // Sparks (shown when hit)
        { name: 'spark01', file: 'spark01' },
        { name: 'spark02', file: 'spark02' },
        { name: 'spark03', file: 'spark03' },
        // Ghost (for possession mechanic)
        { name: 'ghost', file: 'ghost' },
      ];

      const loadPromises = sprites.map(sprite =>
        renderSystem.loadSprite(sprite.name, assetPath(`/assets/sprites/${sprite.file}.png`), 64, 64)
          .catch(err => console.log(`Failed to load sprite ${sprite.name}:`, err))
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
        // Door sprites - red, blue, green (4 frames each: 01=closed, 02-03=middle, 04=open)
        { name: 'object_door_red01', file: 'object_door_red01', w: 32, h: 64 },
        { name: 'object_door_red02', file: 'object_door_red02', w: 32, h: 64 },
        { name: 'object_door_red03', file: 'object_door_red03', w: 32, h: 64 },
        { name: 'object_door_red04', file: 'object_door_red04', w: 32, h: 64 },
        { name: 'object_door_blue01', file: 'object_door_blue01', w: 32, h: 64 },
        { name: 'object_door_blue02', file: 'object_door_blue02', w: 32, h: 64 },
        { name: 'object_door_blue03', file: 'object_door_blue03', w: 32, h: 64 },
        { name: 'object_door_blue04', file: 'object_door_blue04', w: 32, h: 64 },
        { name: 'object_door_green01', file: 'object_door_green01', w: 32, h: 64 },
        { name: 'object_door_green02', file: 'object_door_green02', w: 32, h: 64 },
        { name: 'object_door_green03', file: 'object_door_green03', w: 32, h: 64 },
        { name: 'object_door_green04', file: 'object_door_green04', w: 32, h: 64 },
        // Button sprites - red, blue, green (up and pressed states)
        { name: 'object_button_red', file: 'object_button_red', w: 32, h: 32 },
        { name: 'object_button_pressed_red', file: 'object_button_pressed_red', w: 32, h: 32 },
        { name: 'object_button_blue', file: 'object_button_blue', w: 32, h: 32 },
        { name: 'object_button_pressed_blue', file: 'object_button_pressed_blue', w: 32, h: 32 },
        { name: 'object_button_green', file: 'object_button_green', w: 32, h: 32 },
        { name: 'object_button_pressed_green', file: 'object_button_pressed_green', w: 32, h: 32 },
        // Terminal sprites - Kabocha and Rokudou (3 frames each, 64x64)
        { name: 'object_terminal_kabocha01', file: 'object_terminal_kabocha01', w: 64, h: 64 },
        { name: 'object_terminal_kabocha02', file: 'object_terminal_kabocha02', w: 64, h: 64 },
        { name: 'object_terminal_kabocha03', file: 'object_terminal_kabocha03', w: 64, h: 64 },
        { name: 'object_terminal01', file: 'object_terminal01', w: 64, h: 64 },
        { name: 'object_terminal02', file: 'object_terminal02', w: 64, h: 64 },
        { name: 'object_terminal03', file: 'object_terminal03', w: 64, h: 64 },
        // Hint sign sprite
        { name: 'object_sign', file: 'object_sign', w: 32, h: 32 },
      ];

      const loadPromises = sprites.map(sprite =>
        renderSystem.loadSprite(sprite.name, assetPath(`/assets/sprites/${sprite.file}.png`), sprite.w, sprite.h)
          .catch(err => console.log(`Failed to load sprite ${sprite.name}:`, err))
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
        { name: 'enemy_wanda_stand', file: 'enemy_wanda_stand', w: 64, h: 128 },
        { name: 'enemy_wanda_walk01', file: 'enemy_wanda_walk01', w: 64, h: 128 },
        { name: 'enemy_wanda_walk02', file: 'enemy_wanda_walk02', w: 64, h: 128 },
        { name: 'enemy_wanda_walk03', file: 'enemy_wanda_walk03', w: 64, h: 128 },
        { name: 'enemy_wanda_walk04', file: 'enemy_wanda_walk04', w: 64, h: 128 },
        { name: 'enemy_wanda_walk05', file: 'enemy_wanda_walk05', w: 64, h: 128 },
        { name: 'enemy_wanda_run01', file: 'enemy_wanda_run01', w: 64, h: 128 },
        { name: 'enemy_wanda_run02', file: 'enemy_wanda_run02', w: 64, h: 128 },
        { name: 'enemy_wanda_run03', file: 'enemy_wanda_run03', w: 64, h: 128 },
        { name: 'enemy_wanda_run04', file: 'enemy_wanda_run04', w: 64, h: 128 },
        { name: 'enemy_wanda_run05', file: 'enemy_wanda_run05', w: 64, h: 128 },
        { name: 'enemy_wanda_run06', file: 'enemy_wanda_run06', w: 64, h: 128 },
        { name: 'enemy_wanda_run07', file: 'enemy_wanda_run07', w: 64, h: 128 },
        { name: 'enemy_wanda_run08', file: 'enemy_wanda_run08', w: 64, h: 128 },
        { name: 'enemy_wanda_jump01', file: 'enemy_wanda_jump01', w: 64, h: 128 },
        { name: 'enemy_wanda_jump02', file: 'enemy_wanda_jump02', w: 64, h: 128 },
        { name: 'enemy_wanda_crouch', file: 'enemy_wanda_crouch', w: 64, h: 128 },
        { name: 'kyle_stand', file: 'enemy_kyle_stand', w: 64, h: 128 },
        { name: 'enemy_kyle_stand', file: 'enemy_kyle_stand', w: 64, h: 128 },
        { name: 'kabocha_stand', file: 'enemy_kabocha_stand', w: 64, h: 128 },
        // Kabocha NPC walk sprites (64x128)
        { name: 'kabocha_walk01', file: 'enemy_kabocha_walk01', w: 64, h: 128 },
        { name: 'kabocha_walk02', file: 'enemy_kabocha_walk02', w: 64, h: 128 },
        { name: 'kabocha_walk03', file: 'enemy_kabocha_walk03', w: 64, h: 128 },
        { name: 'kabocha_walk04', file: 'enemy_kabocha_walk04', w: 64, h: 128 },
        { name: 'kabocha_walk05', file: 'enemy_kabocha_walk05', w: 64, h: 128 },
        { name: 'kabocha_walk06', file: 'enemy_kabocha_walk06', w: 64, h: 128 },
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
        // Turret/shot projectiles
        { name: 'shot01', file: 'object_shot01', w: 16, h: 16 },
        { name: 'shot02', file: 'object_shot02', w: 16, h: 16 },
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
        // Energy ball projectiles (for Rokudou boss)
        { name: 'energy_ball01', file: 'energy_ball01', w: 32, h: 32 },
        { name: 'energy_ball02', file: 'energy_ball02', w: 32, h: 32 },
        { name: 'energy_ball03', file: 'energy_ball03', w: 32, h: 32 },
        { name: 'energy_ball04', file: 'energy_ball04', w: 32, h: 32 },
        // Effect energy balls (alternative graphics)
        { name: 'effect_energyball01', file: 'effect_energyball01', w: 32, h: 32 },
        { name: 'effect_energyball02', file: 'effect_energyball02', w: 32, h: 32 },
        { name: 'effect_energyball03', file: 'effect_energyball03', w: 32, h: 32 },
        { name: 'effect_energyball04', file: 'effect_energyball04', w: 32, h: 32 },
        // Dead character decorations (broken robots)
        { name: 'andou_dead', file: 'andou_explode12', w: 64, h: 64 },
        { name: 'kyle_dead', file: 'enemy_kyle_dead', w: 64, h: 64 },
      ];

      const loadPromises = sprites.map(sprite =>
        renderSystem.loadSprite(sprite.name, assetPath(`/assets/sprites/${sprite.file}.png`), sprite.w, sprite.h)
          .catch(err => console.log(`Failed to load sprite ${sprite.name}:`, err))
      );

      await Promise.all(loadPromises);
    };

    // Load assets and level
    const initializeGame = async (): Promise<void> => {
      setLevelLoading(true);
      
      // Reset inventory for new game
      resetInventory();
      
      try {
        // Load collision segment data (for proper slope handling)
        const collisionLoaded = await collisionSystem.loadCollisionData(assetPath('/assets/collision.json'));
        if (collisionLoaded) {
          console.log('[Game] Collision segment data loaded successfully');
        } else {
          console.warn('[Game] Failed to load collision segment data, using simple tile collision');
        }
        
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
        console.log('[Game] Loading level:', levelToLoad);
        
        // Try to load the level (JSON format)
        const levelLoaded = await levelSystem.loadLevel(levelToLoad);
        console.log('[Game] Level loaded:', levelLoaded);
        
        if (levelLoaded) {
          // Commit pending object additions immediately so they're available for rendering
          gameObjectManager.commitUpdates();
          
          // Debug: count coins after load
          let coinCount = 0;
          gameObjectManager.forEach((obj) => {
            if (obj.type === 'coin') coinCount++;
          });
          console.log('[Game] After level load - coins in active list:', coinCount);
          
          // Store player spawn position from level system
          playerSpawnRef.current = { ...levelSystem.playerSpawnPosition };
          
          // Initialize tile map renderer from parsed level
          const parsedLevel = levelSystem.getParsedLevel();
          console.log('[Game] parsedLevel:', parsedLevel ? { bgLayers: parsedLevel.backgroundLayers.length, w: parsedLevel.widthInTiles, h: parsedLevel.heightInTiles } : null);
          if (parsedLevel) {
            tileMapRenderer.initializeFromLevel(parsedLevel);
            console.log('[Game] TileMapRenderer initialized, layers:', tileMapRenderer.getLayerCount());
            
            // Load background image
            try {
              const bgImage = await loadBackgroundImage(parsedLevel.backgroundImage);
              backgroundImageRef.current = bgImage;
            } catch {
              console.log('Failed to load background image');
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
          console.log('[Game] Player found:', !!player, 'position:', player?.getPosition());
          
          if (player) {
            // Set camera to initially focus on the player
            cameraSystem.setTarget(player);
            // Also set camera position directly to player CENTER location immediately
            // This prevents the camera from "lerping" from (0,0) to the player
            cameraSystem.setPosition(
              player.getCenteredPositionX(),
              player.getCenteredPositionY()
            );
            console.log('[Game] Camera set to player center:', player.getCenteredPositionX(), player.getCenteredPositionY());
          } else {
            // Find an NPC to focus on (Wanda, Kyle, Kabocha, or Rokudou)
            let npcTarget: GameObject | null = null;
            gameObjectManager.forEach((obj) => {
              if (obj.type === 'npc' && npcTarget === null) {
                npcTarget = obj;
              }
            });
            
            if (npcTarget !== null) {
              console.log(`[Game] Found NPC target: ${(npcTarget as GameObject).subType}`);
              // Set camera to follow the NPC
              const npc = npcTarget as GameObject;
              console.log(`[Game] NPC position: (${npc.getPosition().x}, ${npc.getPosition().y}), size: ${npc.width}x${npc.height}`);
              cameraSystem.setNPCTarget(npcTarget);
              // For NPC cutscene levels, set camera to bottom of level where action happens
              // NPCs typically fall from above and land at the bottom
              // Use the level height to position camera at the bottom
              const levelHeight = levelSystem.getLevelHeight();
              const bottomCenterY = levelHeight - height / 2; // Center camera at bottom
              cameraSystem.setPosition(npc.getCenteredPositionX(), bottomCenterY);
              console.log('[Game] Camera set to bottom of level:', npc.getCenteredPositionX(), bottomCenterY);
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
        console.log('[Game] Starting game loop after initialization');
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
        player.width = PlayerComponent.WIDTH;
        player.height = PlayerComponent.HEIGHT;
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
        console.log('[Game] Update tick - state:', gameStateRef.current, 'PLAYING:', GameState.PLAYING, 'match:', gameStateRef.current === GameState.PLAYING);
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
      
      // Check if game physics should be paused (dialog, pause menu, game over, etc.)
      // Note: Cutscene dialogs (NPC-triggered) should NOT pause physics - NPCs need to move
      const isDialogPausingPhysics = canvasDialogRef.current?.isActive() && !dialogIsCutsceneRef.current;
      const isGamePaused = 
        isDialogPausingPhysics ||
        canvasPauseMenuRef.current?.isShowing() ||
        canvasGameOverRef.current?.isShowing() ||
        canvasLevelCompleteRef.current?.isShowing() ||
        canvasDiaryRef.current?.isVisible() ||
        canvasEndingStatsRef.current?.isShowing();
      
      // Use empty input when blocked, otherwise use real input
      const input = isInputBlocked 
        ? { left: false, right: false, up: false, down: false, jump: false, attack: false, pause: false }
        : inputSystem.getInputState();
      
      // Skip all physics updates when game is paused (dialog active, etc.)
      if (isGamePaused) {
        return; // Skip rest of update, but render will still happen
      }
      
      if (player) {
        // Update player's internal gameTime before physics so touchingGround() works correctly
        player.setGameTime(gameTime);
        
        // Ensure PlayerComponent has systems injected (in case useEffect didn't run)
        const playerComp = player.getComponent(PlayerComponent);
        if (playerComp && !playerComp.hasSystemsInjected()) {
          playerComp.setSystems(inputSystem, collisionSystem, soundSystem, levelSystemRef.current!);
        }
        // Player physics update (based on original PlayerComponent.java)
        // Player physics update (based on original PlayerComponent.java)
        // updatePlayerPhysics(player, input, gameDelta, gameTime, collisionSystem, soundSystem);
        
        // Player update is now handled by PlayerComponent via gameObjectManager.update()
        
        // Check button collisions BEFORE gameObjectManager.update() so ButtonAnimationComponent
        // can see the HIT_REACT + DEPRESS state in the same frame
        const playerPos = player.getPosition();
        const playerVel = player.getVelocity();
        const playerBottom = playerPos.y + player.height;
        const playerLeft = playerPos.x;
        const playerRight = playerPos.x + player.width;
        
        gameObjectManager.forEach((obj) => {
          if (obj === player || !obj.isVisible() || obj.type !== 'button') return;
          
          const objPos = obj.getPosition();
          // Button pressable area is the top 16px (vulnerability volume is 0,0,32,16)
          const buttonRect = {
            x: objPos.x,
            y: objPos.y,
            width: obj.width,
            height: 16,
          };
          
          // Check horizontal overlap
          const horizontalOverlap = playerRight > buttonRect.x && 
                                   playerLeft < buttonRect.x + buttonRect.width;
          
          // Check if player's feet are touching button's top area
          const verticalContact = playerBottom >= buttonRect.y && 
                                 playerBottom <= buttonRect.y + buttonRect.height + 8;
          
          // Player must be moving down or stationary (not jumping up through button)
          const isLanding = playerVel.y >= 0;
          
          if (horizontalOverlap && verticalContact && isLanding) {
            obj.setCurrentAction(ActionType.HIT_REACT);
            obj.lastReceivedHitType = HitType.DEPRESS;
          }
        });
      }

      // Update all game objects (use gameDelta so game freezes during pause-on-attack)
      gameObjectManager.update(gameDelta, gameTime);
      
      // Update temporary collision surfaces (moving platforms, doors, etc.)
      // This must happen after gameObjectManager.update() so objects can submit their surfaces,
      // and before collision checks so the surfaces are active
      collisionSystem.updateTemporarySurfaces();
      
      // Debug: Count NPC objects
      if (frameCount % 120 === 0) {
        let npcCount = 0;
        let activeNpcCount = 0;
        let breakableBlockCount = 0;
        let activeBreakableBlockCount = 0;
        gameObjectManager.forEach((obj) => {
          if (obj.type === 'npc') {
            npcCount++;
            if (obj.isActive()) {
              activeNpcCount++;
              console.log('[Game] NPC found:', obj.subType, 'active:', obj.isActive(), 'visible:', obj.isVisible(), 'pos:', obj.getPosition().x, obj.getPosition().y);
            }
          }
          if (obj.type === 'breakable_block') {
            breakableBlockCount++;
            if (obj.isActive()) {
              activeBreakableBlockCount++;
              const pos = obj.getPosition();
              console.log(`[Game] Breakable block at (${pos.x}, ${pos.y}) active=${obj.isActive()} visible=${obj.isVisible()} life=${obj.life}`);
            }
          }
        });
        console.log('[Game] NPC count:', npcCount, 'active:', activeNpcCount);
        console.log('[Game] Breakable block count:', breakableBlockCount, 'active:', activeBreakableBlockCount);
      }
      
      // Update effects system (explosions, smoke, etc.)
      effectsSystem.update(deltaTime);

      // Spawn smoke effects for decoration objects (ANDOU_DEAD - broken android)
      const currentTime = performance.now();
      const smokeTimers = decorationSmokeTimerRef.current;
      gameObjectManager.forEach((obj) => {
        if (obj.type !== 'decoration' || !obj.isVisible()) return;
        
        if (obj.subType === 'andou_dead') {
          // Spawn smoke at intervals (matching original: 0.25s for big, 0.35s for small)
          const objId = obj.id;
          const lastSmokeTime = smokeTimers.get(objId) ?? 0;
          
          // Big smoke every 0.25 seconds
          if (currentTime - lastSmokeTime > 250) {
            const pos = obj.getPosition();
            // Spawn dust effect at player's feet
        effectsSystem.spawnDust(pos.x + PlayerComponent.WIDTH / 2, pos.y + PlayerComponent.HEIGHT);
        effectsSystem.spawnDust(pos.x + PlayerComponent.WIDTH / 2 - 10, pos.y + PlayerComponent.HEIGHT);
        effectsSystem.spawnDust(pos.x + PlayerComponent.WIDTH / 2 + 10, pos.y + PlayerComponent.HEIGHT);
            smokeTimers.set(objId, currentTime);
          }
        }
      });

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
          console.log(`[NPC Physics] ${obj.name} is not visible, skipping physics`);
          return;
        }
        
        const velocity = obj.getVelocity();
        const targetVelocity = obj.getTargetVelocity();
        const acceleration = obj.getAcceleration();
        const position = obj.getPosition();
        
        // Debug log for Wanda
        if (obj.subType === 'wanda' && Math.random() < 0.02) {
          console.log(`[NPC Physics] Wanda pos=(${position.x.toFixed(1)}, ${position.y.toFixed(1)}) vel=(${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) targetVel=(${targetVelocity.x.toFixed(1)}, ${targetVelocity.y.toFixed(1)}) accel=(${acceleration.x.toFixed(1)}, ${acceleration.y.toFixed(1)})`);
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
          console.log(`[NPC Ground] Wanda grounded=${groundCheck.grounded} pos.y=${position.y.toFixed(1)} bottom=${(position.y + obj.height).toFixed(1)} tileRow=${Math.floor((position.y + obj.height) / 32)}`);
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
        
        // NPC collision with breakable blocks (Wanda smashing through walls)
        // Debug: Log Wanda's velocity periodically
        if (obj.subType === 'wanda' && Math.random() < 0.02) {
          console.log(`[NPC Velocity] Wanda vel.x=${velocity.x.toFixed(1)} at pos(${position.x.toFixed(0)}, ${position.y.toFixed(0)})`);
        }
        
        if (Math.abs(velocity.x) >= 50) {
          // Debug: Log when Wanda is near breakable block X position
          if (obj.subType === 'wanda' && position.x > 540 && position.x < 620) {
            console.log(`[NPC Block Check] Wanda at (${position.x.toFixed(0)}, ${position.y.toFixed(0)}) checking for breakable blocks`);
          }
          
          gameObjectManager.forEach((other) => {
            if (other.type === 'breakable_block') {
              // Debug: Log breakable block state when Wanda is nearby
              if (obj.subType === 'wanda' && position.x > 540 && position.x < 620) {
                const otherPos = other.getPosition();
                console.log(`[NPC Block Check] Found breakable_block at (${otherPos.x}, ${otherPos.y}) visible=${other.isVisible()} life=${other.life}`);
              }
              
              if (other.isVisible() && other.life > 0) {
                const otherPos = other.getPosition();
                // Check for collision between NPC and breakable block
                const npcLeft = position.x;
                const npcRight = position.x + obj.width;
                const npcTop = position.y;
                const npcBottom = position.y + obj.height;
                
                const blockLeft = otherPos.x;
                const blockRight = otherPos.x + other.width;
                const blockTop = otherPos.y;
                const blockBottom = otherPos.y + other.height;
                
                // Check for overlap
                if (npcRight > blockLeft && npcLeft < blockRight &&
                    npcBottom > blockTop && npcTop < blockBottom) {
                  // Destroy the breakable block
                  other.life = 0;
                  other.setVisible(false);
                  
                  // Spawn explosion effect at block position
                  effectsSystem.spawnExplosion(
                    otherPos.x + other.width / 2,
                    otherPos.y + other.height / 2,
                    'small'
                  );
                  
                  // Play smash sound
                  soundSystem.playSfx(SoundEffects.EXPLODE);
                  
                  console.log(`[NPC] ${obj.subType} smashed through breakable block at (${otherPos.x}, ${otherPos.y})`);
                }
              }
            }
          });
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
        const playerComponent = player.getComponent(PlayerComponent);
        if (!playerComponent) return; // Should always exist for player object
        
        if (hotSpot === HotSpotType.DIE && !playerComponent.isDying) {
          // Player death from death zone - matching original behavior:
          // 1. Play death animation in-game
          // 2. After 2 seconds, fade to black
          // 3. Restart level automatically (no game over screen)
          playerComponent.isDying = true;
          playerComponent.deathTime = 2.0; // 2 seconds until fade starts (matching original)
          playerComponent.currentState = PlayerState.DEAD;
          playerComponent.fadeToRestart = false; // Will be set true after deathTime expires
          soundSystem.playSfx(SoundEffects.EXPLODE);
          
          // Spawn explosion effect at player position
          effectsSystem.spawnExplosion(px, py, 'large');
          
          // Screen shake for death
          cameraSystem.shake(15, 0.5);
          
          // Stop player movement
          player.getVelocity().x = 0;
          player.getVelocity().y = 0;
          
          // Track death for stats
          useGameStore.getState().addToTotalStats({ totalDeaths: 1 });
        } else if (hotSpot === HotSpotType.END_LEVEL && !playerComponent.isDying) {
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
              setLevelLoading(true); // Mark level as loading
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
                
                const gameObjectMgr = systemRegistryRef.current?.gameObjectManager;
                gameObjectMgr?.commitUpdates();
                const newPlayer = gameObjectMgr?.getPlayer();
                if (newPlayer) {
                  newPlayer.setPosition(spawn.x, spawn.y);
                  newPlayer.getVelocity().x = 0;
                  newPlayer.getVelocity().y = 0;
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
                  if (newPlayer) {
                    cameraSystem.setTarget(newPlayer);
                    cameraSystem.setPosition(spawn.x, spawn.y);
                  }
                }
                
                setLevelLoading(false); // Mark level as loaded
              });
            } else {
              // No more levels - game complete!
              completeLevel();
            }
          }
        }
      }
      
      // Handle death animation and respawn (matching original behavior)
      // Original flow: death animation plays for 2s, then fade to black over 1.5s, then restart
      const pComp = player?.getComponent(PlayerComponent);
      if (pComp) { // Ensure playerComponent exists
        if (pComp.isDying) {
          pComp.deathTime -= deltaTime;
          
          if (pComp.deathTime <= 0 && !pComp.fadeToRestart) {
            // Start fade to black (1.5 seconds, matching original)
            pComp.fadeToRestart = true;
            pComp.fadeTime = 1.5;
          }
          
          if (pComp.fadeToRestart) {
            pComp.fadeTime -= deltaTime;
            
            if (pComp.fadeTime <= 0) {
              // Fade complete - restart level
              pComp.isDying = false;
              pComp.deathTime = 0;
              pComp.fadeToRestart = false;
              pComp.fadeTime = 0;
              
              // Reload current level
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
                  resetPlayerState();
                  
                  const gameObjectMgr = systemRegistryRef.current?.gameObjectManager;
                  gameObjectMgr?.commitUpdates();
                  const playerObj = gameObjectMgr?.getPlayer();
                  if (playerObj) {
                    playerObj.setPosition(spawn.x, spawn.y);
                    playerObj.getVelocity().x = 0;
                    playerObj.getVelocity().y = 0;
                  }
                });
              }
            }
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
                  dialogIsCutsceneRef.current = false; // Player-triggered dialog pauses physics
                  // Update ref immediately to prevent duplicate triggers (state update is async)
                  activeDialogRef.current = dialog;
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
        const playerComponent = player.getComponent(PlayerComponent);
        if (!playerComponent) return; // Should always exist for player object
        
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
                // Coins don't add to score in the original game - only track count
                setInventory({ coinCount: inv.coinCount + 1 });
                soundSystem.playSfx(SoundEffects.GEM1, 0.5);
                
                // Track coins toward glow mode powerup
                playerComponent.coinsForPowerup++;
                
                // Check if enough coins for glow mode (difficulty-based)
                const difficultyConfig = getDifficultySettings();
                const coinsNeeded = difficultyConfig.coinsPerPowerup;
                const glowDuration = difficultyConfig.glowDuration;
                
                if (playerComponent.coinsForPowerup >= coinsNeeded) {
                  // Activate glow mode!
                  playerComponent.glowMode = true;
                  playerComponent.glowTime = glowDuration;
                  playerComponent.invincible = true;  // Glow mode grants invincibility
                  playerComponent.invincibleTime = glowDuration;
                  playerComponent.coinsForPowerup = 0;  // Reset counter
                  
                  // Restore player health to max (original game behavior)
                  setInventory({ lives: difficultyConfig.playerMaxLife });
                  
                  soundSystem.playSfx(SoundEffects.DING, 1.0);  // Power-up sound
                }
              } else if (obj.type === 'ruby') {
                const newRubyCount = inv.rubyCount + 1;
                setInventory({ rubyCount: newRubyCount, score: inv.score + 3 });
                soundSystem.playSfx(SoundEffects.GEM2, 0.5);
                
                // WIN CONDITION: Collecting 3 rubies (MAX_GEMS_PER_LEVEL) completes the level
                if (newRubyCount >= PlayerComponent.MAX_GEMS_PER_LEVEL) {
                  if (!playerComponent.levelWon) {
                    playerComponent.levelWon = true;
                    playerComponent.currentState = PlayerState.WIN;
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
                  playerComponent.currentState = PlayerState.FROZEN;
                  
                  canvasDiary.show(diaryEntry, () => {
                    // Resume when diary is closed
                    if (playerComponent.currentState === PlayerState.FROZEN) {
                      playerComponent.currentState = PlayerState.MOVE;
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
              
              // Check if player is stomping (coming from above with stomp attack)
              if (playerComponent.stomping || (player.getVelocity().y > 0 && playerPos.y < objPos.y)) {
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
                timeSystem.freeze(PlayerComponent.ATTACK_PAUSE_DELAY);
                
                // Award points
                const inv = getInventory();
                setInventory({ score: inv.score + 25 });
              } else if (!playerComponent.invincible && playerComponent.currentState !== PlayerState.HIT_REACT && !playerComponent.isDying) {
                // Enemy damages player (only if not invincible, not in hit reaction, and not dying)
                // Original game has 2 health points (MAX_PLAYER_LIFE = 2)
                const inv = getInventory();
                const newHealth = inv.lives - 1; // Using 'lives' as health for now
                setInventory({ lives: newHealth });
                soundSystem.playSfx(SoundEffects.THUMP);
                
                // Screen shake for damage feedback
                cameraSystem.shake(8, 0.3);
                
                if (newHealth <= 0) {
                  // Player dies - matching original death flow:
                  // 1. Play death animation in-game
                  // 2. After 2 seconds, fade to black
                  playerComponent.currentState = PlayerState.DEAD;
                  playerComponent.isDying = true;
                  playerComponent.deathTime = 2.0; // 2 seconds until fade starts
                  playerComponent.fadeToRestart = false;
                  
                  // Stop player movement
                  player.getVelocity().x = 0;
                  player.getVelocity().y = 0;
                  
                  // Spawn explosion effect
                  effectsSystem.spawnExplosion(
                    playerPos.x + player.width / 2,
                    playerPos.y + player.height / 2,
                    'large'
                  );
                  
                  // Track death for stats
                  useGameStore.getState().addToTotalStats({ totalDeaths: 1 });
                  return;
                }
                
                // Enter HIT_REACT state (matching original HIT_REACT_TIME = 0.5s)
                playerComponent.currentState = PlayerState.HIT_REACT;
                playerComponent.hitReactTimer = PlayerComponent.HIT_REACT_TIME;
                  
                // Grant invincibility frames (INVINCIBILITY_TIME from original)
                playerComponent.invincible = true;
                playerComponent.invincibleTime = PlayerComponent.INVINCIBILITY_TIME;
                
                // Knock player back
                const knockbackDir = playerPos.x < objPos.x ? -1 : 1;
                player.setVelocity(knockbackDir * 200, -150);
              }
            }
          }
        });
        
        // NOTE: Button collision detection moved earlier (before gameObjectManager.update)
        // so ButtonAnimationComponent sees HIT_REACT + DEPRESS in the same frame
        
        // Check NPC collisions for dialog trigger (e.g., Kyle encounter)
        gameObjectManager.forEach((obj) => {
          if (obj === player || !obj.isVisible()) return;
          
          // Check if NPC - trigger dialog when player touches them
          if (obj.type === 'npc' && activeDialogRef.current === null && dialogTriggerCooldownRef.current <= 0) {
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
              
              // Trigger dialog for this NPC
              const levelSys = levelSystemRef.current;
              if (levelSys) {
                const levelId = levelSys.getCurrentLevelId();
                const levelInfo = levelSys.getLevelInfo(levelId);
                
                if (levelInfo) {
                  const dialogs = getDialogsForLevel(levelInfo.file);
                  
                  if (dialogs.length > 0) {
                    const dialog = dialogs[0]; // Use first dialog for NPC collision
                    
                    if (dialog) {
                      console.log('[Game] Player touched NPC, triggering dialog');
                      setDialogConversationIndex(0);
                      setDialogSingleMode(false); // Show full dialog
                      // Update ref immediately to prevent duplicate triggers (state update is async)
                      activeDialogRef.current = dialog;
                      setActiveDialog(dialog);
                      soundSystem.playSfx(SoundEffects.BUTTON);
                      dialogTriggerCooldownRef.current = 2.0;
                    }
                  }
                }
              }
            }
          }
        });
      }
      
      // Update camera - must happen even for cutscene levels without player
      // For player levels, set target to player; for NPC levels, target is already set via setNPCTarget
      if (player && !cameraSystem.isNPCFocusMode()) {
        cameraSystem.setTarget(player);
      }
      cameraSystem.update(deltaTime);
      
      // Update player state machine (using existing playerComponent from death handling above)
      const playerComponent = player?.getComponent(PlayerComponent);
      if (!player || !playerComponent) return; // No player = cutscene level, skip player-specific logic
      
      // Update HIT_REACT state timer
      if (playerComponent.currentState === PlayerState.HIT_REACT) {
        playerComponent.hitReactTimer -= deltaTime;
        if (playerComponent.hitReactTimer <= 0) {
          playerComponent.currentState = PlayerState.MOVE;
          playerComponent.hitReactTimer = 0;
        }
      }
      
      // Update invincibility timer
      if (playerComponent.invincible) {
        playerComponent.invincibleTime -= deltaTime;
        if (playerComponent.invincibleTime <= 0) {
          playerComponent.invincible = false;
        }
      }
      
      // Update glow mode timer (separate from invincibility in case we extend glow)
      if (playerComponent.glowMode) {
        playerComponent.glowTime -= deltaTime;
        if (playerComponent.glowTime <= 0) {
          playerComponent.glowMode = false;
          playerComponent.glowTime = 0;
        }
      }

      // Camera shake on landing from high jump or stomp
      if (playerComponent.stomping && playerComponent.touchingGround && !playerComponent.stompLanded) {
        const cameraSys = systemRegistryRef.current?.cameraSystem;
        if (cameraSys) {
          cameraSys.shake(PlayerComponent.STOMP_SHAKE_MAGNITUDE, PlayerComponent.STOMP_VIBRATE_TIME);
        }
        // Vibrate device - removed as not in SystemRegistry
        /*
        const vibrationSys = systemRegistryRef.current?.vibrationSystem;
        if (vibrationSys) {
          vibrationSys.vibrate(PlayerComponent.STOMP_VIBRATE_TIME * 1000);
        }
        */
        playerComponent.stompLanded = true; // Mark stomp as landed to prevent repeated shakes
      }

      // Refuel when on ground
      if (playerComponent.fuel < PlayerComponent.FUEL_AMOUNT) {
        if (playerComponent.touchingGround) {
          playerComponent.fuel += 2.0 * deltaTime;
        } else {
          playerComponent.fuel += 0.5 * deltaTime;
        }
        playerComponent.fuel = Math.min(PlayerComponent.FUEL_AMOUNT, playerComponent.fuel);
      }

      // Ghost mechanic
      if (input.attack && playerComponent.touchingGround && !playerComponent.stomping && !playerComponent.ghostActive) {
        playerComponent.ghostChargeTime += deltaTime;
        
        if (playerComponent.ghostChargeTime >= PlayerComponent.GHOST_CHARGE_TIME) {
          playerComponent.ghostActive = true;
          playerComponent.ghostChargeTime = 0;
          soundSystem.playSfx(SoundEffects.POSSESSION, 0.7);
          
          // Spawn ghost logic would go here
          // For now just freeze player
          playerComponent.currentState = PlayerState.FROZEN;
        }
      } else if (!input.attack) {
        playerComponent.ghostChargeTime = 0;
      }

      // Stomp attack
      const inTheAir = !playerComponent.touchingGround;
      if (input.attack && inTheAir && !playerComponent.stomping && playerComponent.currentState === PlayerState.MOVE) {
        playerComponent.currentState = PlayerState.STOMP;
        playerComponent.stomping = true;
        playerComponent.stompTime = gameTime;
        playerComponent.stompHangTime = PlayerComponent.STOMP_AIR_HANG_TIME;
        playerComponent.stompLanded = false;
        
        const velocity = player.getVelocity();
        if (PlayerComponent.STOMP_AIR_HANG_TIME > 0) {
          velocity.x = 0;
          velocity.y = 0;
        } else {
          velocity.y = PlayerComponent.STOMP_VELOCITY;
        }
        soundSystem.playSfx(SoundEffects.STOMP);
      }

      // Jump/Fly
      if (input.jump) {
        const velocity = player.getVelocity();
        if (playerComponent.touchingGround && !playerComponent.rocketsOn) {
          // Initial jump from ground
          velocity.y = -PlayerComponent.AIR_VERTICAL_IMPULSE_FROM_GROUND;
          playerComponent.jumpTime = gameTime;
          soundSystem.playSfx(SoundEffects.POING, 0.5);
        } else if (gameTime > playerComponent.jumpTime + PlayerComponent.JUMP_TO_JETS_DELAY) {
          // Jet pack
          if (playerComponent.fuel > 0) {
            playerComponent.fuel -= deltaTime;
            velocity.y += -PlayerComponent.AIR_VERTICAL_IMPULSE_SPEED * deltaTime;
            playerComponent.rocketsOn = true;
            
            // Cap upward speed
            if (velocity.y < -PlayerComponent.MAX_UPWARD_SPEED) {
              velocity.y = -PlayerComponent.MAX_UPWARD_SPEED;
            }
          }
        }
      } else {
        playerComponent.rocketsOn = false;
      }
    });

    // Render callback
    let renderCount = 0;
    gameLoop.setRenderCallback((): void => {
      renderCount++;
      if (renderCount === 1 || renderCount === 60) {
        console.log('[Game Render]', { renderCount, tileMapLayers: tileMapRendererRef.current?.getLayerCount() });
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
        
        // Simple parallax - background scrolls at 0.3x speed
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
          if (!player) return; // Should not happen if isPlayer is true, but satisfies TS
          const pComp = obj.getComponent(PlayerComponent);
          if (!pComp) return;

          // Check if flashing (invincible) - skip every other frame
          if (pComp.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
            return; // Skip rendering this frame for flashing effect
          }
          
          const vel = obj.getVelocity();
          const absVelX = Math.abs(vel.x);
          
          // Determine animation state based on player state (matching original AnimationComponent.java logic)
          let animState = 'idle';
          let animFrames: string[] = ['andou_stand'];
          let looping = false;
          
          // Check state machine first for special states
          if (pComp.currentState === PlayerState.HIT_REACT) {
            // HIT_REACT animation - hit/damaged pose
            animState = 'hit';
            animFrames = ['andou_hit'];
            looping = false;
          } else if (pComp.currentState === PlayerState.DEAD || pComp.isDying) {
            // DEAD animation - death sequence
            animState = 'dead';
            animFrames = ['andou_die01', 'andou_die02'];
            looping = false;
          } else if (pComp.stomping) {
            // STOMP animation - 4 frames, not looping
            animState = 'stomp';
            animFrames = ['andou_stomp01', 'andou_stomp02', 'andou_stomp03', 'andou_stomp04'];
            looping = false;
          } else if (pComp.ghostChargeTime > 0) {
            // Charging ghost - could use a special charging animation
            // For now, use a slight variation (maybe flyup frames to show charging)
            animState = 'charge';
            animFrames = ['andou_flyup01'];
            looping = false;
          } else if (pComp.touchingGround) {
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
            if (pComp.rocketsOn) {
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
          if (animState !== pComp.lastAnimState) {
            pComp.animFrame = 0;
            pComp.animTimer = 0;
            pComp.lastAnimState = animState;
          }
          
          // Update animation timer
          pComp.animTimer += 1 / 60; // Assuming 60 FPS game loop
          if (pComp.animTimer >= FRAME_TIME) {
            pComp.animTimer -= FRAME_TIME;
            pComp.animFrame++;
            
            if (pComp.animFrame >= animFrames.length) {
              if (looping) {
                pComp.animFrame = 0;
              } else {
                pComp.animFrame = animFrames.length - 1; // Stay on last frame
              }
            }
          }
          
          const spriteName = animFrames[pComp.animFrame] || animFrames[0];
          
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
          if (pComp.rocketsOn) {
            // Update jet fire animation
            pComp.jetTimer += 1 / 60;
            if (pComp.jetTimer >= FRAME_TIME) {
              pComp.jetTimer -= FRAME_TIME;
              pComp.jetFrame = (pComp.jetFrame + 1) % 2;
            }
            
            const jetSpriteName = pComp.jetFrame === 0 ? 'jetfire01' : 'jetfire02';
            if (renderSystem.hasSprite(jetSpriteName)) {
              // Jets are drawn below the player (offset Y by +16 in original)
              // In canvas coords, +Y is down, so we add to Y to draw below feet
              renderSystem.drawSprite(jetSpriteName, pos.x + spriteOffsetX, pos.y + spriteOffsetY + 16, 0, 9, 1, scaleX, 1);
            }
          }
          
          // Draw player sprite or fallback rectangle
          if (renderSystem.hasSprite(spriteName)) {
            
            // Apply glow effect when in glow mode
            if (pComp.glowMode && ctx) {
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
            if (pComp.currentState === PlayerState.HIT_REACT) {
              // Update sparks animation
              pComp.sparkTimer += 1 / 60;
              if (pComp.sparkTimer >= FRAME_TIME) {
                pComp.sparkTimer -= FRAME_TIME;
                pComp.sparkFrame = (pComp.sparkFrame + 1) % 3;
              }
              
              const sparkFrames = ['spark01', 'spark02', 'spark03'];
              const sparkSpriteName = sparkFrames[pComp.sparkFrame];
              if (renderSystem.hasSprite(sparkSpriteName)) {
                // Sparks drawn at player center, slightly higher priority (on top)
                renderSystem.drawSprite(sparkSpriteName, pos.x + spriteOffsetX, pos.y + spriteOffsetY, 0, 11, 1, scaleX, 1);
              }
            }
          } else {
            // Fallback green rectangle for player (with glow if needed)
            if (pComp.glowMode && ctx) {
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
                      // drawSprite(name, x, y, frame, z, alpha, scaleX, scaleY, rotation)
                      // Use frame=0 (single frame sprites), z-index staggered for layering
                      renderSystem.drawSprite(
                        sourceLayers[layerIdx],
                        sourcePos.x + offsetX,
                        sourcePos.y + offsetY,
                        0,                // frame (single frame sprites)
                        10 + layerIdx     // z-index (staggered for layers)
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
              let npcSpriteWidth = 64;
              let npcSpriteHeight = 128;
              
              // Determine animation based on movement state
              const npcVel = obj.getVelocity();
              const absVelX = Math.abs(npcVel.x);
              const absVelY = Math.abs(npcVel.y);
              
              if (npcType === 'wanda') {
                // Wanda has: stand, walk (5 frames), run (8 frames), jump (2 frames), crouch, shoot (9 frames)
                if (absVelY > 50 && !obj.touchingGround()) {
                  // Jumping/falling
                  spriteFrames = ['enemy_wanda_jump01', 'enemy_wanda_jump02'];
                } else if (absVelX > 100) {
                  // Running
                  spriteFrames = [
                    'enemy_wanda_run01', 'enemy_wanda_run02', 'enemy_wanda_run03', 'enemy_wanda_run04',
                    'enemy_wanda_run05', 'enemy_wanda_run06', 'enemy_wanda_run07', 'enemy_wanda_run08'
                  ];
                } else if (absVelX > 10) {
                  // Walking
                  spriteFrames = [
                    'enemy_wanda_walk01', 'enemy_wanda_walk02', 'enemy_wanda_walk03',
                    'enemy_wanda_walk04', 'enemy_wanda_walk05'
                  ];
                } else {
                  // Standing
                  spriteFrames = ['enemy_wanda_stand'];
                }
              } else if (npcType === 'kyle') {
                // Kyle only has stand sprite currently
                spriteFrames = ['enemy_kyle_stand'];
              } else if (npcType === 'kabocha') {
                // Kabocha has: stand, walk (6 frames)
                if (absVelX > 10) {
                  // Walking
                  spriteFrames = [
                    'kabocha_walk01', 'kabocha_walk02', 'kabocha_walk03',
                    'kabocha_walk04', 'kabocha_walk05', 'kabocha_walk06'
                  ];
                } else {
                  // Standing
                  spriteFrames = ['kabocha_stand'];
                }
              } else {
                // Generic NPC fallback
                spriteFrames = [`${npcType}_stand`];
              }
              
              obj.animFrame = obj.animFrame % spriteFrames.length;
              spriteName = spriteFrames[obj.animFrame];
              
              // Center sprite on object
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
            case 'decoration': {
              // Decoration objects (dead robots, etc.)
              const decorationType = obj.subType || 'andou_dead';
              if (decorationType === 'andou_dead') {
                spriteName = 'andou_dead';
              } else if (decorationType === 'kyle_dead') {
                spriteName = 'kyle_dead';
              }
              spriteOffset.x = 0;
              spriteOffset.y = 0;
              break;
            }
            case 'terminal': {
              // Terminal objects - static displays showing Kabocha or Rokudou
              const terminalType = obj.subType || 'kabocha';
              if (terminalType === 'kabocha') {
                spriteFrames = ['object_terminal_kabocha01', 'object_terminal_kabocha02', 'object_terminal_kabocha03'];
              } else {
                // Rokudou terminal
                spriteFrames = ['object_terminal01', 'object_terminal02', 'object_terminal03'];
              }
              obj.animFrame = obj.animFrame % spriteFrames.length;
              spriteName = spriteFrames[obj.animFrame];
              // Terminals are 64x64, center on object
              spriteOffset.x = (obj.width - 64) / 2;
              spriteOffset.y = (obj.height - 64) / 2;
              break;
            }
            case 'hint_sign': {
              // Hint sign - shows tutorial text when touched
              spriteName = 'object_sign';
              // Sign is 32x32
              spriteOffset.x = 0;
              spriteOffset.y = 0;
              break;
            }
            case 'projectile': {
              // Projectiles (energy balls, cannon balls, turret bullets)
              // Use faster animation for projectiles (80ms per frame instead of 150ms)
              const PROJECTILE_FRAME_TIME = 0.08;
              if (obj.projectileAnimTimer === undefined) obj.projectileAnimTimer = 0;
              obj.projectileAnimTimer += 1 / 60;
              if (obj.projectileAnimTimer >= PROJECTILE_FRAME_TIME) {
                obj.projectileAnimTimer -= PROJECTILE_FRAME_TIME;
                obj.animFrame = (obj.animFrame || 0) + 1;
              }
              
              const projectileType = obj.subType || 'energy_ball';
              let projWidth = 32;
              let projHeight = 32;
              
              switch (projectileType) {
                case 'energy_ball':
                case 'wanda_shot':
                  // Animated energy ball - 4 frames
                  spriteFrames = ['energy_ball01', 'energy_ball02', 'energy_ball03', 'energy_ball04'];
                  projWidth = 32;
                  projHeight = 32;
                  break;
                case 'cannon_ball':
                  // Snailbomb's cannon ball
                  spriteName = 'snail_bomb';
                  projWidth = 16;
                  projHeight = 16;
                  break;
                case 'turret_bullet':
                  // Turret bullet - uses shot sprite
                  spriteFrames = ['shot01', 'shot02'];
                  projWidth = 16;
                  projHeight = 16;
                  break;
                default:
                  spriteFrames = ['energy_ball01'];
                  projWidth = 32;
                  projHeight = 32;
              }
              
              if (spriteFrames.length > 0) {
                obj.animFrame = (obj.animFrame || 0) % spriteFrames.length;
                spriteName = spriteFrames[obj.animFrame];
              }
              
              // Center projectile sprite
              spriteOffset.x = (obj.width - projWidth) / 2;
              spriteOffset.y = (obj.height - projHeight) / 2;
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
              case 'decoration': color = '#666666'; break;
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
      
      // Update and render Canvas HUD (hide during cutscenes and cutscene-only levels without player)
      const canvasHUD = canvasHUDRef.current;
      const isCutsceneActive = canvasCutsceneRef.current?.isActive() ?? false;
      const hasPlayer = !!systemRegistryRef.current?.gameObjectManager?.getPlayer();
      if (canvasHUD && !isCutsceneActive && hasPlayer) {
        const playerComponent = player?.getComponent(PlayerComponent);
        if (!playerComponent) return; // Should always exist for player object
        canvasHUD.setFuel(playerComponent.fuel / PlayerComponent.FUEL_AMOUNT);
        // Display coinsForPowerup (progress toward glow mode) not total coinCount
        canvasHUD.setInventory(playerComponent.coinsForPowerup, getInventory().rubyCount);
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
      
      // Render death fade-to-black
      // Use existing player variable from outer scope
      const playerCompForFade = player?.getComponent(PlayerComponent);
      if (playerCompForFade && playerCompForFade.fadeToRestart) {
        // Calculate alpha based on fade time (1.5s total)
        // fadeTime goes from 1.5 to 0
        // alpha should go from 0 to 1
        const alpha = Math.min(1, Math.max(0, 1 - (playerCompForFade.fadeTime / 1.5)));
        renderSystem.drawRect(0, 0, width, height, `rgba(0, 0, 0, ${alpha})`, 100);
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

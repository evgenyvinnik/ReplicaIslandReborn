/**
 * Type definitions for Replica Island Reborn
 * Ported from: Original/src/com/replica/replicaisland/
 */

// Game States
export enum GameState {
  LOADING = 'LOADING',
  MAIN_MENU = 'MAIN_MENU',
  LEVEL_SELECT = 'LEVEL_SELECT',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
}

// Action types for game objects
// Ported from: Original/src/com/replica/replicaisland/GameObject.java
export enum ActionType {
  INVALID = 'INVALID',
  IDLE = 'IDLE',
  MOVE = 'MOVE',
  ATTACK = 'ATTACK',
  HIT_REACT = 'HIT_REACT',
  DEATH = 'DEATH',
  HIDE = 'HIDE',
  FROZEN = 'FROZEN',
}

// Team types
export enum Team {
  NONE = 'NONE',
  PLAYER = 'PLAYER',
  ENEMY = 'ENEMY',
}

// Component phases for update ordering
// Ported from: Original/src/com/replica/replicaisland/GameComponent.java
export enum ComponentPhase {
  THINK = 0,
  PHYSICS = 1,
  POST_PHYSICS = 2,
  MOVEMENT = 3,
  COLLISION_DETECTION = 4,
  COLLISION_RESPONSE = 5,
  POST_COLLISION = 6,
  ANIMATION = 7,
  PRE_DRAW = 8,
  DRAW = 9,
  FRAME_END = 10,
}

// Hit types for collision
export enum HitType {
  INVALID = 0,
  HIT = 1,
  DEATH = 2,
  COLLECT = 3,
  ATTACK = 4,
  LAUNCH = 5,
  POSSESS = 6,
}

// Input keys mapping
export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  attack: boolean;
  pause: boolean;
}

// Rectangle for collision bounds
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Sprite frame definition
export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  duration: number;
}

// Animation definition
export interface AnimationDefinition {
  name?: string;  // Optional since often stored with key
  frames: SpriteFrame[];
  loop: boolean;
}

// Tile definition for tilemap
export interface TileDefinition {
  id: number;
  solid: boolean;
  friction: number;
  damage: number;
}

// Level data structure
export interface LevelData {
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: LevelLayer[];
  objects: LevelObject[];
  collisionData: CollisionData;
}

export interface LevelLayer {
  name: string;
  data: number[];
  visible: boolean;
  parallaxX: number;
  parallaxY: number;
}

export interface LevelObject {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, unknown>;
}

export interface CollisionData {
  segments: CollisionSegment[];
}

export interface CollisionSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  normalX: number;
  normalY: number;
}

// Asset manifest
export interface AssetManifest {
  sprites: SpriteAsset[];
  audio: AudioAsset[];
  levels: string[];
}

export interface SpriteAsset {
  name: string;
  path: string;
  animations?: AnimationDefinition[];
}

export interface AudioAsset {
  name: string;
  path: string;
  type: 'sfx' | 'music';
}

// Render command for draw queue
export interface RenderCommand {
  type: 'sprite' | 'tile' | 'rect' | 'text';
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  sprite?: string;
  frame?: number;
  color?: string;
  text?: string;
  alpha?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

// Camera state
export interface CameraState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  width: number;
  height: number;
  zoom: number;
}

// Game configuration
export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  targetFPS: number;
  maxDeltaTime: number;
  debugMode: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
}

// Save data
export interface SaveData {
  currentLevel: number;
  completedLevels: number[];
  totalPearls: number;
  totalDeaths: number;
  playTime: number;
  lastPlayed: string;
}

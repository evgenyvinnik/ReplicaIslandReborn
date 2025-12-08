/**
 * Game Object Type definitions
 * Ported from: Original/src/com/replica/replicaisland/GameObjectFactory.java
 * 
 * These indices must match the object tileset in the level editor
 * and the binary level format.
 */

/**
 * Game object type indices (from original binary level format)
 */
export const GameObjectTypeIndex = {
  INVALID: -1,
  
  // Player
  PLAYER: 0,
  
  // Collectibles
  COIN: 1,
  RUBY: 2,
  DIARY: 3,
  
  // Characters/NPCs
  WANDA: 10,
  KYLE: 11,
  KYLE_DEAD: 12,
  ANDOU_DEAD: 13,
  KABOCHA: 26,
  ROKUDOU_TERMINAL: 27,
  KABOCHA_TERMINAL: 28,
  EVIL_KABOCHA: 29,
  ROKUDOU: 30,
  
  // Enemies - Basic
  BAT: 6,
  STING: 7,
  ONION: 8,
  BROBOT: 16,
  SNAILBOMB: 17,
  SHADOWSLIME: 18,
  MUDMAN: 19,
  SKELETON: 20,
  KARAGUIN: 21,
  PINK_NAMAZU: 22,
  TURRET: 23,
  TURRET_LEFT: 24,
  
  // Interactive Objects
  DOOR_RED: 32,
  DOOR_BLUE: 33,
  DOOR_GREEN: 34,
  BUTTON_RED: 35,
  BUTTON_BLUE: 36,
  BUTTON_GREEN: 37,
  CANNON: 38,
  BROBOT_SPAWNER: 39,
  BROBOT_SPAWNER_LEFT: 40,
  BREAKABLE_BLOCK: 41,
  THE_SOURCE: 42,
  HINT_SIGN: 43,
  
  // Effects
  DUST: 48,
  EXPLOSION_SMALL: 49,
  EXPLOSION_LARGE: 50,
  EXPLOSION_GIANT: 51,
  
  // Special Spawnable
  DOOR_RED_NONBLOCKING: 52,
  DOOR_BLUE_NONBLOCKING: 53,
  DOOR_GREEN_NONBLOCKING: 54,
  GHOST_NPC: 55,
  CAMERA_BIAS: 56,
  FRAMERATE_WATCHER: 57,
  INFINITE_SPAWNER: 58,
  CRUSHER_ANDOU: 59,
  
  // Projectiles
  CANNON_BALL: 65,
  TURRET_BULLET: 66,
  BROBOT_BULLET: 67,
  ENERGY_BALL: 68,
  BREAKABLE_BLOCK_PIECE: 69,
  BREAKABLE_BLOCK_PIECE_SPAWNER: 70,
  WANDA_SHOT: 71,
} as const;

export type GameObjectTypeIndexValue = typeof GameObjectTypeIndex[keyof typeof GameObjectTypeIndex];

/**
 * Get display name for a game object type
 */
export function getObjectTypeName(index: number): string {
  for (const [name, value] of Object.entries(GameObjectTypeIndex)) {
    if (value === index) {
      return name;
    }
  }
  return `UNKNOWN_${index}`;
}

/**
 * Check if an object type is a collectible
 */
export function isCollectible(index: number): boolean {
  return index === GameObjectTypeIndex.COIN ||
         index === GameObjectTypeIndex.RUBY ||
         index === GameObjectTypeIndex.DIARY;
}

/**
 * Check if an object type is an enemy
 */
export function isEnemy(index: number): boolean {
  return (
    index === GameObjectTypeIndex.BAT ||
    index === GameObjectTypeIndex.STING ||
    index === GameObjectTypeIndex.ONION ||
    index === GameObjectTypeIndex.BROBOT ||
    index === GameObjectTypeIndex.SNAILBOMB ||
    index === GameObjectTypeIndex.SHADOWSLIME ||
    index === GameObjectTypeIndex.MUDMAN ||
    index === GameObjectTypeIndex.SKELETON ||
    index === GameObjectTypeIndex.KARAGUIN ||
    index === GameObjectTypeIndex.PINK_NAMAZU ||
    index === GameObjectTypeIndex.TURRET ||
    index === GameObjectTypeIndex.TURRET_LEFT ||
    index === GameObjectTypeIndex.EVIL_KABOCHA ||
    index === GameObjectTypeIndex.THE_SOURCE
  );
}

/**
 * Check if an object type is an NPC
 */
export function isNPC(index: number): boolean {
  return (
    index === GameObjectTypeIndex.WANDA ||
    index === GameObjectTypeIndex.KYLE ||
    index === GameObjectTypeIndex.KABOCHA ||
    index === GameObjectTypeIndex.ROKUDOU ||
    index === GameObjectTypeIndex.GHOST_NPC
  );
}

/**
 * Check if an object type is a door
 */
export function isDoor(index: number): boolean {
  return (
    index === GameObjectTypeIndex.DOOR_RED ||
    index === GameObjectTypeIndex.DOOR_BLUE ||
    index === GameObjectTypeIndex.DOOR_GREEN ||
    index === GameObjectTypeIndex.DOOR_RED_NONBLOCKING ||
    index === GameObjectTypeIndex.DOOR_BLUE_NONBLOCKING ||
    index === GameObjectTypeIndex.DOOR_GREEN_NONBLOCKING
  );
}

/**
 * Check if an object type is a button
 */
export function isButton(index: number): boolean {
  return (
    index === GameObjectTypeIndex.BUTTON_RED ||
    index === GameObjectTypeIndex.BUTTON_BLUE ||
    index === GameObjectTypeIndex.BUTTON_GREEN
  );
}

/**
 * Check if an object type is an effect (non-persistent)
 */
export function isEffect(index: number): boolean {
  return (
    index === GameObjectTypeIndex.DUST ||
    index === GameObjectTypeIndex.EXPLOSION_SMALL ||
    index === GameObjectTypeIndex.EXPLOSION_LARGE ||
    index === GameObjectTypeIndex.EXPLOSION_GIANT
  );
}

/**
 * Get door color for a door/button type
 */
export function getDoorColor(index: number): 'red' | 'blue' | 'green' | null {
  switch (index) {
    case GameObjectTypeIndex.DOOR_RED:
    case GameObjectTypeIndex.DOOR_RED_NONBLOCKING:
    case GameObjectTypeIndex.BUTTON_RED:
      return 'red';
    case GameObjectTypeIndex.DOOR_BLUE:
    case GameObjectTypeIndex.DOOR_BLUE_NONBLOCKING:
    case GameObjectTypeIndex.BUTTON_BLUE:
      return 'blue';
    case GameObjectTypeIndex.DOOR_GREEN:
    case GameObjectTypeIndex.DOOR_GREEN_NONBLOCKING:
    case GameObjectTypeIndex.BUTTON_GREEN:
      return 'green';
    default:
      return null;
  }
}

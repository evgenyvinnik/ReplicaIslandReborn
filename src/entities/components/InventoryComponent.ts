/**
 * Inventory Component - Tracks collectibles and items
 * Ported from: Original/src/com/replica/replicaisland/InventoryComponent.java
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';

export interface InventoryRecord {
  coinCount: number;
  rubyCount: number;
  diaryCount: number;
  pearls: number;  // Gems collected in current level
  totalPearls: number;  // Max gems in level (usually 3)
  lives: number;
  maxLives: number;
  fuel: number;
  maxFuel: number;
  score: number;
}

// Global inventory state (singleton pattern for easy access)
let globalInventory: InventoryRecord = {
  coinCount: 0,
  rubyCount: 0,
  diaryCount: 0,
  pearls: 0,
  totalPearls: 3,
  lives: 3,
  maxLives: 5,
  fuel: 1.0,
  maxFuel: 1.0,
  score: 0,
};

// Listeners for inventory changes
const inventoryListeners: Set<(inventory: InventoryRecord) => void> = new Set();

export function getInventory(): InventoryRecord {
  return { ...globalInventory };
}

export function setInventory(updates: Partial<InventoryRecord>): void {
  globalInventory = { ...globalInventory, ...updates };
  notifyInventoryListeners();
}

export function resetInventory(): void {
  globalInventory = {
    coinCount: 0,
    rubyCount: 0,
    diaryCount: 0,
    pearls: 0,
    totalPearls: 3,
    lives: 3,
    maxLives: 5,
    fuel: 1.0,
    maxFuel: 1.0,
    score: 0,
  };
  notifyInventoryListeners();
}

export function addInventoryListener(listener: (inventory: InventoryRecord) => void): () => void {
  inventoryListeners.add(listener);
  return () => inventoryListeners.delete(listener);
}

function notifyInventoryListeners(): void {
  const inv = getInventory();
  inventoryListeners.forEach(listener => listener(inv));
}

// Collectible value constants based on difficulty
export const CollectibleValues = {
  BABY: {
    COIN: 2,
    RUBY: 5,
    PEARL: 10,
    DIARY: 100,
  },
  KIDS: {
    COIN: 1,
    RUBY: 3,
    PEARL: 5,
    DIARY: 50,
  },
  ADULTS: {
    COIN: 1,
    RUBY: 2,
    PEARL: 3,
    DIARY: 25,
  },
};

export class InventoryComponent extends GameComponent {
  private localRecord: InventoryRecord;
  private changed: boolean = true;
  private difficulty: 'BABY' | 'KIDS' | 'ADULTS' = 'KIDS';

  constructor() {
    super(ComponentPhase.FRAME_END);
    this.localRecord = { ...globalInventory };
  }

  /**
   * Set difficulty for collectible values
   */
  setDifficulty(difficulty: 'BABY' | 'KIDS' | 'ADULTS'): void {
    this.difficulty = difficulty;
  }

  /**
   * Add a coin
   */
  addCoin(count: number = 1): void {
    const value = CollectibleValues[this.difficulty].COIN;
    globalInventory.coinCount += count;
    globalInventory.score += value * count;
    this.changed = true;
    notifyInventoryListeners();
  }

  /**
   * Add a ruby
   */
  addRuby(count: number = 1): void {
    const value = CollectibleValues[this.difficulty].RUBY;
    globalInventory.rubyCount += count;
    globalInventory.score += value * count;
    this.changed = true;
    notifyInventoryListeners();
  }

  /**
   * Add a pearl (gem)
   */
  addPearl(count: number = 1): void {
    const value = CollectibleValues[this.difficulty].PEARL;
    globalInventory.pearls += count;
    globalInventory.score += value * count;
    this.changed = true;
    notifyInventoryListeners();
  }

  /**
   * Add a diary entry
   */
  addDiary(count: number = 1): void {
    const value = CollectibleValues[this.difficulty].DIARY;
    globalInventory.diaryCount += count;
    globalInventory.score += value * count;
    this.changed = true;
    notifyInventoryListeners();
  }

  /**
   * Lose a life
   */
  loseLife(): boolean {
    if (globalInventory.lives > 0) {
      globalInventory.lives--;
      this.changed = true;
      notifyInventoryListeners();
      return globalInventory.lives > 0;
    }
    return false;
  }

  /**
   * Gain a life
   */
  gainLife(count: number = 1): void {
    globalInventory.lives = Math.min(globalInventory.maxLives, globalInventory.lives + count);
    this.changed = true;
    notifyInventoryListeners();
  }

  /**
   * Update fuel
   */
  setFuel(fuel: number): void {
    globalInventory.fuel = Math.max(0, Math.min(globalInventory.maxFuel, fuel));
    this.changed = true;
    notifyInventoryListeners();
  }

  /**
   * Get current fuel
   */
  getFuel(): number {
    return globalInventory.fuel;
  }

  /**
   * Check if player has lives remaining
   */
  hasLivesRemaining(): boolean {
    return globalInventory.lives > 0;
  }

  /**
   * Get current lives
   */
  getLives(): number {
    return globalInventory.lives;
  }

  /**
   * Update component
   */
  update(_deltaTime: number, _parent: GameObject): void {
    // Sync local record with global
    if (this.changed) {
      this.localRecord = { ...globalInventory };
      this.changed = false;
    }
  }

  /**
   * Reset component
   */
  reset(): void {
    this.changed = true;
    this.localRecord = { ...globalInventory };
  }

  /**
   * Get the inventory record
   */
  getRecord(): InventoryRecord {
    return { ...this.localRecord };
  }
}

// Export singleton inventory access
export const inventory = {
  get: getInventory,
  set: setInventory,
  reset: resetInventory,
  addListener: addInventoryListener,
};

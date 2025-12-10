/**
 * Game Flow Event System - Handles game state transitions
 * Ported from: Original/src/com/replica/replicaisland/GameFlowEvent.java
 *
 * Provides a way to trigger game flow events like level restarts,
 * game over, level transitions, dialogs, and animations.
 */

/**
 * Event types for game flow
 */
export enum GameFlowEventType {
  INVALID = -1,
  RESTART_LEVEL = 0,
  END_GAME = 1,
  GO_TO_NEXT_LEVEL = 2,
  SHOW_DIARY = 3,
  SHOW_DIALOG_CHARACTER1 = 4,
  SHOW_DIALOG_CHARACTER2 = 5,
  SHOW_ANIMATION = 6,
}

/**
 * Event listener callback type
 */
export type GameFlowEventListener = (event: GameFlowEventType, dataIndex: number) => void;

/**
 * Game Flow Event System
 */
export class GameFlowEvent {
  private listeners: Set<GameFlowEventListener> = new Set();
  private pendingEvents: Array<{ event: GameFlowEventType; dataIndex: number }> = [];
  private processingEvents: boolean = false;

  /**
   * Add an event listener
   */
  addListener(listener: GameFlowEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove an event listener
   */
  removeListener(listener: GameFlowEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Post an event to be processed on the next frame
   */
  post(event: GameFlowEventType, dataIndex: number = 0): void {
    // Debug: // console.log('GameFlowEvent: Post Game Flow Event:', event, dataIndex);
    this.pendingEvents.push({ event, dataIndex });
  }

  /**
   * Post an event and process it immediately
   */
  postImmediate(event: GameFlowEventType, dataIndex: number = 0): void {
    // Debug: // console.log('GameFlowEvent: Execute Immediate Game Flow Event:', event, dataIndex);
    this.dispatchEvent(event, dataIndex);
  }

  /**
   * Process all pending events
   */
  update(): void {
    if (this.processingEvents || this.pendingEvents.length === 0) {
      return;
    }

    this.processingEvents = true;
    
    // Process all pending events
    while (this.pendingEvents.length > 0) {
      const eventData = this.pendingEvents.shift();
      if (eventData) {
        // Debug: // console.log('GameFlowEvent: Execute Game Flow Event:', eventData.event, eventData.dataIndex);
        this.dispatchEvent(eventData.event, eventData.dataIndex);
      }
    }

    this.processingEvents = false;
  }

  /**
   * Dispatch an event to all listeners
   */
  private dispatchEvent(event: GameFlowEventType, dataIndex: number): void {
    for (const listener of this.listeners) {
      try {
        listener(event, dataIndex);
      } catch {
        // Error in event listener - silently ignore
      }
    }
  }

  /**
   * Reset the event system
   */
  reset(): void {
    this.pendingEvents = [];
    this.processingEvents = false;
    // Note: We don't clear listeners here as they may be needed for the next level
  }

  /**
   * Clear all listeners (use when shutting down)
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Check if there are pending events
   */
  hasPendingEvents(): boolean {
    return this.pendingEvents.length > 0;
  }
}

// Singleton instance for global access
export const gameFlowEvent = new GameFlowEvent();

/**
 * Dialog System
 * Manages dialog state and triggers during gameplay
 * Ported from: Original ConversationUtils.java, ConversationDialogActivity.java
 */

import { getDialog, type Dialog, type DialogPage, type Conversation } from '../data/dialogs';

// Dialog trigger types based on HotSpot values
export enum DialogTrigger {
  TALK = 8,
  WALK_AND_TALK = 10,
  NPC_SELECT_DIALOG_1 = 32,
  NPC_SELECT_DIALOG_2 = 33,
  NPC_SELECT_DIALOG_3 = 34,
  NPC_SELECT_DIALOG_4 = 35,
  NPC_SELECT_DIALOG_5 = 36,
  NPC_SELECT_DIALOG_6 = 37,
  NPC_SELECT_DIALOG_7 = 38,
  NPC_SELECT_DIALOG_8 = 39,
  NPC_SELECT_DIALOG_9 = 40,
  NPC_SELECT_DIALOG_10 = 41,
}

// Dialog state
export interface DialogState {
  isActive: boolean;
  currentDialog: Dialog | null;
  conversationIndex: number;
  pageIndex: number;
  isPaused: boolean;
}

// Dialog event callback types
export type DialogEventCallback = (event: DialogEvent) => void;

export interface DialogEvent {
  type: 'start' | 'page' | 'conversation' | 'complete' | 'skip';
  dialog?: Dialog;
  page?: DialogPage;
  conversationIndex?: number;
  pageIndex?: number;
}

// Dialog system class
export class DialogSystem {
  private state: DialogState;
  private listeners: Set<DialogEventCallback> = new Set();
  private dialogsPlayed: Set<string> = new Set();
  
  constructor() {
    this.state = {
      isActive: false,
      currentDialog: null,
      conversationIndex: 0,
      pageIndex: 0,
      isPaused: false,
    };
  }
  
  // Start a dialog by ID
  startDialog(dialogId: string): boolean {
    const dialog = getDialog(dialogId);
    if (!dialog) {
      console.log(`Dialog not found: ${dialogId}`);
      return false;
    }
    
    return this.startDialogDirect(dialog, dialogId);
  }
  
  // Start a dialog directly with a Dialog object
  startDialogDirect(dialog: Dialog, dialogId?: string): boolean {
    if (dialog.conversations.length === 0) {
      return false;
    }
    
    this.state = {
      isActive: true,
      currentDialog: dialog,
      conversationIndex: 0,
      pageIndex: 0,
      isPaused: false,
    };
    
    if (dialogId) {
      this.dialogsPlayed.add(dialogId);
    }
    
    this.emit({
      type: 'start',
      dialog,
      conversationIndex: 0,
      pageIndex: 0,
      page: dialog.conversations[0]?.pages[0],
    });
    
    return true;
  }
  
  // Start a specific conversation within a dialog
  startConversation(dialogId: string, conversationIndex: number): boolean {
    const dialog = getDialog(dialogId);
    if (!dialog || conversationIndex >= dialog.conversations.length) {
      return false;
    }
    
    this.state = {
      isActive: true,
      currentDialog: dialog,
      conversationIndex,
      pageIndex: 0,
      isPaused: false,
    };
    
    this.emit({
      type: 'start',
      dialog,
      conversationIndex,
      pageIndex: 0,
      page: dialog.conversations[conversationIndex]?.pages[0],
    });
    
    return true;
  }
  
  // Advance to next page or conversation
  advance(): void {
    if (!this.state.isActive || !this.state.currentDialog) {
      return;
    }
    
    const { currentDialog, conversationIndex, pageIndex } = this.state;
    const currentConversation = currentDialog.conversations[conversationIndex];
    
    if (!currentConversation) {
      this.complete();
      return;
    }
    
    // Try to advance to next page
    if (pageIndex < currentConversation.pages.length - 1) {
      this.state.pageIndex++;
      this.emit({
        type: 'page',
        dialog: currentDialog,
        conversationIndex,
        pageIndex: this.state.pageIndex,
        page: currentConversation.pages[this.state.pageIndex],
      });
      return;
    }
    
    // Try to advance to next conversation
    if (conversationIndex < currentDialog.conversations.length - 1) {
      this.state.conversationIndex++;
      this.state.pageIndex = 0;
      const nextConversation = currentDialog.conversations[this.state.conversationIndex];
      this.emit({
        type: 'conversation',
        dialog: currentDialog,
        conversationIndex: this.state.conversationIndex,
        pageIndex: 0,
        page: nextConversation?.pages[0],
      });
      return;
    }
    
    // Dialog complete
    this.complete();
  }
  
  // Skip to end of current conversation
  skipConversation(): void {
    if (!this.state.isActive || !this.state.currentDialog) {
      return;
    }
    
    const { currentDialog, conversationIndex } = this.state;
    
    // Try to advance to next conversation
    if (conversationIndex < currentDialog.conversations.length - 1) {
      this.state.conversationIndex++;
      this.state.pageIndex = 0;
      const nextConversation = currentDialog.conversations[this.state.conversationIndex];
      this.emit({
        type: 'conversation',
        dialog: currentDialog,
        conversationIndex: this.state.conversationIndex,
        pageIndex: 0,
        page: nextConversation?.pages[0],
      });
      return;
    }
    
    // Dialog complete
    this.complete();
  }
  
  // Skip entire dialog
  skip(): void {
    if (!this.state.isActive) {
      return;
    }
    
    this.emit({ type: 'skip' });
    this.reset();
  }
  
  // Complete the dialog
  private complete(): void {
    const dialog = this.state.currentDialog;
    this.emit({
      type: 'complete',
      dialog: dialog || undefined,
    });
    this.reset();
  }
  
  // Reset state
  reset(): void {
    this.state = {
      isActive: false,
      currentDialog: null,
      conversationIndex: 0,
      pageIndex: 0,
      isPaused: false,
    };
  }
  
  // Pause/resume dialog
  pause(): void {
    this.state.isPaused = true;
  }
  
  resume(): void {
    this.state.isPaused = false;
  }
  
  // Get current state
  getState(): Readonly<DialogState> {
    return { ...this.state };
  }
  
  // Check if dialog is active
  isActive(): boolean {
    return this.state.isActive;
  }
  
  // Get current page
  getCurrentPage(): DialogPage | null {
    if (!this.state.currentDialog) return null;
    const conversation = this.state.currentDialog.conversations[this.state.conversationIndex];
    return conversation?.pages[this.state.pageIndex] || null;
  }
  
  // Get current conversation
  getCurrentConversation(): Conversation | null {
    if (!this.state.currentDialog) return null;
    return this.state.currentDialog.conversations[this.state.conversationIndex] || null;
  }
  
  // Check if a dialog has been played
  hasPlayed(dialogId: string): boolean {
    return this.dialogsPlayed.has(dialogId);
  }
  
  // Mark a dialog as played
  markPlayed(dialogId: string): void {
    this.dialogsPlayed.add(dialogId);
  }
  
  // Reset played dialogs (for new game)
  resetPlayed(): void {
    this.dialogsPlayed.clear();
  }
  
  // Subscribe to dialog events
  subscribe(callback: DialogEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  // Emit event to listeners
  private emit(event: DialogEvent): void {
    this.listeners.forEach(listener => listener(event));
  }
  
  // Trigger dialog from hot spot value
  triggerFromHotSpot(hotSpotValue: number, npcId: string, levelId: string): void {
    // Map hot spot values to dialog IDs
    if (hotSpotValue === DialogTrigger.TALK || hotSpotValue === DialogTrigger.WALK_AND_TALK) {
      // Try to find dialog for this level and NPC
      const dialogId = `${levelId}_dialog_${npcId}`;
      this.startDialog(dialogId);
      return;
    }
    
    // Handle NPC_SELECT_DIALOG triggers
    if (hotSpotValue >= DialogTrigger.NPC_SELECT_DIALOG_1 && 
        hotSpotValue <= DialogTrigger.NPC_SELECT_DIALOG_10) {
      const dialogIndex = hotSpotValue - DialogTrigger.NPC_SELECT_DIALOG_1;
      const dialogId = `${levelId}_dialog_${npcId}`;
      this.startConversation(dialogId, dialogIndex);
    }
  }
}

// Export singleton instance
export const dialogSystem = new DialogSystem();

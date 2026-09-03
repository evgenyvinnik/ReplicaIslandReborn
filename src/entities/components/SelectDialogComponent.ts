/**
 * SelectDialogComponent - Selects dialog based on hotspot position
 * Ported from: Original/src/com/replica/replicaisland/SelectDialogComponent.java
 *
 * This component triggers different dialog events based on which
 * NPC_SELECT_DIALOG hotspot the NPC is currently standing on.
 * It works with the HitReactionComponent to spawn the appropriate
 * dialog when the player collects/interacts with the NPC.
 */

import { GameComponent } from '../GameComponent';
import type { GameObject } from '../GameObject';
import { ComponentPhase } from '../../types';
import { Vector2 } from '../../utils/Vector2';
import { HotSpotType } from '../../engine/HotSpotSystem';
import { GameFlowEventType } from '../../engine/GameFlowEvent';
import { HitType } from '../../types';
import type { HitReactionComponent } from './HitReactionComponent';

// System registry references
let hotSpotSystem: {
  getHotSpot(x: number, y: number): number;
} | null = null;

let gameFlowEvent: {
  post(event: GameFlowEventType, dataIndex: number): void;
} | null = null;

/**
 * Set system registry for SelectDialogComponent
 */
export function setSelectDialogSystemRegistry(
  hotSpot: typeof hotSpotSystem,
  gameFlow: typeof gameFlowEvent
): void {
  hotSpotSystem = hotSpot;
  gameFlowEvent = gameFlow;
}

export class SelectDialogComponent extends GameComponent {
  private lastPosition: Vector2 = new Vector2(0, 0);
  private currentDialogEvent: GameFlowEventType = GameFlowEventType.INVALID;
  private currentDialogIndex: number = 0;
  private hitReactionComponent: HitReactionComponent | null = null;

  constructor() {
    super(ComponentPhase.THINK);
  }

  /**
   * Get the currently selected dialog event type
   */
  getSelectedDialogEvent(): GameFlowEventType {
    return this.currentDialogEvent;
  }

  /**
   * Get the currently selected dialog index
   */
  getSelectedDialogIndex(): number {
    return this.currentDialogIndex;
  }

  /**
   * Trigger the selected dialog event
   */
  triggerDialog(): void {
    if (gameFlowEvent && this.currentDialogEvent !== GameFlowEventType.INVALID) {
      gameFlowEvent.post(this.currentDialogEvent, this.currentDialogIndex);
    }
  }

  /** Original: SelectDialogComponent programs its owner's COLLECT reaction. */
  setHitReactionComponent(hitReaction: HitReactionComponent): void {
    this.hitReactionComponent = hitReaction;
  }

  /**
   * Update - check position and update selected dialog
   */
  update(_deltaTime: number, parent: GameObject): void {
    if (!hotSpotSystem) {
      return;
    }

    const currentPosition = parent.getPosition();

    // Only update if position has changed
    const dx = currentPosition.x - this.lastPosition.x;
    const dy = currentPosition.y - this.lastPosition.y;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared > 0) {
      this.lastPosition.x = currentPosition.x;
      this.lastPosition.y = currentPosition.y;

      // Check the hot spot 10 pixels above the NPC's feet.
      //
      // The original writes this as `position.y + 10`, but its origin is the
      // object's *bottom* (Y-up). Transcribed literally into this port's Y-down
      // space that samples 10px below the head instead - for a 128px-tall NPC
      // that is nearly four tiles away from the tile it is standing on.
      const hitSpot = hotSpotSystem.getHotSpot(
        parent.getCenteredPositionX(),
        currentPosition.y + parent.height - 10
      );

      // Map hotspot to dialog event and index
      this.updateDialogSelection(hitSpot);
    }
  }

  /**
   * Update dialog selection based on hotspot type
   */
  private updateDialogSelection(hitSpot: number): void {
    // Character 1 dialog hotspots (5 variations)
    if (hitSpot >= HotSpotType.NPC_SELECT_DIALOG_1_1 &&
        hitSpot <= HotSpotType.NPC_SELECT_DIALOG_1_5) {
      this.currentDialogEvent = GameFlowEventType.SHOW_DIALOG_CHARACTER1;
      this.currentDialogIndex = hitSpot - HotSpotType.NPC_SELECT_DIALOG_1_1;
      this.applySelection();
      return;
    }

    // Character 2 dialog hotspots (5 variations)
    if (hitSpot >= HotSpotType.NPC_SELECT_DIALOG_2_1 &&
        hitSpot <= HotSpotType.NPC_SELECT_DIALOG_2_5) {
      this.currentDialogEvent = GameFlowEventType.SHOW_DIALOG_CHARACTER2;
      this.currentDialogIndex = hitSpot - HotSpotType.NPC_SELECT_DIALOG_2_1;
      this.applySelection();
      return;
    }
    // The Android component keeps the most recent selection after leaving the
    // selector tile, allowing a terminal/NPC to remain touchable nearby.
  }

  private applySelection(): void {
    this.hitReactionComponent?.setSpawnGameEventOnHit(
      HitType.COLLECT,
      this.currentDialogEvent,
      this.currentDialogIndex
    );
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.lastPosition.x = 0;
    this.lastPosition.y = 0;
    this.currentDialogEvent = GameFlowEventType.INVALID;
    this.currentDialogIndex = 0;
    this.hitReactionComponent = null;
  }
}

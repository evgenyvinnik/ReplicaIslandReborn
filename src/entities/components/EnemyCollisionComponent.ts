/**
 * Keeps an enemy's collision volumes in step with what it is doing.
 *
 * The original stores attack and vulnerability volumes on each animation frame,
 * so a skeleton only has an attack volume mid-swing and a mudman never has a
 * vulnerability volume at all. This port has no per-frame volume data, so this
 * component re-selects the volume set from the object's current action and
 * hands it to DynamicCollisionComponent before that component submits itself to
 * GameObjectCollisionSystem at FRAME_END.
 *
 * See src/entities/enemyCollisionProfiles.ts for the per-enemy data.
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase, ActionType } from '../../types';
import type { GameObject } from '../GameObject';
import { DynamicCollisionComponent } from './DynamicCollisionComponent';
import {
  selectEnemyAttackVolumes,
  type EnemyCollisionProfile,
} from '../enemyCollisionProfiles';

export class EnemyCollisionComponent extends GameComponent {
  private profile: EnemyCollisionProfile;
  private collision: DynamicCollisionComponent | null = null;
  /** Last action the volumes were built for, so we only swap on change. */
  private appliedAction: ActionType | null = null;

  constructor(profile: EnemyCollisionProfile) {
    // ANIMATION runs after the position is final and before DynamicCollisionComponent
    // submits at FRAME_END, which mirrors where the original picks its frame.
    super(ComponentPhase.ANIMATION);
    this.profile = profile;
  }

  setCollisionComponent(collision: DynamicCollisionComponent): void {
    this.collision = collision;
  }

  reset(): void {
    this.appliedAction = null;
  }

  update(_deltaTime: number, parent: GameObject): void {
    const collision = this.collision
      ?? parent.getComponent(DynamicCollisionComponent);
    if (!collision) return;
    this.collision = collision;

    const action = parent.getCurrentAction();
    if (action === this.appliedAction) return;
    this.appliedAction = action;

    collision.setCollisionVolumes(
      selectEnemyAttackVolumes(this.profile, action),
      this.profile.vulnerability
    );
  }
}

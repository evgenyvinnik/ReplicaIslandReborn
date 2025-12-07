/**
 * Camera Bias Component - Adds camera bias toward object position
 * Ported from: Original/src/com/replica/replicaisland/CameraBiasComponent.java
 *
 * This component is used to pull the camera toward points of interest in the level.
 * When attached to a game object, it adds a bias to the camera system that gently
 * pulls the camera view toward the object's position.
 *
 * Common uses:
 * - Level design focus points (look at important areas)
 * - Boss arena camera positioning
 * - Scenic viewpoints
 * - Tutorial highlights
 */

import { GameComponent } from '../GameComponent';
import { ComponentPhase } from '../../types';
import type { GameObject } from '../GameObject';
import type { SystemRegistry } from '../../engine/SystemRegistry';

// Global system registry reference
let sSystemRegistry: SystemRegistry | null = null;

export function setCameraBiasSystemRegistry(registry: SystemRegistry): void {
  sSystemRegistry = registry;
}

export class CameraBiasComponent extends GameComponent {
  constructor() {
    super(ComponentPhase.THINK);
  }

  /**
   * Update - add camera bias toward this object's position
   */
  update(_deltaTime: number, parent: GameObject): void {
    const camera = sSystemRegistry?.cameraSystem;
    if (camera) {
      camera.addCameraBias(parent.getPosition());
    }
  }

  /**
   * Reset - nothing to reset
   */
  reset(): void {
    // No state to reset
  }
}

import type { AnimationDefinition, SpriteFrame } from '../types';
import { HitType } from '../types';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { DoorAnimation } from '../entities/components/DoorAnimationComponent';

/** Both solid and non-blocking gates share the original four images/timings. */
export function createDoorAnimations(color: string): Map<DoorAnimation, AnimationDefinition> {
  const frame = (image: string, ticks: number): SpriteFrame => ({
    x: 0, y: 0, width: 32, height: 64,
    duration: ticks / 24, sprite: `object_door_${color}${image}`,
    attackVolumes: null, vulnerabilityVolumes: null,
  });
  const crushFrame = frame('02', 2);
  // Android spawnObjectDoor: (12, 8, 8, 56) on a 32x64 Y-up sprite.
  // Only this closing frame is lethal; other frames explicitly clear it,
  // including when a button reverses the gate back into OPENING.
  crushFrame.attackVolumes = [new AABoxCollisionVolume(12, 0, 8, 56, HitType.DEATH)];
  return new Map([
    [DoorAnimation.CLOSED, { name: 'closed', frames: [frame('01', 1)], loop: false }],
    [DoorAnimation.OPEN, { name: 'open', frames: [frame('04', 1)], loop: false }],
    [DoorAnimation.OPENING, { name: 'opening', frames: [frame('02', 2), frame('03', 2)], loop: false }],
    [DoorAnimation.CLOSING, { name: 'closing', frames: [frame('03', 2), crushFrame], loop: false }],
  ]);
}

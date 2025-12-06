/**
 * Components - Entity component system building blocks
 */

// Export all components
export { SpriteComponent } from './SpriteComponent';
export { PhysicsComponent } from './PhysicsComponent';
export { MovementComponent } from './MovementComponent';
export { PlayerComponent } from './PlayerComponent';

// New components
export { InventoryComponent, inventory, getInventory, setInventory, resetInventory, addInventoryListener } from './InventoryComponent';
export type { InventoryRecord } from './InventoryComponent';

export { PatrolComponent } from './PatrolComponent';
export type { PatrolConfig } from './PatrolComponent';

export { HitReactionComponent } from './HitReactionComponent';
export type { HitReactionConfig } from './HitReactionComponent';

export { BackgroundCollisionComponent } from './BackgroundCollisionComponent';
export type { BackgroundCollisionConfig } from './BackgroundCollisionComponent';

export { DynamicCollisionComponent } from './DynamicCollisionComponent';

export { GenericAnimationComponent } from './GenericAnimationComponent';
export type { GenericAnimation } from './GenericAnimationComponent';

export { EnemyAnimationComponent } from './EnemyAnimationComponent';
export type { EnemyAnimation } from './EnemyAnimationComponent';

export { HitPlayerComponent } from './HitPlayerComponent';
export type { HitPlayerConfig } from './HitPlayerComponent';

export { NPCAnimationComponent, NPCAnimation } from './NPCAnimationComponent';
export type { NPCAnimationConfig } from './NPCAnimationComponent';

export { ButtonAnimationComponent, ButtonAnimation } from './ButtonAnimationComponent';
export type { ButtonAnimationConfig } from './ButtonAnimationComponent';

export { DoorAnimationComponent, DoorAnimation } from './DoorAnimationComponent';
export type { DoorAnimationConfig } from './DoorAnimationComponent';

export { LauncherComponent } from './LauncherComponent';
export type { LauncherConfig } from './LauncherComponent';

export { SleeperComponent } from './SleeperComponent';
export type { SleeperConfig } from './SleeperComponent';

export { PopOutComponent } from './PopOutComponent';
export type { PopOutConfig } from './PopOutComponent';

export { AttackAtDistanceComponent } from './AttackAtDistanceComponent';
export type { AttackAtDistanceConfig } from './AttackAtDistanceComponent';

export { LaunchProjectileComponent } from './LaunchProjectileComponent';
export type { LaunchProjectileConfig } from './LaunchProjectileComponent';

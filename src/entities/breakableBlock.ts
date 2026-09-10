import type { GameObject } from './GameObject';
import { GameObjectType } from './GameObjectFactory';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { SolidSurfaceComponent } from './components/SolidSurfaceComponent';
import { PlayerComponent } from './components/PlayerComponent';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { sSystemRegistry, type SystemRegistry } from '../engine/SystemRegistry';
import { HitType, Team } from '../types';
import { SoundEffects } from '../engine/SoundSystem';

/** Geometry shared by shipped blocks and runtime/test spawns. */
export function configureBreakableBlock(object: GameObject): void {
  object.type = 'breakable_block';
  object.width = object.height = 32;
  object.life = 1;
  object.team = Team.ENEMY;
  object.activationRadius = Math.hypot(240, 160) + 128;
  const collision = new DynamicCollisionComponent();
  // Android Y-up box (7, 0, 25, 42) reaches 10px above a 32px block.
  collision.setCollisionVolumes(null, [new AABoxCollisionVolume(7, -10, 25, 42, HitType.HIT)]);
  const reaction = new HitReactionComponent();
  collision.setHitReactionComponent(reaction);
  object.addComponent(collision);
  object.addComponent(reaction);
  const surface = new SolidSurfaceComponent();
  surface.createRectangle(32, 32);
  object.addComponent(surface);
}

/** Original block Lifetime consequence, shared by collisions and Wanda's script. */
export function resolveBreakableBlockDeath(block: GameObject, registry: SystemRegistry = sSystemRegistry): boolean {
  if (block.type !== 'breakable_block' || block.life > 0 || block.isMarkedForRemoval()) return false;
  block.setVisible(false);
  block.markForRemoval();
  const emitter = registry.gameObjectFactory?.spawn(GameObjectType.BLOCK_PIECE_SPAWNER,
    block.getPosition().x, 0, block.facingDirection.x < 0);
  if (emitter) emitter.setPosition(block.getPosition().x, block.getPosition().y + block.height - emitter.height);
  registry.soundSystem?.playSfx(SoundEffects.BREAK_BLOCK);
  const player = registry.gameObjectManager?.getPlayer();
  if (player && block.lastDamageSource === player) {
    registry.effectsSystem?.spawnCrushFlash(block.getCenteredPositionX(), block.getCenteredPositionY());
    registry.timeSystem?.freeze(PlayerComponent.ATTACK_PAUSE_DELAY);
    player.getVelocity().y = -200;
  }
  return true;
}

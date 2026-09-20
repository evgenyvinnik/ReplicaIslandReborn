import type { GameObjectManager } from './GameObjectManager';

/** Reclaim shots consumed by their hit reaction, never by sprite overlap. */
export function finishProjectileCollisions(manager: GameObjectManager): void {
  manager.forEach(object => {
    if (object.type !== 'projectile' || object.life > 0) return;
    object.setVisible(false);
    object.markForRemoval();
  });
}

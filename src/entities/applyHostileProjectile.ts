import { HitType, Team } from '../types';
import type { GameObject } from './GameObject';
import { HitReactionComponent } from './components/HitReactionComponent';

/**
 * Route an enemy projectile into The Source, whose PLAYER team intentionally
 * makes the other bosses' attacks capable of destroying it in the finale.
 */
export function applyHostileProjectileToSource(
  projectile: GameObject,
  target: GameObject
): boolean {
  if (projectile.type !== 'projectile' ||
      projectile.team !== Team.ENEMY ||
      projectile.life <= 0 ||
      target.subType !== 'the_source' ||
      target.team !== Team.PLAYER ||
      target.life <= 0) {
    return false;
  }

  const hitReaction = target.getComponent(
    HitReactionComponent as unknown as new (...args: unknown[]) => HitReactionComponent
  );
  if (!hitReaction?.receivedHit(target, projectile, HitType.HIT)) {
    return false;
  }

  projectile.life = 0;
  projectile.setVisible(false);
  projectile.markForRemoval();
  return true;
}

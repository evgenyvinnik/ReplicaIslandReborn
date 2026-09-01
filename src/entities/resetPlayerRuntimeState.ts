import { ActionType } from '../types';
import type { GameObject } from './GameObject';
import { PlayerComponent } from './components/PlayerComponent';

/**
 * Reset transient player state without destroying the entity configuration that
 * was just built by LevelSystem (dimensions, team, sprite, and hit volumes).
 */
export function resetPlayerRuntimeState(player: GameObject): void {
  player.getComponent(PlayerComponent)?.reset();
  // Hit points are the source of truth for the HUD's lives now, so a retry on
  // the same object has to refill them or the player respawns already dead.
  player.life = player.maxLife;
  player.getVelocity().zero();
  player.getTargetVelocity().zero();
  player.getAcceleration().zero();
  player.getImpulse().zero();
  player.setCurrentAction(ActionType.INVALID);
}

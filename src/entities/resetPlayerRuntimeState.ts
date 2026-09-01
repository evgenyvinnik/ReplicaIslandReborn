import { ActionType } from '../types';
import type { GameObject } from './GameObject';
import { PlayerComponent } from './components/PlayerComponent';

/**
 * Reset transient player state without destroying the entity configuration that
 * was just built by LevelSystem (dimensions, team, sprite, and hit volumes).
 */
export function resetPlayerRuntimeState(player: GameObject): void {
  player.getComponent(PlayerComponent)?.reset();
  player.getVelocity().zero();
  player.getTargetVelocity().zero();
  player.getAcceleration().zero();
  player.getImpulse().zero();
  player.setCurrentAction(ActionType.INVALID);
}

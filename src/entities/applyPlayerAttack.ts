import { ActionType, HitType, Team } from '../types';
import type { GameObject } from './GameObject';
import { RokudouBossComponent } from './components/RokudouBossComponent';

export interface PlayerAttackResult {
  isBoss: boolean;
  defeated: boolean;
}

/** Match the original same-team hit rejection before dispatching a stomp. */
export function canPlayerAttackTarget(player: GameObject, target: GameObject): boolean {
  return player.team === Team.NONE || target.team === Team.NONE || player.team !== target.team;
}

/** Apply one player stomp to an enemy while preserving boss death sequences. */
export function applyPlayerAttack(enemy: GameObject): PlayerAttackResult {
  if (enemy.subType === 'evil_kabocha') {
    // EvilKabochaComponent owns its hit counter and delayed ending callback.
    enemy.lastReceivedHitType = HitType.HIT;
    return { isBoss: true, defeated: false };
  }

  if (enemy.subType === 'rokudou') {
    enemy.life = Math.max(0, enemy.life - 1);
    enemy.lastReceivedHitType = HitType.HIT;
    enemy.getComponent(
      RokudouBossComponent as unknown as new (...args: unknown[]) => RokudouBossComponent
    )?.onHit();
    enemy.setCurrentAction(ActionType.HIT_REACT);
    return { isBoss: true, defeated: enemy.life === 0 };
  }

  if (enemy.subType === 'the_source') {
    enemy.life = Math.max(0, enemy.life - 1);
    enemy.lastReceivedHitType = HitType.HIT;
    enemy.setCurrentAction(ActionType.HIT_REACT);
    return { isBoss: true, defeated: enemy.life === 0 };
  }

  enemy.life = 0;
  enemy.setVisible(false);
  enemy.markForRemoval();
  return { isBoss: false, defeated: true };
}

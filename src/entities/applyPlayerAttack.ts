import { HitType, Team } from '../types';
import type { GameObject } from './GameObject';
import type { GameComponent } from './GameComponent';
import { NPCComponent } from './components/NPCComponent';
import { HitReactionComponent } from './components/HitReactionComponent';

export interface PlayerAttackResult {
  isBoss: boolean;
  defeated: boolean;
}

/** Match the original same-team hit rejection before dispatching a stomp. */
export function canPlayerAttackTarget(player: GameObject, target: GameObject): boolean {
  return player.team === Team.NONE || target.team === Team.NONE || player.team !== target.team;
}

function getComponent<T extends GameComponent>(object: GameObject, ctor: unknown): T | null {
  return object.getComponent(ctor as new (...args: unknown[]) => T) as T | null;
}

/**
 * Objects carrying a HitReactionComponent are damaged by
 * GameObjectCollisionSystem when the player's stomp volume overlaps their
 * vulnerability volume. The inline stomp path must not decrement their life a
 * second time.
 */
function usesComponentDamage(enemy: GameObject): boolean {
  return getComponent<HitReactionComponent>(enemy, HitReactionComponent) !== null;
}

/**
 * Does some component run this object's death sequence?
 *
 * Scripted characters (the bosses) die through NPCComponent, which plays the
 * death action and posts the ending cutscene. The Source runs its own collapse
 * through TheSourceComponent. Anything else - breakable blocks, say - has no
 * death sequence and is simply removed once its life runs out.
 */
function ownsDeathSequence(enemy: GameObject): boolean {
  if (enemy.subType === 'the_source') return true;
  return getComponent<NPCComponent>(enemy, NPCComponent) !== null;
}

/**
 * Apply one player stomp to an enemy.
 *
 * Ordinary enemies die in one hit and are removed here, matching the port's
 * inline combat. Anything wired into the component collision pipeline has
 * already taken its damage there; this only reports the outcome and cleans up
 * objects that have no death sequence of their own.
 */
export function applyPlayerAttack(enemy: GameObject): PlayerAttackResult {
  if (usesComponentDamage(enemy)) {
    enemy.lastReceivedHitType = HitType.HIT;
    const scripted = ownsDeathSequence(enemy);
    const defeated = enemy.life <= 0;

    if (defeated && !scripted) {
      enemy.setVisible(false);
      enemy.markForRemoval();
    }

    return { isBoss: scripted, defeated };
  }

  enemy.life = 0;
  enemy.setVisible(false);
  enemy.markForRemoval();
  return { isBoss: false, defeated: true };
}

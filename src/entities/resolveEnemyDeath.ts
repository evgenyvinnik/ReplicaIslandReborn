import type { GameObject } from './GameObject';
import { GameObjectType } from './GameObjectFactory';
import { NPCComponent } from './components/NPCComponent';
import { PlayerComponent } from './components/PlayerComponent';
import { getInventory, setInventory } from './components/InventoryComponent';
import { useGameStore } from '../stores/useGameStore';
import { sSystemRegistry, type SystemRegistry } from '../engine/SystemRegistry';

// Original spawnEnemy* LifetimeComponent death effects. Brobots detonate;
// these other ordinary enemies disperse into the six-particle smoke emitter.
const SMOKE_ENEMIES = new Set(['snailbomb', 'shadowslime', 'skeleton', 'karaguin', 'bat', 'sting', 'onion']);

/** Shared by collision outcomes and lethal possession release; exactly once. */
export function resolveEnemyDeath(enemy: GameObject, registry: SystemRegistry = sSystemRegistry): boolean {
  if (enemy.type !== 'enemy' || enemy.life > 0 || !enemy.isVisible() || enemy.isMarkedForRemoval()) return false;
  if (enemy.subType === 'the_source' || enemy.getComponent(
    NPCComponent as unknown as new (...args: unknown[]) => NPCComponent
  )) return false;

  // Mark first so a re-entrant caller cannot spawn or award this death twice.
  enemy.setVisible(false);
  enemy.markForRemoval();
  const kind = enemy.subType === 'brobot' ? GameObjectType.EXPLOSION_GIANT
    : enemy.subType === 'turret' ? GameObjectType.EXPLOSION_LARGE
    : SMOKE_ENEMIES.has(enemy.subType) ? GameObjectType.SMOKE_POOF : null;
  if (kind) {
    const effect = registry.gameObjectFactory?.spawn(kind, enemy.getPosition().x, 0, enemy.facingDirection.x < 0);
    if (effect) {
      // Lifetime spawns at the original body's bottom-left, not its centre.
      effect.setPosition(enemy.getPosition().x, enemy.getPosition().y + enemy.height - effect.height);
    }
  }
  if (SMOKE_ENEMIES.has(enemy.subType)) registry.soundSystem?.playSfx('sound_stomp');

  // A remote detonation or death pit is not a player stomp. Previously every
  // enemy death bounced Andou and froze play, even far away from the victim.
  const player = registry.gameObjectManager?.getPlayer();
  if (player && enemy.lastDamageSource === player) {
    registry.effectsSystem?.spawnCrushFlash(enemy.getCenteredPositionX(), enemy.getCenteredPositionY());
    registry.timeSystem?.freeze(PlayerComponent.ATTACK_PAUSE_DELAY);
    player.getVelocity().y = -200;
  }
  // Preserve the web port's score award; count released brobots as destroyed too.
  setInventory({ score: getInventory().score + 25 });
  useGameStore.getState().recordEnemyDefeat();
  return true;
}

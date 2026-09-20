import type { GameObject } from './GameObject';
import { PlayerComponent } from './components/PlayerComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { SortConstants } from '../engine/SortConstants';
import { Team } from '../types';

/** Shared Android spawnPlayer configuration for placed and runtime players. */
export function configurePlayerObject(
  object: GameObject,
  maxLife: number,
  control = new PlayerComponent(),
  sprite = new SpriteComponent()
): void {
  object.type = 'player';
  object.team = Team.PLAYER;
  object.width = PlayerComponent.WIDTH;
  object.height = PlayerComponent.HEIGHT;
  object.life = object.maxLife = maxLife;
  object.activationRadius = -1;
  object.destroyOnDeactivation = false;
  sprite.setSprite('andou_stand');
  sprite.setPriority(SortConstants.PLAYER);

  // PlayerComponent owns movement, gravity and world collision in this port.
  // Adding generic physics/movement here would integrate the player twice.
  const collision = new DynamicCollisionComponent();
  const reaction = new HitReactionComponent({
    bounceOnHit: true,
    bounceMagnitude: 200,
    invincibleAfterHitTime: PlayerComponent.INVINCIBILITY_TIME,
    pauseOnAttack: true,
    forceInvincibility: false,
  });
  sprite.setCollisionComponent(collision);
  collision.setHitReactionComponent(reaction);
  object.addComponent(control);
  object.addComponent(sprite);
  object.addComponent(collision);
  object.addComponent(reaction);
}

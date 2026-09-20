/** Shared runtime/serialized projectile setup from Android GameObjectFactory. */
import type { GameObject } from './GameObject';
import { Team, HitType } from '../types';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { MovementComponent } from './components/MovementComponent';
import { LifetimeComponent } from './components/LifetimeComponent';
import { SimpleCollisionComponent } from './components/SimpleCollisionComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';

export type ProjectileKind = 'cannon_ball' | 'turret_bullet' | 'energy_ball' | 'wanda_shot' | 'brobot_bullet';

export function configureProjectile(
  object: GameObject, kind: ProjectileKind, movement = new MovementComponent()
): void {
  const harmless = kind === 'brobot_bullet';
  const small = kind === 'turret_bullet';
  const storyShot = kind === 'wanda_shot';
  object.type = 'projectile';
  object.subType = kind;
  object.width = object.height = harmless ? 64 : small ? 16 : 32;
  object.team = storyShot ? Team.NONE : Team.ENEMY;
  object.life = object.maxLife = 1;
  object.activationRadius = Math.hypot(240, 160) + 128;
  object.destroyOnDeactivation = true;
  object.addComponent(movement);

  const lifetime = new LifetimeComponent();
  lifetime.setTimeUntilDeath(kind === 'energy_ball' || storyShot ? 5 : 3);
  if (kind === 'cannon_ball') {
    lifetime.setDieOnHitBackground(true);
    object.addComponent(new SimpleCollisionComponent());
  }
  object.addComponent(lifetime);

  // Android's Brobot test projectile is only animated scenery: no attack
  // volumes or HitReaction. All other shots fly straight, without gravity;
  // only cannon balls use background collision.
  if (!harmless) {
    const collision = new DynamicCollisionComponent();
    const radius = small || kind === 'cannon_ball' ? 8 : 16;
    collision.setCollisionVolumes([
      new SphereCollisionVolume(radius, object.width / 2, object.height / 2, HitType.HIT),
    ], null);
    const reaction = new HitReactionComponent({ dieOnAttack: !storyShot });
    collision.setHitReactionComponent(reaction);
    object.addComponent(collision);
    object.addComponent(reaction);
  }
}

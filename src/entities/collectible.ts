/** Source-faithful pickup bodies shared by placed and runtime objects. */
import { HitType, Team } from '../types';
import type { GameObject } from './GameObject';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitPlayerComponent } from './components/HitPlayerComponent';
import { HitReactionComponent } from './components/HitReactionComponent';

export type CollectibleKind = 'coin' | 'ruby' | 'diary';

export function configureCollectible(obj: GameObject, kind: CollectibleKind): void {
  obj.type = kind;
  obj.team = Team.NONE;
  obj.width = kind === 'coin' ? 16 : 32;
  obj.height = obj.width;
  obj.life = 1;
  obj.activationRadius = Math.hypot(240, 160) + 128;
  obj.destroyOnDeactivation = false;

  const reaction = new HitReactionComponent({
    dieOnCollect: true,
    forceInvincibility: true,
    onHitSound: kind === 'coin' ? 'ding' : undefined,
  });
  if (kind === 'coin') {
    reaction.setSoundPlayer(sound => sSystemRegistry.soundSystem?.playSfx(sound));
    // Android spawnCoin uses a cheap 32px player-radius test, not a sprite
    // vulnerability volume. The other two items use COLLECT volumes.
    const hitPlayer = new HitPlayerComponent();
    hitPlayer.setup({ distance: 32, hitReaction: reaction, hitType: HitType.COLLECT, hitPlayer: false });
    obj.addComponent(hitPlayer);
  } else {
    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(null, [new SphereCollisionVolume(16, 16, 16, HitType.COLLECT)]);
    collision.setHitReactionComponent(reaction);
    obj.addComponent(collision);
  }
  obj.addComponent(reaction);
}

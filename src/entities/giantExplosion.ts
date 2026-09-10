import type { GameObject } from './GameObject';
import { SpriteComponent } from './components/SpriteComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { LifetimeComponent } from './components/LifetimeComponent';
import { PlaySingleSoundComponent } from './components/PlaySingleSoundComponent';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { SortConstants } from '../engine/SortConstants';
import { sSystemRegistry } from '../engine/SystemRegistry';
import type { RenderSystem } from '../engine/RenderSystem';
import { HitType, Team } from '../types';

/** Original GameObjectFactory.spawnEffectExplosionGiant: four concurrent sprites. */
export function configureGiantExplosion(object: GameObject, renderer?: RenderSystem | null): void {
  object.type = 'effect';
  object.subType = 'explosion_giant';
  object.width = object.height = 64;
  object.activationRadius = -1;
  object.team = Team.PLAYER;

  const collision = new DynamicCollisionComponent();
  // Constructor order is radius, centre X, centre Y, just as in Android.
  collision.setCollisionVolumes([new SphereCollisionVolume(64, 32, 32, HitType.HIT)], null);
  object.addComponent(collision);

  for (const [prefix, count, size, delay, x, y] of [
    ['big', 9, 64, 0, 0, 0],
    // Convert Y-up draw offsets with parentHeight - offsetY - spriteHeight.
    ['small', 7, 32, 0, 40, -18],
    ['small', 7, 32, 4, -10, 32],
    ['small', 7, 32, 8, 0, 0],
  ] as const) {
    const sprite = new SpriteComponent();
    sprite.setPriority(SortConstants.EFFECT);
    sprite.setOffset(x, y);
    if (renderer) sprite.setRenderSystem(renderer);
    const frames = Array.from({ length: count }, (_, i) => ({
      sprite: `effect_explosion_${prefix}${String(i + 1).padStart(2, '0')}.png`,
      x: 0, y: 0, width: size, height: size, duration: 1 / 24,
    }));
    if (delay) frames.unshift({ sprite: '', x: 0, y: 0, width: size, height: size, duration: delay / 24 });
    sprite.addAnimation('blast', { frames, loop: false });
    sprite.playAnimation('blast');
    object.addComponent(sprite);
  }

  // Non-looping sprites retain their final frame until the longest layer ends.
  const lifetime = new LifetimeComponent();
  lifetime.setTimeUntilDeath(15 / 24);
  object.addComponent(lifetime);
  const sound = new PlaySingleSoundComponent();
  sound.setSound('quick_explosion');
  if (sSystemRegistry.soundSystem) sound.setSoundSystem(sSystemRegistry.soundSystem);
  object.addComponent(sound);
}

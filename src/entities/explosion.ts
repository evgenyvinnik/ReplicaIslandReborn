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
import { assetPath } from '../utils/helpers';

/** All sizes, including giant's satellites, share these original image files. */
export const EXPLOSION_SPRITES = ['small', 'big'].flatMap(prefix =>
  Array.from({ length: prefix === 'big' ? 9 : 7 }, (_, i) =>
    `effect_explosion_${prefix}${String(i + 1).padStart(2, '0')}.png`));

export async function preloadExplosionSprites(renderer: RenderSystem): Promise<void> {
  await Promise.all(EXPLOSION_SPRITES.map(name =>
    renderer.loadSingleImage(name, assetPath(`/assets/sprites/${name}`))));
}

/** Original spawnEffectExplosionSmall/Large: neutral-team damaging animations. */
export function configureExplosion(object: GameObject, large: boolean, renderer?: RenderSystem | null): void {
  const size = large ? 64 : 32;
  const count = large ? 9 : 7;
  object.type = 'effect'; object.subType = large ? 'explosion_large' : 'explosion_small';
  object.width = object.height = size;
  object.activationRadius = -1;
  object.team = Team.NONE;
  const attack = [new SphereCollisionVolume(size / 2, size / 2, size / 2, HitType.HIT)];
  const collision = new DynamicCollisionComponent();
  collision.setCollisionVolumes(attack, null);
  object.addComponent(collision);
  const sprite = new SpriteComponent();
  sprite.setPriority(SortConstants.EFFECT);
  sprite.setCollisionComponent(collision);
  if (renderer) sprite.setRenderSystem(renderer);
  sprite.addAnimation('blast', { loop: false, frames: Array.from({ length: count }, (_, i) => ({
    sprite: `effect_explosion_${large ? 'big' : 'small'}${String(i + 1).padStart(2, '0')}.png`,
    x: 0, y: 0, width: size, height: size, duration: 1 / 24,
    attackVolumes: attack, vulnerabilityVolumes: null,
  })) });
  sprite.playAnimation('blast'); object.addComponent(sprite);
  const lifetime = new LifetimeComponent(); lifetime.setTimeUntilDeath(count / 24);
  object.addComponent(lifetime);
  // Small explosions have no sound component in the original.
  if (large) {
    const sound = new PlaySingleSoundComponent(); sound.setSound('quick_explosion');
    if (sSystemRegistry.soundSystem) sound.setSoundSystem(sSystemRegistry.soundSystem);
    object.addComponent(sound);
  }
}

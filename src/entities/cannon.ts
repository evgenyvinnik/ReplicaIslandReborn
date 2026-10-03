import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { HitType, Team } from '../types';
import type { GameObject } from './GameObject';
import type { GameObjectType } from './GameObjectFactory';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { GenericAnimation, GenericAnimationComponent } from './components/GenericAnimationComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { LauncherComponent } from './components/LauncherComponent';
import { SpriteComponent } from './components/SpriteComponent';

/** The authored and runtime cannon use the same Android loading/firing body. */
export function configureCannon(obj: GameObject, activationRadius: number, smokeEffect: GameObjectType): void {
  obj.type = 'cannon';
  obj.width = 64;
  obj.height = 128;
  obj.activationRadius = activationRadius;
  obj.destroyOnDeactivation = false;
  obj.team = Team.NONE;
  obj.life = 1;

  const launcher = new LauncherComponent({
    angle: Math.PI,
    magnitude: 2000,
    launchDelay: 2,
    postLaunchDelay: 1,
    launchEffect: smokeEffect,
    launchEffectOffsetX: 32,
    launchEffectOffsetY: 85,
    launchSound: 'sound_cannon',
  });
  obj.addComponent(launcher);

  // Android's LAUNCH box is (16,16,32,80) in a bottom-up 64x128 sprite.
  const launchVolume = new AABoxCollisionVolume(16, 128 - 16 - 80, 32, 80, HitType.LAUNCH);
  const collision = new DynamicCollisionComponent();
  collision.setCollisionVolumes([launchVolume], null);
  obj.addComponent(collision);

  const hitReaction = new HitReactionComponent();
  collision.setHitReactionComponent(hitReaction);
  hitReaction.setLauncherComponent(launcher, HitType.LAUNCH);
  obj.addComponent(hitReaction);

  const sprite = new SpriteComponent();
  sprite.setCollisionComponent(collision);
  const frame = { x: 0, y: 0, width: 64, height: 128, duration: 1, sprite: 'object_cannon' };
  sprite.addAnimationAtIndex(GenericAnimation.IDLE, {
    name: 'cannon_idle', loop: false,
    frames: [{ ...frame, attackVolumes: [launchVolume], vulnerabilityVolumes: null }],
  });
  sprite.addAnimationAtIndex(GenericAnimation.ATTACK, {
    name: 'cannon_fire', loop: false,
    frames: [{ ...frame, attackVolumes: null, vulnerabilityVolumes: null }],
  });
  sprite.playAnimation(GenericAnimation.IDLE);
  obj.addComponent(sprite);
  const animation = new GenericAnimationComponent();
  animation.setSprite(sprite);
  obj.addComponent(animation);
}

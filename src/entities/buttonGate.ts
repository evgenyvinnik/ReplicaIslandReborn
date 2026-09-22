/** Android's colour channels and configured button/door bodies. */
import { HitType, Team, type AnimationDefinition } from '../types';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { createDoorAnimations } from '../data/doorAnimations';
import type { GameObject } from './GameObject';
import { SpriteComponent } from './components/SpriteComponent';
import { DoorAnimation, DoorAnimationComponent } from './components/DoorAnimationComponent';
import { ButtonAnimation, ButtonAnimationComponent } from './components/ButtonAnimationComponent';
import { SolidSurfaceComponent } from './components/SolidSurfaceComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';

export type ButtonGateColor = 'red' | 'blue' | 'green';

function channelFor(color: ButtonGateColor): string {
  return `${color.toUpperCase()} BUTTON`;
}

export function configureDoor(obj: GameObject, color: ButtonGateColor, blocking = true): void {
  obj.type = 'door';
  obj.subType = blocking ? color : `${color}_nonblocking`;
  obj.team = Team.NONE;
  obj.width = 32;
  obj.height = 64;
  obj.activationRadius = Math.hypot(240, 160) + 128;
  obj.destroyOnDeactivation = false;

  const sprite = new SpriteComponent();
  sprite.setSprite(`object_door_${color}01`);
  for (const [index, animation] of createDoorAnimations(color)) {
    sprite.addAnimationAtIndex(index, animation);
  }
  sprite.playAnimation(DoorAnimation.CLOSED);
  obj.addComponent(sprite);

  const animation = new DoorAnimationComponent({
    stayOpenTime: 5,
    openSound: 'sound_open',
    closeSound: 'sound_close',
  });
  animation.setSprite(sprite);
  const channel = sSystemRegistry.channelSystem?.registerChannel(channelFor(color));
  if (channel) animation.setChannel(channel);
  if (blocking) {
    const surface = new SolidSurfaceComponent();
    surface.createRectangle(32, 64);
    obj.addComponent(surface);
    animation.setSolidSurface(surface);
  }
  obj.addComponent(animation);

  // Even the nonblocking variant keeps the original closing-frame crush hit.
  const collision = new DynamicCollisionComponent();
  const reaction = new HitReactionComponent({ forceInvincibility: true });
  collision.setHitReactionComponent(reaction);
  obj.addComponent(collision);
  obj.addComponent(reaction);
}

export function configureButton(obj: GameObject, color: ButtonGateColor): void {
  obj.type = 'button';
  obj.subType = color;
  // Team.NONE lets both Andou and a brobot press the plate.
  obj.team = Team.NONE;
  obj.width = obj.height = 32;
  obj.activationRadius = Math.hypot(240, 160) + 128;
  obj.destroyOnDeactivation = false;

  const sprite = new SpriteComponent();
  sprite.setSprite(`object_button_${color}`);
  for (const [index, key] of [
    [ButtonAnimation.UP, `object_button_${color}`],
    [ButtonAnimation.DOWN, `object_button_pressed_${color}`],
  ] as const) {
    const animation: AnimationDefinition = {
      name: index === ButtonAnimation.UP ? 'up' : 'down',
      frames: [{ x: 0, y: 0, width: 32, height: 32, duration: 1, sprite: key }],
      loop: false,
    };
    sprite.addAnimationAtIndex(index, animation);
  }
  sprite.playAnimation(ButtonAnimation.UP);
  obj.addComponent(sprite);

  const animation = new ButtonAnimationComponent({ depressSound: 'sound_button' });
  animation.setSprite(sprite);
  const channel = sSystemRegistry.channelSystem?.registerChannel(channelFor(color));
  if (channel) animation.setChannel(channel);
  obj.addComponent(animation);

  const collision = new DynamicCollisionComponent();
  // Android AABox(0,0,32,16) is bottom-relative; Canvas Y grows downward.
  collision.setCollisionVolumes(null, [new AABoxCollisionVolume(0, 16, 32, 16, HitType.DEPRESS)]);
  const reaction = new HitReactionComponent({ forceInvincibility: false });
  collision.setHitReactionComponent(reaction);
  obj.addComponent(collision);
  obj.addComponent(reaction);
}

/** Shared composition of Android GameObjectFactory.spawnObjectTheSource(). */
import type { GameObject } from './GameObject';
import type { RenderSystem } from '../engine/RenderSystem';
import { Team, HitType } from '../types';
import { SortConstants } from '../engine/SortConstants';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { gameFlowEvent, GameFlowEventType } from '../engine/GameFlowEvent';
import { CutsceneType } from '../data/cutscenes';
import { SphereCollisionVolume } from '../engine/collision/SphereCollisionVolume';
import { SpriteComponent } from './components/SpriteComponent';
import { FadeDrawableComponent, FadeLoopType, FadeFunction } from './components/FadeDrawableComponent';
import { OrbitalMagnetComponent } from './components/OrbitalMagnetComponent';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { TheSourceComponent } from './components/TheSourceComponent';

const LAYERS = [
  { sprite: 'source_spikes', from: 1, to: 0.2, duration: 1.9, linear: false },
  { sprite: 'source_body', from: 1, to: 0.8, duration: 5, linear: false },
  { sprite: 'source_black', from: 0, to: 1, duration: 6, linear: true },
  { sprite: 'source_spots', from: 0, to: 1, duration: 2.3, linear: false },
  { sprite: 'source_core', from: 0.2, to: 1, duration: 1.2, linear: false },
] as const;

export function configureTheSource(
  object: GameObject,
  renderer: RenderSystem | null = null,
  onEnding?: () => void
): void {
  object.type = 'enemy';
  object.subType = 'the_source';
  object.width = object.height = 512;
  object.life = object.maxLife = 3;
  object.team = Team.PLAYER; // The original accepts enemy attacks, not Andou's.
  object.activationRadius = -1;

  LAYERS.forEach((layer, index) => {
    const sprite = new SpriteComponent();
    sprite.setPriority(SortConstants.THE_SOURCE_START + index);
    if (renderer) sprite.setRenderSystem(renderer);
    sprite.addAnimation(layer.sprite, {
      name: layer.sprite,
      frames: [{ x: 0, y: 0, width: 512, height: 512, duration: 1, sprite: layer.sprite }],
      loop: true,
    });
    sprite.playAnimation(layer.sprite);
    object.addComponent(sprite);
    const fade = new FadeDrawableComponent();
    fade.setSpriteComponent(sprite);
    fade.setupFade({
      startOpacity: layer.from, endOpacity: layer.to, duration: layer.duration,
      loopType: FadeLoopType.PING_PONG,
      fadeFunction: layer.linear ? FadeFunction.LINEAR : FadeFunction.EASE,
    });
    object.addComponent(fade);
  });

  const orbit = new OrbitalMagnetComponent();
  orbit.setup(320, 220);
  object.addComponent(orbit);
  const collision = new DynamicCollisionComponent();
  collision.setCollisionVolumes(
    [new SphereCollisionVolume(256, 256, 256, HitType.HIT)],
    [new SphereCollisionVolume(256, 256, 256, HitType.HIT)]
  );
  const reaction = new HitReactionComponent({ invincibleAfterHitTime: 0.6 });
  collision.setHitReactionComponent(reaction);
  object.addComponent(collision);
  object.addComponent(reaction);

  const source = new TheSourceComponent();
  source.setOnDeathChannel(() => {
    const channel = sSystemRegistry.channelSystem?.registerChannel('SURPRISED');
    if (channel) channel.value = { value: true };
  });
  source.setGameEvent(GameFlowEventType.SHOW_ANIMATION, CutsceneType.WANDA_ENDING);
  source.setOnGameEvent((event, index) => {
    if (onEnding) onEnding();
    else gameFlowEvent.post(event, index);
  });
  object.addComponent(source);
}

/**
 * Per-frame animation data, the way the original's `AnimationFrame` carries it.
 *
 * In the original an animation frame holds its texture *and* its attack and
 * vulnerability volumes, and `SpriteComponent` hands those to the object's
 * `DynamicCollisionComponent` as the animation plays. That is why a skeleton
 * only has an attack volume mid-swing and a mudman never has a vulnerability
 * volume at all.
 *
 * This port drew from a sprite switch in `Game.tsx` instead, so frames carried
 * neither their own image nor any volumes.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { SpriteComponent } from './SpriteComponent';
import { DynamicCollisionComponent } from './DynamicCollisionComponent';
import { GameObject } from '../GameObject';
import { AABoxCollisionVolume } from '../../engine/collision/AABoxCollisionVolume';
import { HitType } from '../../types';
import type { SpriteFrame } from '../../types';

function frame(sprite: string, duration: number, extra: Partial<SpriteFrame> = {}): SpriteFrame {
  return { x: 0, y: 0, width: 32, height: 32, duration, sprite, ...extra };
}

describe('SpriteComponent per-frame data', () => {
  let object: GameObject;
  let sprite: SpriteComponent;
  let collision: DynamicCollisionComponent;

  beforeEach(() => {
    object = new GameObject();
    object.width = 32;
    object.height = 32;
    sprite = new SpriteComponent();
    collision = new DynamicCollisionComponent();
    sprite.setCollisionComponent(collision);
    object.addComponent(collision);
    object.addComponent(sprite);
  });

  test('a frame can name its own image', () => {
    sprite.addAnimation('walk', {
      frames: [frame('walk01', 0.1), frame('walk02', 0.1)],
      loop: true,
    });
    sprite.playAnimation('walk');

    // Frames are advanced by the component's own timer.
    expect(sprite.getCurrentAnimation()?.frames[0].sprite).toBe('walk01');
    sprite.update(0.15, object);
    expect(sprite.getCurrentAnimation()?.frames[1].sprite).toBe('walk02');
  });

  test('a frame hands its volumes to the collision component', () => {
    const swing = [new AABoxCollisionVolume(0, 0, 32, 32, HitType.HIT)];
    sprite.addAnimation('attack', {
      frames: [
        // Wind-up: no attack volume yet.
        frame('attack01', 0.1, { attackVolumes: null }),
        // Contact frame: the swing connects.
        frame('attack02', 0.1, { attackVolumes: swing }),
      ],
      loop: false,
    });
    sprite.playAnimation('attack');

    sprite.update(0, object);
    expect(collision.getAttackVolumes()).toBeNull();

    sprite.update(0.15, object);
    expect(collision.getAttackVolumes()).toBe(swing);
  });

  test('a frame with no volume data leaves the current volumes alone', () => {
    const standing = [new AABoxCollisionVolume(0, 0, 32, 32, HitType.HIT)];
    collision.setCollisionVolumes(null, standing);

    sprite.addAnimation('idle', {
      frames: [frame('idle01', 0.1)],
      loop: true,
    });
    sprite.playAnimation('idle');
    sprite.update(0, object);

    expect(collision.getVulnerabilityVolumes()).toBe(standing);
  });

  test('an invulnerable frame can clear the vulnerability volume', () => {
    // This is how the original makes a stomping Andou invincible: the STOMP
    // frames pass null for vulnerability volumes.
    const body = [new AABoxCollisionVolume(0, 0, 32, 32, HitType.HIT)];
    collision.setCollisionVolumes(null, body);

    sprite.addAnimation('stomp', {
      frames: [frame('stomp01', 0.1, { vulnerabilityVolumes: null })],
      loop: false,
    });
    sprite.playAnimation('stomp');
    sprite.update(0, object);

    expect(collision.getVulnerabilityVolumes()).toBeNull();
  });

  test('a one-shot animation finishes after the last frame duration, not on entry', () => {
    sprite.addAnimation('attack', {
      frames: [frame('attack01', 0.1), frame('attack02', 0.2)],
      loop: false,
    });
    sprite.playAnimation('attack');

    sprite.update(0.1, object);
    expect(sprite.animationFinished()).toBe(false);
    sprite.update(0.19, object);
    expect(sprite.animationFinished()).toBe(false);
    sprite.update(0.01, object);
    expect(sprite.animationFinished()).toBe(true);
  });

  test('volumes reach the collision component without explicit linking', () => {
    // Spawn sites should not each have to call setCollisionComponent().
    const bare = new GameObject();
    const bareCollision = new DynamicCollisionComponent();
    const bareSprite = new SpriteComponent();
    bare.addComponent(bareCollision);
    bare.addComponent(bareSprite);

    const volumes = [new AABoxCollisionVolume(0, 0, 32, 32, HitType.HIT)];
    bareSprite.addAnimation('idle', {
      frames: [frame('idle01', 0.1, { vulnerabilityVolumes: volumes })],
      loop: true,
    });
    bareSprite.playAnimation('idle');
    bareSprite.update(0, bare);

    expect(bareCollision.getVulnerabilityVolumes()).toBe(volumes);
  });
});

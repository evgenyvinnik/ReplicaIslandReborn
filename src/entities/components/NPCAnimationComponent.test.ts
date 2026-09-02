import { beforeEach, describe, expect, test } from 'bun:test';
import { createNpcAnimations } from '../../data/npcAnimations';
import { TimeSystem } from '../../engine/TimeSystem';
import { sSystemRegistry } from '../../engine/SystemRegistry';
import { ActionType } from '../../types';
import { GameObject } from '../GameObject';
import { NPCAnimation, NPCAnimationComponent } from './NPCAnimationComponent';
import { SpriteComponent } from './SpriteComponent';

describe('NPCAnimationComponent Canvas coordinates', () => {
  beforeEach(() => {
    sSystemRegistry.reset();
  });

  function animateWithVerticalVelocity(velocityY: number): SpriteComponent {
    const time = new TimeSystem();
    time.update(1);
    sSystemRegistry.register(time, 'time');

    const object = new GameObject();
    object.type = 'npc';
    object.subType = 'kyle';
    object.width = 64;
    object.height = 128;
    object.setCurrentAction(ActionType.MOVE);
    object.setVelocity(0, velocityY);

    const sprite = new SpriteComponent();
    const animations = createNpcAnimations('kyle', object.width, object.height)!;
    for (const [index, animation] of animations) {
      sprite.addAnimationAtIndex(index, animation);
    }
    sprite.playAnimation(NPCAnimation.IDLE);

    const animator = new NPCAnimationComponent();
    animator.setSprite(sprite);
    object.addComponent(animator);
    object.addComponent(sprite);
    object.update(0, time.getGameTime());
    return sprite;
  }

  test('an NPC moving upward enters its jump wind-up', () => {
    expect(animateWithVerticalVelocity(-100).getCurrentAnimationIndex())
      .toBe(NPCAnimation.JUMP_START);
  });

  test('an NPC moving downward enters its airborne fall pose', () => {
    expect(animateWithVerticalVelocity(100).getCurrentAnimationIndex())
      .toBe(NPCAnimation.JUMP_AIR);
  });
});

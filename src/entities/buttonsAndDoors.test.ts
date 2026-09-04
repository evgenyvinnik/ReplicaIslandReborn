/**
 * Buttons and doors, the original's channel-based puzzle mechanic.
 *
 * A button that takes a DEPRESS hit stamps the current game time onto a named
 * channel ("RED BUTTON" / "BLUE BUTTON" / "GREEN BUTTON"); a door watching that
 * channel opens while the stamp is fresher than its stay-open time, then closes
 * again. Nothing connects the two objects directly, which is what lets one
 * button drive several doors.
 *
 * The DEPRESS hit itself now arrives through GameObjectCollisionSystem: Andou's
 * attack volume list always contains a DEPRESS box, and a brobot's does too.
 *
 * Ported from: Original/src/com/replica/replicaisland/ButtonAnimationComponent.java
 * and DoorAnimationComponent.java
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { GameObjectCollisionSystem } from '../engine/GameObjectCollisionSystem';
import { ChannelSystem } from '../engine/ChannelSystem';
import { TimeSystem } from '../engine/TimeSystem';
import { sSystemRegistry } from '../engine/SystemRegistry';
import { GameObject } from './GameObject';
import { DynamicCollisionComponent } from './components/DynamicCollisionComponent';
import { HitReactionComponent } from './components/HitReactionComponent';
import { ButtonAnimationComponent } from './components/ButtonAnimationComponent';
import { DoorAnimationComponent, DoorAnimation } from './components/DoorAnimationComponent';
import { SpriteComponent } from './components/SpriteComponent';
import { AABoxCollisionVolume } from '../engine/collision/AABoxCollisionVolume';
import { createPlayerVolumeSets } from './playerCollisionVolumes';
import { createEnemyCollisionProfile } from './enemyCollisionProfiles';
import { HitType, Team } from '../types';
import type { Channel, ChannelFloatValue } from '../engine/ChannelSystem';

const GREEN = 'GREEN BUTTON';

// DoorAnimationComponent's states: 0 CLOSED, 1 OPEN, 2 CLOSING, 3 OPENING.
const DOOR_OPEN_STATES = [1, 3];
function isDoorOpen(animation: DoorAnimationComponent): boolean {
  return DOOR_OPEN_STATES.includes(animation.getCurrentState());
}

describe('buttons and doors', () => {
  let system: GameObjectCollisionSystem;
  let channels: ChannelSystem;
  let time: TimeSystem;

  beforeEach(() => {
    sSystemRegistry.reset();
    system = new GameObjectCollisionSystem();
    channels = new ChannelSystem();
    time = new TimeSystem();
    sSystemRegistry.register(system, 'gameObjectCollision');
    sSystemRegistry.register(time, 'time');
    sSystemRegistry.channelSystem = channels;
  });

  /** A button wired the way LevelSystemNew wires it. */
  function makeButton(channel: Channel): GameObject {
    const object = new GameObject();
    object.type = 'button';
    // Original: Team.NONE, so both Andou and a brobot can depress it.
    object.team = Team.NONE;
    object.width = 32;
    object.height = 32;
    object.getPosition().set(100, 100);

    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(
      null,
      [new AABoxCollisionVolume(0, 0, 32, 16, HitType.DEPRESS)]
    );
    const reaction = new HitReactionComponent({ forceInvincibility: true });
    collision.setHitReactionComponent(reaction);

    const animation = new ButtonAnimationComponent();
    animation.setChannel(channel);
    animation.setSprite(new SpriteComponent());

    object.addComponent(collision);
    object.addComponent(reaction);
    object.addComponent(animation);
    return object;
  }

  /** Something standing on the button, carrying a DEPRESS attack volume. */
  function makePresser(kind: 'player' | 'brobot'): GameObject {
    const object = new GameObject();
    object.team = kind === 'player' ? Team.PLAYER : Team.ENEMY;
    object.width = kind === 'player' ? 32 : 64;
    object.height = kind === 'player' ? 48 : 64;
    // Both pressers carry their DEPRESS box at their feet, as the original
    // does - Andou's pressCollisionVolume is AABox(16, 0, 32, 16), the bottom
    // 16px of his sprite in Y-up, and a brobot's is AABox(16, 48, 32, 16) on a
    // 64px sprite in Y-down. So both have to stand on the button, whose own
    // DEPRESS volume is the top 16px of its 32px body at y=100.
    //
    // This used to place the player level with the button, because his box had
    // been converted in x but not in y and so sat at his head; standing on the
    // button did not press it, and only overlapping it did.
    // A few pixels of overlap, as a character resting on a button has.
    object.getPosition().set(100, 100 - object.height + 6);

    const volumes = kind === 'player'
      ? createPlayerVolumeSets().normal.attack
      : createEnemyCollisionProfile('brobot')!.attack!;

    const collision = new DynamicCollisionComponent();
    collision.setCollisionVolumes(volumes, null);
    object.addComponent(collision);
    return object;
  }

  function runFrame(objects: GameObject[], now: number): void {
    for (const object of objects) {
      object.setGameTime(now);
      object.update(1 / 60, now);
    }
    system.update(1 / 60);
  }

  test('a player standing on a button stamps its channel', () => {
    const channel = channels.registerChannel(GREEN)!;
    const button = makeButton(channel);
    const player = makePresser('player');

    expect(channel.value).toBeNull();
    // Two frames: the first delivers DEPRESS, the second lets
    // ButtonAnimationComponent see it on the object.
    runFrame([player, button], 0);
    runFrame([player, button], 1 / 60);

    expect(button.lastReceivedHitType).toBe(HitType.DEPRESS);
    expect(channel.value).not.toBeNull();
  });

  test('a brobot can press a button too', () => {
    // The original gives brobots a DEPRESS volume for exactly this.
    const channel = channels.registerChannel(GREEN)!;
    const button = makeButton(channel);
    const brobot = makePresser('brobot');

    runFrame([brobot, button], 0);
    runFrame([brobot, button], 1 / 60);

    expect(button.lastReceivedHitType).toBe(HitType.DEPRESS);
  });

  test('a door opens while its channel stamp is fresh and closes after', () => {
    const channel = channels.registerChannel(GREEN)!;
    const door = new GameObject();
    door.type = 'door';
    door.width = 32;
    door.height = 64;

    const sprite = new SpriteComponent();
    // DoorAnimationComponent bails out unless the OPENING animation exists.
    const frame = { x: 0, y: 0, width: 32, height: 64, duration: 0.083 };
    for (const index of [DoorAnimation.CLOSED, DoorAnimation.OPEN, DoorAnimation.OPENING, DoorAnimation.CLOSING]) {
      sprite.addAnimationAtIndex(index, { name: `door-${index}`, frames: [frame], loop: false });
    }
    const animation = new DoorAnimationComponent({ stayOpenTime: 3 });
    animation.setSprite(sprite);
    animation.setChannel(channel);
    door.addComponent(sprite);
    door.addComponent(animation);

    // Nothing has pressed the button yet.
    animation.update(1 / 60, door);
    expect(isDoorOpen(animation)).toBe(false);

    // Stamp the channel with "now".
    (channel as { value: ChannelFloatValue | null }).value = { value: time.getGameTime() };
    animation.update(1 / 60, door);
    expect(isDoorOpen(animation)).toBe(true);

    // Let the stamp go stale past stayOpenTime.
    for (let i = 0; i < 60 * 4; i++) {
      time.update(1 / 60);
    }
    animation.update(1 / 60, door);
    expect(isDoorOpen(animation)).toBe(false);
  });
});

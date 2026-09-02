import { describe, expect, test } from 'bun:test';
import { CollisionSystem } from '../../engine/CollisionSystemNew';
import { InputSystem } from '../../engine/InputSystem';
import type { SoundSystem } from '../../engine/SoundSystem';
import type { LevelSystem } from '../../levels/LevelSystemNew';
import { GameObject } from '../GameObject';
import { PlayerComponent, PlayerState } from './PlayerComponent';

describe('PlayerComponent play controls', () => {
  function makePlayer(): {
    input: InputSystem;
    player: GameObject;
    component: PlayerComponent;
  } {
    const input = new InputSystem();
    const collision = new CollisionSystem();
    const sound = { playSfx: () => undefined } as unknown as SoundSystem;
    const level = {
      getLevelSize: () => ({ width: 4096, height: 4096 }),
    } as unknown as LevelSystem;
    const player = new GameObject();
    player.type = 'player';
    player.width = PlayerComponent.WIDTH;
    player.height = PlayerComponent.HEIGHT;

    const component = new PlayerComponent();
    component.setSystems(input, collision, sound, level);
    return { input, player, component };
  }

  test('held movement and stomp input advance the player simulation', () => {
    const { input, player, component } = makePlayer();
    input.setVirtualAxis('horizontal', 1);

    const delta = 1 / 60;
    for (let frame = 1; frame <= 30; frame++) {
      player.setGameTime(frame * delta);
      component.update(delta, player);
    }

    expect(player.getPosition().x).toBeGreaterThan(0);
    expect(player.getVelocity().x).toBeGreaterThan(0);

    input.setVirtualButton('stomp', true);
    player.setGameTime(31 * delta);
    component.update(delta, player);

    expect(component.currentState).toBe(PlayerState.STOMP);
    expect(component.stomping).toBe(true);
  });

  test('holding fly does not retrigger the ground-jump impulse after landing', () => {
    const { input, player, component } = makePlayer();
    input.setVirtualButton('fly', true);

    player.setGameTime(0.1);
    player.setLastTouchedFloorTime(0.1);
    component.update(1 / 60, player);
    expect(component.jumpTime).toBe(0.1);
    expect(component.rocketsOn).toBe(false);

    // Still held on a later landing: this is continuous jet input, not a new
    // InputButton.getTriggered() ground jump.
    player.setGameTime(0.7);
    player.setLastTouchedFloorTime(0.7);
    player.getVelocity().zero();
    component.update(1 / 60, player);

    expect(component.jumpTime).toBe(0.1);
    expect(component.rocketsOn).toBe(true);
  });

  test('holding stomp does not start a second airborne stomp without a new press', () => {
    const { input, player, component } = makePlayer();
    input.setVirtualButton('stomp', true);

    player.setGameTime(1.0);
    component.update(1 / 60, player);
    expect(component.stomping).toBe(true);

    component.stomping = false;
    component.currentState = PlayerState.MOVE;
    player.setGameTime(1.1);
    component.update(1 / 60, player);

    expect(component.stomping).toBe(false);
    expect(component.currentState).toBe(PlayerState.MOVE);
  });
});

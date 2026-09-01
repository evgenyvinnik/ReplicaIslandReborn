import { describe, expect, test } from 'bun:test';
import { CollisionSystem } from '../../engine/CollisionSystemNew';
import { InputSystem } from '../../engine/InputSystem';
import type { SoundSystem } from '../../engine/SoundSystem';
import type { LevelSystem } from '../../levels/LevelSystemNew';
import { GameObject } from '../GameObject';
import { PlayerComponent, PlayerState } from './PlayerComponent';

describe('PlayerComponent play controls', () => {
  test('held movement and stomp input advance the player simulation', () => {
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
});

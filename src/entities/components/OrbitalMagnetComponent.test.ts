import { describe, expect, test } from 'bun:test';
import { GameObject } from '../GameObject';
import { OrbitalMagnetComponent } from './OrbitalMagnetComponent';
import { PlayerComponent } from './PlayerComponent';

describe('OrbitalMagnetComponent', () => {
  test('cancels the web player gravity impulse inside The Source orbit', () => {
    const source = new GameObject();
    source.width = 512;
    source.height = 512;

    const player = new GameObject();
    player.type = 'player';
    player.width = PlayerComponent.WIDTH;
    player.height = PlayerComponent.HEIGHT;
    player.addComponent(new PlayerComponent());
    // Place the player center on the right side of the 220px orbit.
    player.setPosition(256 + 220 - player.width / 2, 256 - player.height / 2);

    const delta = 1 / 60;
    player.setVelocity(100, PlayerComponent.GRAVITY * delta);

    const magnet = new OrbitalMagnetComponent();
    magnet.setup(320, 220);
    magnet.setTarget(player);
    magnet.update(delta, source);

    expect(player.getVelocity().x).toBeCloseTo(100, 5);
    expect(player.getVelocity().y).toBeCloseTo(0, 5);
  });
});
